"""The on-disk format the site loads: raw float32 channels plus one meta.json.

Samples are stored little-endian float32, divided by ``scale`` (physical = stored * scale).
Strain of order 1e-21 is thereby stored near 1, where float32 (and WebGPU's f32) keeps full
precision and squared values stay far from underflow.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import numpy as np

from .noise import FloatArray

SCHEMA_VERSION = 1
DEFAULT_SCALE = 1e-21


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_dataset(
    out_dir: Path,
    meta: dict[str, Any],
    channels: dict[str, FloatArray],
    scale: float = DEFAULT_SCALE,
) -> dict[str, Any]:
    """Writes each channel to ``<name>.f32`` and a ``meta.json`` describing them all."""
    if not channels:
        raise ValueError("a dataset needs at least one channel")
    lengths = {len(data) for data in channels.values()}
    if len(lengths) != 1:
        raise ValueError(f"channels differ in length: {sorted(lengths)}")

    out_dir.mkdir(parents=True, exist_ok=True)
    files: dict[str, dict[str, str]] = {}
    for name, data in channels.items():
        stored = (np.asarray(data, dtype=np.float64) / scale).astype("<f4")
        if not np.all(np.isfinite(stored)):
            raise ValueError(f"channel {name!r} has non-finite samples after scaling")
        payload = stored.tobytes()
        filename = f"{name}.f32"
        (out_dir / filename).write_bytes(payload)
        files[name] = {"file": filename, "sha256": sha256(payload)}

    full_meta = {
        "schema": SCHEMA_VERSION,
        **meta,
        "n_samples": lengths.pop(),
        "dtype": "float32",
        "byte_order": "little",
        "scale": scale,
        "channels": files,
    }
    (out_dir / "meta.json").write_text(json.dumps(full_meta, indent=2) + "\n")
    return full_meta


def read_meta(out_dir: Path) -> dict[str, Any]:
    return json.loads((out_dir / "meta.json").read_text())


def read_channel(out_dir: Path, name: str, verify: bool = True) -> FloatArray:
    """Loads one channel in physical units (float64)."""
    meta = read_meta(out_dir)
    entry = meta["channels"][name]
    payload = (out_dir / entry["file"]).read_bytes()
    if verify and sha256(payload) != entry["sha256"]:
        raise ValueError(f"checksum mismatch for {entry['file']}")
    return np.frombuffer(payload, dtype="<f4").astype(np.float64) * meta["scale"]
