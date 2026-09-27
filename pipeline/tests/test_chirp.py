import numpy as np
import pytest

from grwu_pipeline.chirp import (
    chirp_frequency,
    newtonian_chirp,
    optimal_snr,
    scale_to_snr,
    time_to_coalescence,
)
from grwu_pipeline.noise import synthetic_psd

FS = 4096
T = np.arange(8 * FS) / FS


def make_chirp():
    return newtonian_chirp(T, merger_time=6.0, chirp_mass=28.0, f_start=20.0, f_end=250.0)


def test_frequency_and_time_to_coalescence_are_inverses():
    for f in (20.0, 60.0, 250.0):
        tau = time_to_coalescence(f, 28.0)
        assert chirp_frequency(np.array([tau]), 28.0)[0] == pytest.approx(f, rel=1e-12)


def test_gw150914_like_chirp_spends_under_a_second_above_20_hz():
    assert 0.5 < time_to_coalescence(20.0, 28.0) < 1.2


def test_chirp_is_zero_outside_its_band():
    h = make_chirp()
    t_first = 6.0 - time_to_coalescence(20.0, 28.0)
    t_last = 6.0 - time_to_coalescence(250.0, 28.0)
    assert np.all(h[T < t_first] == 0)
    assert np.all(h[T > t_last] == 0)
    assert np.any(h != 0)


def test_chirp_sweeps_up_in_frequency():
    h = make_chirp()
    active = np.flatnonzero(h)
    segment = h[active[0] : active[-1] + 1]
    crossings = np.flatnonzero(np.diff(np.signbit(segment)) != 0)
    half_periods = np.diff(crossings) / FS
    frequency = 1 / (2 * half_periods)

    assert 18 < frequency[0] < 23, "starts near f_start"
    assert np.all(np.diff(half_periods) <= 1 / FS), "never slows down (to one-sample jitter)"
    # About 27 cycles in all; the last whole half-cycle is already past 100 Hz.
    assert frequency[-1] > 5 * frequency[0]


def test_scale_to_snr_hits_the_target_and_snr_is_linear():
    h = make_chirp()
    scaled = scale_to_snr(h, FS, synthetic_psd, snr=20.0)
    assert optimal_snr(scaled, FS, synthetic_psd) == pytest.approx(20.0, rel=1e-12)
    assert optimal_snr(2 * scaled, FS, synthetic_psd) == pytest.approx(40.0, rel=1e-12)
