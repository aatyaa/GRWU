"""Real detector strain from the Gravitational Wave Open Science Center (gwosc.org)."""

from __future__ import annotations

import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import h5py
import numpy as np

from .dataset import write_dataset
from .noise import FloatArray

LICENSE = "CC-BY-4.0"
ATTRIBUTION = (
    "This research has made use of data or software obtained from the Gravitational Wave "
    "Open Science Center (gwosc.org), a service of the LIGO Scientific Collaboration, the "
    "Virgo Collaboration, and KAGRA."
)
ACKNOWLEDGEMENT_URL = "https://gwosc.org/acknowledgement/"


@dataclass(frozen=True)
class Strain:
    data: FloatArray
    gps_start: float
    sample_rate: int
    source: str


def locate(event: str, detector: str, sample_rate: int = 4096, duration: int = 32) -> str:
    """URL of the GWOSC HDF5 strain file around ``event`` for one detector."""
    from gwosc.locate import get_event_urls

    urls = get_event_urls(
        event, detector=detector, sample_rate=sample_rate, format="hdf5", duration=duration
    )
    if not urls:
        raise LookupError(f"GWOSC has no {duration} s {sample_rate} Hz file for {event} {detector}")
    return urls[0]


def download(url: str, cache_dir: Path) -> Path:
    """Downloads ``url`` into ``cache_dir`` once and returns the local path."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    target = cache_dir / url.rsplit("/", 1)[-1]
    if not target.exists():
        request = urllib.request.Request(url, headers={"User-Agent": "grwu-pipeline"})
        with urllib.request.urlopen(request, timeout=120) as response:
            partial = target.with_suffix(target.suffix + ".part")
            partial.write_bytes(response.read())
            partial.rename(target)
    return target


def read_hdf5(path: Path, source: str | None = None) -> Strain:
    """Reads a GWOSC strain file (``strain/Strain`` with Xstart/Xspacing attributes)."""
    with h5py.File(path, "r") as f:
        dataset = f["strain/Strain"]
        data = np.asarray(dataset[()], dtype=np.float64)
        gps_start = float(dataset.attrs["Xstart"])
        spacing = float(dataset.attrs["Xspacing"])
    if not np.all(np.isfinite(data)):
        raise ValueError(f"{path.name} contains NaNs (data-quality gaps); pick another segment")
    return Strain(
        data=data,
        gps_start=gps_start,
        sample_rate=round(1.0 / spacing),
        source=source or path.name,
    )


def write_event(
    out_root: Path, event: str, strains: dict[str, Strain], gps_event: float
) -> dict[str, Any]:
    """Writes detectors' strain for one event into ``<out_root>/events/<event>/``."""
    first = next(iter(strains.values()))
    for detector, strain in strains.items():
        if (strain.gps_start, strain.sample_rate, len(strain.data)) != (
            first.gps_start,
            first.sample_rate,
            len(first.data),
        ):
            raise ValueError(f"{detector} does not cover the same span as the other detectors")

    meta = {
        "id": event,
        "kind": "event",
        "description": f"Strain around {event} from GWOSC, one channel per detector.",
        "sample_rate": first.sample_rate,
        "duration": len(first.data) / first.sample_rate,
        "gps_start": first.gps_start,
        "gps_event": gps_event,
        "sources": {detector: strain.source for detector, strain in strains.items()},
        "license": LICENSE,
        "attribution": ATTRIBUTION,
        "acknowledgement": ACKNOWLEDGEMENT_URL,
    }
    return write_dataset(
        out_root / "events" / event,
        meta,
        {detector: strain.data for detector, strain in strains.items()},
    )


def fetch_event(
    out_root: Path,
    event: str,
    detectors: list[str],
    cache_dir: Path,
    sample_rate: int = 4096,
    duration: int = 32,
) -> dict[str, Any]:
    """Downloads and exports ``event`` for ``detectors`` (needs network access to gwosc.org)."""
    from gwosc.datasets import event_gps

    strains = {}
    for detector in detectors:
        url = locate(event, detector, sample_rate, duration)
        strains[detector] = read_hdf5(download(url, cache_dir), source=url)
    return write_event(out_root, event, strains, float(event_gps(event)))
