"""Where outputs go inside the repository."""

from __future__ import annotations

from pathlib import Path


def find_repo_root(start: Path | None = None) -> Path:
    """The nearest ancestor of ``start`` (default: cwd) that holds astro.config.mjs."""
    here = (start or Path.cwd()).resolve()
    for candidate in (here, *here.parents):
        if (candidate / "astro.config.mjs").is_file():
            return candidate
    raise FileNotFoundError("run this from inside the GRWU repository")


def public_data(root: Path) -> Path:
    return root / "public" / "data"


def fixtures_file(root: Path) -> Path:
    return root / "tests" / "fixtures" / "dsp.json"
