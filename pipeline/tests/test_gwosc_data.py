"""Offline tests for the GWOSC path: files are faked in the GWOSC HDF5 layout."""

import h5py
import numpy as np
import pytest

from grwu_pipeline import gwosc_data
from grwu_pipeline.dataset import read_channel


def fake_gwosc_file(path, data, gps_start=1126259447.0, sample_rate=4096):
    with h5py.File(path, "w") as f:
        dataset = f.create_dataset("strain/Strain", data=data)
        dataset.attrs["Xstart"] = gps_start
        dataset.attrs["Xspacing"] = 1.0 / sample_rate
    return path


def test_read_hdf5_uses_the_gwosc_layout(tmp_path):
    data = 1e-21 * np.arange(8.0)
    strain = gwosc_data.read_hdf5(fake_gwosc_file(tmp_path / "H1.hdf5", data), source="url")
    assert strain.gps_start == 1126259447.0
    assert strain.sample_rate == 4096
    assert strain.source == "url"
    np.testing.assert_array_equal(strain.data, data)


def test_read_hdf5_refuses_data_with_gaps(tmp_path):
    path = fake_gwosc_file(tmp_path / "H1.hdf5", np.array([0.0, np.nan]))
    with pytest.raises(ValueError, match="NaN"):
        gwosc_data.read_hdf5(path)


def bulk_file_with_gaps(tmp_path, sample_rate=16):
    """A 64 s 'bulk' file starting at GPS 1000 with a data-quality gap in its first 8 s."""
    data = 1e-21 * np.arange(64.0 * sample_rate)
    data[: 8 * sample_rate] = np.nan
    return fake_gwosc_file(tmp_path / "L1.hdf5", data, gps_start=1000.0, sample_rate=sample_rate)


def test_read_hdf5_crops_a_clean_window_out_of_a_bulk_file_with_gaps(tmp_path):
    # Regression: GWOSC answers GW150914 with 4096 s bulk files that contain NaNs elsewhere.
    strain = gwosc_data.read_hdf5(bulk_file_with_gaps(tmp_path), start=1020, end=1052)
    assert strain.gps_start == 1020.0
    assert len(strain.data) == 32 * 16
    assert strain.data[0] == pytest.approx(1e-21 * 20 * 16)


def test_read_hdf5_rejects_gaps_inside_the_window(tmp_path):
    with pytest.raises(ValueError, match="NaN"):
        gwosc_data.read_hdf5(bulk_file_with_gaps(tmp_path), start=1004, end=1036)


def test_read_hdf5_rejects_windows_outside_the_file(tmp_path):
    with pytest.raises(ValueError, match="does not cover"):
        gwosc_data.read_hdf5(bulk_file_with_gaps(tmp_path), start=1050, end=1082)


def test_event_window_puts_the_event_16_s_in():
    assert gwosc_data.event_window(1126259462.4) == (1126259446, 1126259478)


def test_file_span_parses_gwosc_file_names():
    url = "https://gwosc.org/archive/data/O1/1126170624/L-L1_LOSC_4_V1-1126256640-4096.hdf5"
    assert gwosc_data.file_span(url) == (1126256640, 4096)
    with pytest.raises(ValueError):
        gwosc_data.file_span("https://example.org/readme.txt")


def test_write_event_records_licence_and_attribution(tmp_path):
    strains = {
        name: gwosc_data.Strain(1e-21 * np.ones(16) * i, 1126259447.0, 4096, f"{name}.hdf5")
        for i, name in enumerate(["H1", "L1"], start=1)
    }
    meta = gwosc_data.write_event(tmp_path, "GW150914", strains, gps_event=1126259462.4)
    assert meta["license"] == "CC-BY-4.0"
    assert "Gravitational Wave Open Science Center" in meta["attribution"]
    assert meta["gps_event"] == 1126259462.4
    assert meta["sources"] == {"H1": "H1.hdf5", "L1": "L1.hdf5"}
    np.testing.assert_allclose(read_channel(tmp_path / "events" / "GW150914", "L1"), 2e-21)


def test_write_event_rejects_detectors_covering_different_spans(tmp_path):
    strains = {
        "H1": gwosc_data.Strain(np.zeros(16), 1126259447.0, 4096, "a"),
        "L1": gwosc_data.Strain(np.zeros(16), 1126259448.0, 4096, "b"),
    }
    with pytest.raises(ValueError, match="same span"):
        gwosc_data.write_event(tmp_path, "GW150914", strains, gps_event=0.0)


URLS = [
    "https://gwosc.org/eventapi/json/GWTC-1/H-H1_GWOSC_4KHZ_R1-1126259447-32.hdf5",
    "https://gwosc.org/archive/data/O1/H-H1_LOSC_4_V1-1126256640-4096.hdf5",
]


def test_locate_prefers_the_shortest_file_covering_the_window(monkeypatch):
    calls = {}

    def fake_get_event_urls(event, **kwargs):
        calls.update(kwargs, event=event)
        return URLS

    monkeypatch.setattr("gwosc.locate.get_event_urls", fake_get_event_urls)
    assert gwosc_data.locate("GW150914", "H1", 1126259450, 1126259470) == URLS[0]
    assert calls == {"event": "GW150914", "detector": "H1", "sample_rate": 4096, "format": "hdf5"}


def test_locate_falls_back_to_a_bulk_file_when_the_short_one_misses_the_window(monkeypatch):
    monkeypatch.setattr("gwosc.locate.get_event_urls", lambda event, **kwargs: URLS)
    # The 32 s file starts at ...447, so a window from ...446 needs the bulk file.
    assert gwosc_data.locate("GW150914", "H1", 1126259446, 1126259478) == URLS[1]


def test_locate_fails_clearly_when_nothing_covers_the_window(monkeypatch):
    monkeypatch.setattr("gwosc.locate.get_event_urls", lambda event, **kwargs: URLS)
    with pytest.raises(LookupError, match="GW150914 H1"):
        gwosc_data.locate("GW150914", "H1", 1126260700, 1126260800)
