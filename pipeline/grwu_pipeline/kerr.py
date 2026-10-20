"""Exact Kerr quasinormal-mode frequencies that the site's ringdown physics is checked against.

Computed with the qnm package (L. C. Stein, JOSS 4, 1683, 2019), which solves Leaver's
continued fraction for the spin-weight -2 modes of a Kerr black hole to near machine precision.
The site uses the fits of Berti, Cardoso & Will (2006) instead, as ringdown analyses do; its
unit tests check those fits against these values.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import qnm

SPINS = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 0.99]
# (l, m, n): the fundamental quadrupole mode and its first two overtones.
MODES = [(2, 2, 0), (2, 2, 1), (2, 2, 2)]


def build() -> dict[str, Any]:
    modes: dict[str, dict[str, list[float]]] = {}
    for ell, m, n in MODES:
        sequence = qnm.modes_cache(s=-2, l=ell, m=m, n=n)
        omega_re: list[float] = []
        omega_im: list[float] = []
        for chi in SPINS:
            omega, _, _ = sequence(a=chi)
            omega_re.append(float(omega.real))
            # qnm returns omega_re - i * omega_im; store the damping rate as a positive number.
            omega_im.append(float(-omega.imag))
        modes[f"{ell}{m}{n}"] = {"omega_re": omega_re, "omega_im": omega_im}
    return {
        "generator": f"qnm {qnm.__version__}",
        "units": "M * omega, geometric units (G = c = 1); the mode rings as "
        "exp(-omega_im t) cos(omega_re t)",
        "spins": SPINS,
        "modes": modes,
    }


def write(path: Path) -> dict[str, Any]:
    fixtures = build()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(fixtures) + "\n")
    return fixtures
