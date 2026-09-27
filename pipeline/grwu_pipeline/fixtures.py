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

SEED = 20150914


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
    }


def write(path: Path) -> dict[str, Any]:
    fixtures = build()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(fixtures) + "\n")
    return fixtures
