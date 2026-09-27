"""The toy-chirp dataset: a known chirp hidden in LIGO-like noise.

Every parameter is recorded in meta.json, so the dataset doubles as an answer key for tests
and for reader challenges.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from functools import partial
from pathlib import Path
from typing import Any

import numpy as np

from .chirp import newtonian_chirp, optimal_snr, scale_to_snr
from .dataset import write_dataset
from .noise import FloatArray, coloured_noise, synthetic_psd

DATASET_ID = "toy-chirp"


@dataclass(frozen=True)
class ToyChirpConfig:
    seed: int = 150914
    sample_rate: int = 4096
    duration: int = 32
    merger_time: float = 20.3
    """Seconds from the start of the segment."""
    chirp_mass: float = 28.0
    """Solar masses, similar to GW150914."""
    f_start: float = 20.0
    f_end: float = 250.0
    snr: float = 20.0
    snr_f_low: float = 20.0
    noise_f_low: float = 10.0


def generate(config: ToyChirpConfig) -> dict[str, FloatArray]:
    """Returns ``strain`` (noise + injection), ``injection`` and ``noise`` series."""
    n = config.sample_rate * config.duration
    t = np.arange(n) / config.sample_rate
    psd = partial(synthetic_psd, f_low=config.noise_f_low)
    rng = np.random.default_rng(config.seed)
    noise = coloured_noise(n, config.sample_rate, psd, rng)
    chirp = newtonian_chirp(t, config.merger_time, config.chirp_mass, config.f_start, config.f_end)
    injection = scale_to_snr(chirp, config.sample_rate, psd, config.snr, config.snr_f_low)
    return {"strain": noise + injection, "injection": injection, "noise": noise}


def build(out_root: Path, config: ToyChirpConfig | None = None) -> dict[str, Any]:
    """Generates the dataset into ``<out_root>/synthetic/toy-chirp/``."""
    config = config or ToyChirpConfig()
    series = generate(config)
    psd = partial(synthetic_psd, f_low=config.noise_f_low)
    measured_snr = optimal_snr(series["injection"], config.sample_rate, psd, config.snr_f_low)
    meta = {
        "id": DATASET_ID,
        "kind": "synthetic",
        "description": (
            "A leading-order (Newtonian) inspiral chirp injected into stationary Gaussian noise "
            "with the Advanced LIGO design spectrum (analytic fit of Mishra et al. 2010, "
            "arXiv:1005.0304), held flat below noise_f_low. A teaching signal: no merger, "
            "no ringdown, no detector response."
        ),
        "sample_rate": config.sample_rate,
        "duration": config.duration,
        "gps_start": None,
        "injection": {**asdict(config), "optimal_snr": round(measured_snr, 6)},
    }
    return write_dataset(
        out_root / "synthetic" / DATASET_ID,
        meta,
        {"strain": series["strain"], "injection": series["injection"]},
    )
