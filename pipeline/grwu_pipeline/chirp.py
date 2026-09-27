"""A toy compact-binary chirp and the matched-filter SNR it would have in a detector.

The chirp is the leading-order (Newtonian) inspiral only: no merger, no ringdown and no
detector response. It is a known signal to test and teach with, not a physical waveform.
"""

from __future__ import annotations

import numpy as np

from .noise import FloatArray, PsdFunction

T_SUN = 4.925490947641267e-6
"""G * M_sun / c^3 in seconds."""


def chirp_frequency(tau: FloatArray, chirp_mass: float) -> FloatArray:
    """Gravitational-wave frequency (Hz) a time ``tau`` (s) before coalescence."""
    mc = chirp_mass * T_SUN
    return (5.0 / (256.0 * tau)) ** (3 / 8) * mc ** (-5 / 8) / np.pi


def time_to_coalescence(frequency: float, chirp_mass: float) -> float:
    """Inverse of :func:`chirp_frequency`: seconds left when the signal reaches ``frequency``."""
    mc = chirp_mass * T_SUN
    return 5.0 / 256.0 * (np.pi * frequency) ** (-8 / 3) * mc ** (-5 / 3)


def _half_cosine(n: int) -> FloatArray:
    """Rises smoothly from 0 to 1 over ``n`` samples."""
    return 0.5 * (1 - np.cos(np.pi * np.arange(n) / max(n, 1)))


def newtonian_chirp(
    t: FloatArray,
    merger_time: float,
    chirp_mass: float,
    f_start: float,
    f_end: float,
    phase: float = 0.0,
    taper_start: float = 0.1,
    taper_end: float = 0.004,
) -> FloatArray:
    """Leading-order inspiral h(t) ~ f(t)^(2/3) cos(Phi(t)) between ``f_start`` and ``f_end``.

    ``merger_time`` is the coalescence time on the same clock as ``t``. Amplitude is
    arbitrary; use :func:`scale_to_snr`. Raised-cosine tapers of ``taper_start`` and
    ``taper_end`` seconds soften the edges so the cut-offs do not ring across the spectrum.
    """
    t = np.asarray(t, dtype=np.float64)
    mc = chirp_mass * T_SUN
    tau = merger_time - t
    t_first = merger_time - time_to_coalescence(f_start, chirp_mass)
    t_last = merger_time - time_to_coalescence(f_end, chirp_mass)
    active = (t >= t_first) & (t <= t_last)

    h = np.zeros_like(t)
    tau_a = tau[active]
    frequency = chirp_frequency(tau_a, chirp_mass)
    phi = phase - 2.0 * (5.0 * mc) ** (-5 / 8) * tau_a ** (5 / 8)
    h[active] = frequency ** (2 / 3) * np.cos(phi)

    idx = np.flatnonzero(active)
    if idx.size:
        dt = t[1] - t[0]
        n_start = min(round(taper_start / dt), idx.size)
        n_end = min(round(taper_end / dt), idx.size - n_start)
        h[idx[:n_start]] *= _half_cosine(n_start)
        if n_end:
            h[idx[-n_end:]] *= _half_cosine(n_end)[::-1]
    return h


def optimal_snr(h: FloatArray, sample_rate: float, psd: PsdFunction, f_low: float = 20.0) -> float:
    """Optimal matched-filter SNR of ``h`` in noise with one-sided PSD ``psd``.

    rho^2 = 4 * sum |h~(f)|^2 / S(f) * df over f >= f_low, with h~ = dt * DFT(h).
    """
    n = len(h)
    dt = 1.0 / sample_rate
    freqs = np.fft.rfftfreq(n, d=dt)
    h_tilde = np.fft.rfft(h) * dt
    band = (freqs >= f_low) & (freqs < sample_rate / 2)
    df = sample_rate / n
    return float(np.sqrt(4.0 * np.sum(np.abs(h_tilde[band]) ** 2 / psd(freqs[band])) * df))


def scale_to_snr(
    h: FloatArray, sample_rate: float, psd: PsdFunction, snr: float, f_low: float = 20.0
) -> FloatArray:
    """Rescales ``h`` so its optimal SNR equals ``snr``."""
    return h * (snr / optimal_snr(h, sample_rate, psd, f_low))
