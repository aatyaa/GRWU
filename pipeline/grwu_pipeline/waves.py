"""Reference outputs for the horizons, waves and mergers in Only Ever Forwards.

Each value is computed here independently of the site's TypeScript:

- horizon thermodynamics: the Kerr horizon radii from the roots of r^2 - 2r + a^2, the area as
  4 pi (r+^2 + a^2), the surface gravity as (r+ - r-) / 2 (r+^2 + a^2), the angular velocity as
  a / (r+^2 + a^2), and entropy and temperature in SI from scipy.constants;
- the remnant of two non-spinning holes, from LALSuite's own implementation of the UIB2016
  fits (lalinference.imrtgr.nrutils), which the site transcribes;
- the toy of well-posedness: every Fourier mode advanced by scipy's matrix exponential of
  -ikAt, where the site uses the closed forms of the two systems.

Units: Kerr quantities with GM/c^2 = 1, entropy in k_B, temperature in kelvin.
"""

from __future__ import annotations

import json
from importlib.metadata import version
from pathlib import Path
from typing import Any

import numpy as np
import scipy
from lalinference.imrtgr import nrutils
from scipy import constants, linalg

GM_SUN = 1.327_124_4e20  # m^3 s^-2, IAU 2015 nominal, as in src/lib/physics/relativity.ts
SPINS = [0.0, 0.3, 0.6, 0.69, 0.9, 0.99]
MASSES_SUN = [1e-8, 1.0, 62.7, 4.3e6]
RATIOS = [1.0, 0.8, 0.5, 1 / 3, 0.25, 0.1, 0.05]
SYSTEMS = {
    "weak": np.array([[1.0, 1.0], [0.0, 1.0]]),
    "strong": np.array([[1.0, 1.0], [0.0, -1.0]]),
}
GRIDS = [16, 64, 256]
TIMES = [0.0, 1.0, 5.0, 20.0]


def _kerr(chi: float) -> dict[str, float]:
    roots = np.roots([1.0, -2.0, chi * chi])
    outer, inner = float(max(roots.real)), float(min(roots.real))
    span = outer * outer + chi * chi
    return {
        "chi": chi,
        "area": float(4 * np.pi * span),
        "kappa": float((outer - inner) / (2 * span)),
        "omega": float(chi / span),
    }


def _hole(mass_sun: float) -> dict[str, float]:
    """Entropy and temperature of a non-spinning hole, from its area and surface gravity."""
    g, c, hbar, k = constants.G, constants.c, constants.hbar, constants.k
    mass = mass_sun * GM_SUN / g
    length = g * mass / c**2
    area = 16 * np.pi * length**2
    kappa = c**2 / (4 * length)
    return {
        "mass_sun": mass_sun,
        "entropy": float(area * c**3 / (4 * g * hbar)),
        "temperature": float(hbar * kappa / (2 * np.pi * c * k)),
    }


def _remnant(q: float) -> dict[str, float]:
    m1, m2 = 1.0, q
    total = m1 + m2
    mass = float(nrutils.bbh_final_mass_non_precessing_UIB2016(m1, m2, 0.0, 0.0, version="v2"))
    spin = float(nrutils.bbh_final_spin_non_precessing_UIB2016(m1, m2, 0.0, 0.0, version="v2"))
    return {"q": q, "final_mass": mass / total, "final_spin": spin}


def _amplification(system: str, n: int, t: float) -> float:
    """Root-mean-square growth of an error of 1 + 0i in both components of every mode."""
    a = SYSTEMS[system]
    start = np.array([1.0, 1.0], dtype=complex)
    now = 0.0
    for k in range(-n // 2 + 1, n // 2 + 1):
        u = linalg.expm(-1j * k * t * a) @ start
        now += float(np.vdot(u, u).real)
    return float(np.sqrt(now / (2 * n)))


def build() -> dict[str, Any]:
    return {
        "generator": (
            f"numpy {np.__version__}, scipy {scipy.__version__}, lalsuite {version('lalsuite')}"
        ),
        "kerr": [_kerr(chi) for chi in SPINS],
        "holes": [_hole(m) for m in MASSES_SUN],
        "remnant": [_remnant(q) for q in RATIOS],
        "amplification": [
            {"system": s, "n": n, "t": t, "growth": _amplification(s, n, t)}
            for s in SYSTEMS
            for n in GRIDS
            for t in TIMES
        ],
    }


def write(path: Path) -> dict[str, Any]:
    fixtures = build()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(fixtures) + "\n")
    return fixtures
