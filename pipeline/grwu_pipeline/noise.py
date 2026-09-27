"""Stationary Gaussian noise with the spectrum of an Advanced LIGO detector."""

from __future__ import annotations

from collections.abc import Callable

import numpy as np
from numpy.typing import NDArray

FloatArray = NDArray[np.float64]
PsdFunction = Callable[[FloatArray], FloatArray]

_F0 = 215.0  # Hz
_S0 = 1e-49  # 1/Hz


def aligo_design_psd(f: FloatArray) -> FloatArray:
    """One-sided PSD (1/Hz) of Advanced LIGO at zero-detuned high-power design sensitivity.

    Analytic fit from Mishra, Arun, Iyer & Sathyaprakash (2010), arXiv:1005.0304.
    Meaningful above about 10 Hz; it diverges towards 0 Hz.
    """
    f = np.asarray(f, dtype=np.float64)
    x = f / _F0
    with np.errstate(over="ignore", divide="ignore"):
        return _S0 * (
            10.0 ** (16.0 - 4.0 * (f - 7.9) ** 2)
            + 2.4e-62 * x**-50
            + 0.08 * x**-4.69
            + 123.35 * (1 - 0.23 * x**2 + 0.0764 * x**4) / (1 + 0.17 * x**2)
        )


def synthetic_psd(f: FloatArray, f_low: float = 10.0) -> FloatArray:
    """The design PSD above ``f_low``, held flat below it, and zero at DC.

    Holding the curve flat keeps the seismic wall from swamping the series by orders of
    magnitude, while raw data is still dominated by low frequencies, as real data is.
    """
    f = np.asarray(f, dtype=np.float64)
    psd = aligo_design_psd(np.maximum(f, f_low))
    return np.where(f == 0, 0.0, psd)


def coloured_noise(
    n: int, sample_rate: float, psd: PsdFunction, rng: np.random.Generator
) -> FloatArray:
    """Stationary Gaussian noise of ``n`` samples whose one-sided PSD is ``psd(f)``.

    Built in the frequency domain, so the series is periodic over its length.
    For a real series with DFT X_k, E|X_k|^2 = n * fs * S(f_k) / 2 for 0 < f_k < fs/2,
    and n * fs * S(f_k) at DC and Nyquist, where the coefficient is real.
    """
    freqs = np.fft.rfftfreq(n, d=1.0 / sample_rate)
    power = psd(freqs) * n * sample_rate
    gaussian = rng.standard_normal(freqs.size) + 1j * rng.standard_normal(freqs.size)
    spectrum = np.sqrt(power / 4) * gaussian  # E|gaussian|^2 = 2, so E|X_k|^2 = power / 2
    # Real-valued bins: DC, and Nyquist when n is even.
    spectrum[0] = np.sqrt(power[0]) * rng.standard_normal()
    if n % 2 == 0:
        spectrum[-1] = np.sqrt(power[-1]) * rng.standard_normal()
    return np.fft.irfft(spectrum, n)
