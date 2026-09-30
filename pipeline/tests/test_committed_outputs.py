"""The committed synthetic dataset and fixtures must match what the code generates today.

Compared with tolerances rather than bytes: numpy's SIMD math can differ in the last bit
between CPUs, which is harmless but would make a byte comparison flaky.
"""

import json
from dataclasses import asdict

import numpy as np
import pytest

from grwu_pipeline import fixtures, kerr, synthetic
from grwu_pipeline.dataset import read_channel, read_meta
from grwu_pipeline.paths import find_repo_root, fixtures_file, kerr_fixtures_file, public_data

ROOT = find_repo_root()
TOY_CHIRP = public_data(ROOT) / "synthetic" / synthetic.DATASET_ID
REGENERATE = "run `grwu-pipeline synthetic` and `grwu-pipeline fixtures` in pipeline/, then commit"


def test_committed_toy_chirp_matches_the_generator():
    config = synthetic.ToyChirpConfig()
    meta = read_meta(TOY_CHIRP)
    recorded = {k: v for k, v in meta["injection"].items() if k != "optimal_snr"}
    assert recorded == asdict(config), REGENERATE

    expected = synthetic.generate(config)
    for channel in ("strain", "injection"):
        committed = read_channel(TOY_CHIRP, channel)
        scale = np.max(np.abs(expected[channel]))
        np.testing.assert_allclose(committed, expected[channel], rtol=0, atol=1e-6 * scale)
    assert meta["injection"]["optimal_snr"] == pytest.approx(config.snr, rel=1e-6)


def compare(a, b, path, rtol):
    """Recursive comparison of a committed fixture with a freshly generated one."""
    if isinstance(b, dict):
        assert set(a) == set(b), f"{path}: keys differ. {REGENERATE}"
        for key in b:
            if key != "generator":
                compare(a[key], b[key], f"{path}.{key}", rtol)
    elif isinstance(b, list) and all(isinstance(v, float) for v in b):
        np.testing.assert_allclose(a, b, rtol=rtol, atol=1e-15, err_msg=path)
    else:
        assert a == b, f"{path}: {a!r} != {b!r}. {REGENERATE}"


def test_committed_fixtures_match_scipy():
    committed = json.loads(fixtures_file(ROOT).read_text())
    compare(committed, fixtures.build(), "dsp", rtol=1e-12)


def test_committed_kerr_fixtures_match_qnm():
    committed = json.loads(kerr_fixtures_file(ROOT).read_text())
    # Leaver's continued fraction converges to a tolerance, not to the last bit.
    compare(committed, kerr.build(), "kerr", rtol=1e-9)
