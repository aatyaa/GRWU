"""Reference outputs from numpy/scipy that the site's TypeScript DSP must reproduce.

Conventions are scipy's defaults, which the TypeScript code follows exactly:
periodic Hann windows, constant detrend per segment, one-sided density-scaled PSDs.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import scipy
from scipy import signal

from .noise import aligo_design_psd

SEED = 20150914
DESIGN_FREQS = [10.0, 15.0, 20.0, 50.0, 100.0, 215.0, 500.0, 1000.0, 2000.0]


def _floats(values: np.ndarray) -> list[float]:
    return [float(v) for v in np.asarray(values).ravel()]


def build() -> dict[str, Any]:
    rng = np.random.default_rng(SEED)

    fft_input = rng.standard_normal(64)
    spectrum = np.fft.rfft(fft_input)

    fs = 256.0
    n = 2048
    t = np.arange(n) / fs
    # White noise plus a 40 Hz line, so the PSD has a feature to match.
    welch_input = rng.standard_normal(n) + 0.5 * np.sin(2 * np.pi * 40.0 * t)
    welch_args = {"fs": fs, "window": "hann", "nperseg": 256, "noverlap": 128}
    freqs, psd_mean = signal.welch(welch_input, average="mean", **welch_args)
    _, psd_median = signal.welch(welch_input, average="median", **welch_args)

    # Whitening and the matched filter, written independently of the TypeScript: a complex
    # inverse FFT here where the site uses two real ones, one per quadrature.
    ffs = 256.0
    fn = 1024
    dt = 1.0 / ffs
    df = ffs / fn
    ft = np.arange(fn) / ffs
    band = (8.0, 100.0)
    rfreqs = np.fft.rfftfreq(fn, dt)
    filter_psd = 0.01 * (1.0 + (20.0 / np.maximum(rfreqs, 1.0)) ** 4)
    mask = (rfreqs >= band[0]) & (rfreqs <= band[1]) & (rfreqs > 0) & (rfreqs < ffs / 2)
    template = np.exp(-(((ft - 1.0) / 0.1) ** 2)) * np.cos(2 * np.pi * 40.0 * (ft - 1.0))
    data = 3.0 * np.roll(template, 512) + rng.standard_normal(fn)
    spec = np.fft.rfft(data)
    white_spec = np.where(mask, spec / np.sqrt(filter_psd * ffs / 2), 0)
    whitened = np.fft.irfft(white_spec, fn)
    h_tilde = np.fft.rfft(template)
    sigma = np.sqrt(4.0 * np.sum(np.abs(h_tilde[mask]) ** 2 / filter_psd[mask]) * dt * dt * df)
    full = np.zeros(fn, dtype=complex)
    full[: len(rfreqs)] = np.where(mask, spec * np.conj(h_tilde) / filter_psd, 0)
    z = 4.0 * dt * dt * df * fn * np.fft.ifft(full)
    snr = np.abs(z) / sigma

    return {
        "generator": f"numpy {np.__version__}, scipy {scipy.__version__}",
        "rfft": {
            "input": _floats(fft_input),
            "re": _floats(spectrum.real),
            "im": _floats(spectrum.imag),
        },
        "windows": {
            "n": 16,
            "hann_periodic": _floats(signal.get_window("hann", 16, fftbins=True)),
            "hann_symmetric": _floats(signal.windows.hann(16, sym=True)),
        },
        "aligo_design_psd": {
            "freqs": DESIGN_FREQS,
            "psd": _floats(aligo_design_psd(np.array(DESIGN_FREQS))),
        },
        "welch": {
            "sample_rate": fs,
            "nperseg": welch_args["nperseg"],
            "noverlap": welch_args["noverlap"],
            "window": "hann (periodic)",
            "detrend": "constant",
            "scaling": "density, one-sided",
            "input": _floats(welch_input),
            "freqs": _floats(freqs),
            "psd_mean": _floats(psd_mean),
            "psd_median": _floats(psd_median),
        },
        "filter": {
            "sample_rate": ffs,
            "f_low": band[0],
            "f_high": band[1],
            "freqs": _floats(rfreqs),
            "psd": _floats(filter_psd),
            "data": _floats(data),
            "template": _floats(template),
            "whitened": _floats(whitened),
            "optimal_snr": float(sigma),
            "snr": _floats(snr),
        },
    }


def write(path: Path) -> dict[str, Any]:
    fixtures = build()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(fixtures) + "\n")
    return fixtures
