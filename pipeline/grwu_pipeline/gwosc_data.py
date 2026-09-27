"""Real detector strain from the Gravitational Wave Open Science Center (gwosc.org)."""

from __future__ import annotations

import math
import re
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


_FILE_SPAN = re.compile(r"-(\d+)-(\d+)\.hdf5$")


def file_span(url: str) -> tuple[int, int]:
    """(GPS start, duration) from a GWOSC file name like ``L-L1_LOSC_4_V1-1126256640-4096.hdf5``."""
    match = _FILE_SPAN.search(url)
    if match is None:
        raise ValueError(f"not a GWOSC strain file name: {url}")
    return int(match.group(1)), int(match.group(2))


def locate(event: str, detector: str, start: float, end: float, sample_rate: int = 4096) -> str:
    """URL of the shortest GWOSC HDF5 file for ``detector`` that covers [start, end).

    Older events have 32 s files; newer releases only have 4096 s bulk files, which gwosc
    returns as a fallback. Either works, because only the window is read.
    """
    from gwosc.locate import get_event_urls

    urls = get_event_urls(event, detector=detector, sample_rate=sample_rate, format="hdf5")
    covering = [url for url in urls if file_span(url)[0] <= start and end <= sum(file_span(url))]
    if not covering:
        raise LookupError(
            f"no GWOSC {sample_rate} Hz file for {event} {detector} covers GPS {start}-{end}"
        )
    return min(covering, key=lambda url: file_span(url)[1])


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


def read_hdf5(
    path: Path, source: str | None = None, start: float | None = None, end: float | None = None
) -> Strain:
    """Reads GWOSC strain (``strain/Strain`` with Xstart/Xspacing), optionally only [start, end).

    Bulk files can contain NaNs where the detector was not observing, so only the requested
    window has to be free of them.
    """
    with h5py.File(path, "r") as f:
        dataset = f["strain/Strain"]
        file_start = float(dataset.attrs["Xstart"])
        sample_rate = round(1.0 / float(dataset.attrs["Xspacing"]))
        first = 0 if start is None else round((start - file_start) * sample_rate)
        last = len(dataset) if end is None else round((end - file_start) * sample_rate)
        if first < 0 or last > len(dataset) or first >= last:
            raise ValueError(f"{path.name} does not cover GPS {start}-{end}")
        data = np.asarray(dataset[first:last], dtype=np.float64)
    if not np.all(np.isfinite(data)):
        raise ValueError(f"{path.name} has NaNs (data-quality gaps) in the requested window")
    return Strain(
        data=data,
        gps_start=file_start + first / sample_rate,
        sample_rate=sample_rate,
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


def event_window(gps_event: float, duration: int = 32, before: int = 16) -> tuple[int, int]:
    """Whole-second GPS window [start, end) of ``duration`` s with the event ``before`` s in."""
    start = math.floor(gps_event) - before
    return start, start + duration


def fetch_event(
    out_root: Path,
    event: str,
    detectors: list[str],
    cache_dir: Path,
    sample_rate: int = 4096,
    duration: int = 32,
    before: int = 16,
) -> dict[str, Any]:
    """Downloads and exports ``event`` for ``detectors`` (needs network access to gwosc.org)."""
    from gwosc.datasets import event_gps

    gps_event = float(event_gps(event))
    start, end = event_window(gps_event, duration, before)
    strains = {}
    for detector in detectors:
        url = locate(event, detector, start, end, sample_rate)
        path = download(url, cache_dir)
        strains[detector] = read_hdf5(path, source=url, start=start, end=end)
    return write_event(out_root, event, strains, gps_event)
