import numpy as np
import pytest

from grwu_pipeline.dataset import read_channel, read_meta, write_dataset


def test_round_trip_keeps_float32_precision(tmp_path):
    rng = np.random.default_rng(0)
    strain = 3e-21 * rng.standard_normal(1000)
    meta = write_dataset(tmp_path, {"id": "x", "sample_rate": 4096}, {"H1": strain})

    assert meta["n_samples"] == 1000
    assert meta["scale"] == 1e-21
    assert meta["byte_order"] == "little"
    restored = read_channel(tmp_path, "H1")
    np.testing.assert_allclose(restored, strain, rtol=1e-6, atol=1e-27)


def test_stored_values_are_little_endian_float32_near_one(tmp_path):
    write_dataset(tmp_path, {"id": "x"}, {"H1": np.array([1e-21, -2e-21])})
    raw = np.frombuffer((tmp_path / "H1.f32").read_bytes(), dtype="<f4")
    np.testing.assert_allclose(raw, [1.0, -2.0], rtol=1e-7)


def test_meta_lists_every_channel_with_a_checksum(tmp_path):
    write_dataset(tmp_path, {"id": "x"}, {"H1": np.zeros(4), "L1": np.ones(4) * 1e-21})
    meta = read_meta(tmp_path)
    assert set(meta["channels"]) == {"H1", "L1"}
    assert all(len(entry["sha256"]) == 64 for entry in meta["channels"].values())


def test_tampered_file_is_detected(tmp_path):
    write_dataset(tmp_path, {"id": "x"}, {"H1": np.ones(4) * 1e-21})
    (tmp_path / "H1.f32").write_bytes(np.zeros(4, dtype="<f4").tobytes())
    with pytest.raises(ValueError, match="checksum"):
        read_channel(tmp_path, "H1")


def test_channels_must_share_a_length(tmp_path):
    with pytest.raises(ValueError, match="length"):
        write_dataset(tmp_path, {"id": "x"}, {"H1": np.zeros(4), "L1": np.zeros(5)})


def test_non_finite_samples_are_rejected(tmp_path):
    with pytest.raises(ValueError, match="non-finite"):
        write_dataset(tmp_path, {"id": "x"}, {"H1": np.array([0.0, np.nan])})
