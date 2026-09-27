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


def test_locate_returns_the_first_matching_url(monkeypatch):
    calls = {}

    def fake_get_event_urls(event, **kwargs):
        calls.update(kwargs, event=event)
        return ["https://gwosc.org/a.hdf5", "https://gwosc.org/b.hdf5"]

    monkeypatch.setattr("gwosc.locate.get_event_urls", fake_get_event_urls)
    assert gwosc_data.locate("GW150914", "H1") == "https://gwosc.org/a.hdf5"
    assert calls == {
        "event": "GW150914",
        "detector": "H1",
        "sample_rate": 4096,
        "format": "hdf5",
        "duration": 32,
    }


def test_locate_fails_clearly_when_nothing_matches(monkeypatch):
    monkeypatch.setattr("gwosc.locate.get_event_urls", lambda event, **kwargs: [])
    with pytest.raises(LookupError, match="GW150914 H1"):
        gwosc_data.locate("GW150914", "H1")
