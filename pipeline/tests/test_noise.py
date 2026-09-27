import numpy as np
from scipy import signal

from grwu_pipeline.noise import aligo_design_psd, coloured_noise, synthetic_psd


def test_design_curve_has_the_advanced_ligo_shape():
    f = np.linspace(10, 2000, 20000)
    asd = np.sqrt(aligo_design_psd(f))
    best = f[np.argmin(asd)]
    assert 100 < best < 400, "the sensitivity bucket sits at a few hundred Hz"
    assert 2e-24 < asd.min() < 5e-24, "design ASD reaches a few 1e-24 /sqrt(Hz)"
    assert np.all(np.diff(asd[(f >= 10) & (f <= 50)]) < 0), "seismic wall falls with frequency"
    assert asd[-1] > 2 * asd.min(), "shot noise rises at high frequency"


def test_synthetic_psd_is_flat_below_f_low_and_zero_at_dc():
    f = np.array([0.0, 1.0, 5.0, 10.0, 20.0])
    psd = synthetic_psd(f, f_low=10.0)
    assert psd[0] == 0.0
    assert psd[1] == psd[2] == psd[3]
    assert psd[4] < psd[3]


def test_coloured_noise_has_the_requested_spectrum():
    fs, seconds = 4096, 64
    x = coloured_noise(fs * seconds, fs, synthetic_psd, np.random.default_rng(1))
    freqs, estimate = signal.welch(x, fs=fs, nperseg=4 * fs)
    band = (freqs >= 20) & (freqs <= 1500)
    ratio = estimate[band] / synthetic_psd(freqs[band])
    assert abs(np.median(ratio) - 1) < 0.05
    assert abs(np.mean(x)) < 1e-3 * np.std(x)


def test_coloured_noise_is_reproducible_from_the_seed():
    def make(seed):
        return coloured_noise(4096, 4096, synthetic_psd, np.random.default_rng(seed))

    np.testing.assert_array_equal(make(7), make(7))
    assert not np.array_equal(make(7), make(8))
