"""Reference outputs for the relativity behind The Straightest Path.

Each value comes from scipy, independently of the site's TypeScript: the Schwarzschild orbit
equation integrated by an adaptive solver with event detection where the site steps it with
fixed-step Runge-Kutta, Newtonian radial infall integrated where the site uses the cycloid in
closed form, and the exact bending of light by quadrature where the site uses the weak-field
formula. Lengths are in units of the Schwarzschild radius (orbits, light) or of the starting
radius with GM = 1 (infall).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import scipy
from scipy import integrate

# Semi-latus rectum and eccentricity of the orbits, in Schwarzschild radii. The last is Mercury.
ORBITS = [(14.0, 0.2), (20.0, 0.2056), (40.0, 0.5), (100.0, 0.2056), (1.0e4, 0.2056)]
INFALL_TIMES = [0.0, 0.25, 0.5, 0.75, 1.0, 1.1]
IMPACT = [20.0, 100.0, 2.355_7e5]


def _orbit_shift(p: float, e: float) -> float:
    """Advance of the perihelion per orbit, in radians.

    u = r_s / r obeys u'' + u = 1/p + (3/2) u^2 for a Schwarzschild geodesic. Start at
    perihelion, u = (1 + e) / p with u' = 0, and find the next perihelion: the next time u'
    crosses zero going down, which is a maximum of u.
    """

    def rhs(_: float, y: np.ndarray) -> list[float]:
        return [y[1], 1.0 / p + 1.5 * y[0] ** 2 - y[0]]

    def perihelion(_: float, y: np.ndarray) -> float:
        return y[1]

    perihelion.direction = -1  # type: ignore[attr-defined]
    solution = integrate.solve_ivp(
        rhs,
        (0.0, 6 * np.pi),
        [(1 + e) / p, 0.0],
        events=perihelion,
        rtol=1e-12,
        atol=1e-14,
        method="DOP853",
    )
    # The start itself is an event at phi = 0; the next one is a full orbit later.
    later = [phi for phi in solution.t_events[0] if phi > 1.0]
    return float(later[0] - 2 * np.pi)


def _infall(times: list[float]) -> list[float]:
    """Radius against time for a body released from rest at r = 1, with GM = 1."""
    solution = integrate.solve_ivp(
        lambda _, y: [y[1], -1.0 / y[0] ** 2],
        (0.0, max(times)),
        [1.0, 0.0],
        t_eval=times,
        rtol=1e-12,
        atol=1e-14,
        method="DOP853",
    )
    return [float(r) for r in solution.y[0]]


def _deflection(b: float) -> float:
    """Exact bending of a light ray with impact parameter b, in radians.

    With u = r_s / r the ray obeys (du/dphi)^2 = 1/b^2 - u^2 (1 - u); the closest approach
    u0 is the root of the right side, and the total sweep is twice the integral up to it.
    Substituting u = u0 (1 - t^2) removes the square-root singularity at the turning point.
    """
    w = 1.0 / b
    # Closest approach: the smallest positive root of u^2 (1 - u) = w^2.
    roots = np.roots([-1.0, 1.0, 0.0, -(w**2)])
    u0 = float(min(r.real for r in roots if abs(r.imag) < 1e-12 and r.real > 0))

    def integrand(t: float) -> float:
        u = u0 * (1 - t * t)
        rest = w**2 - u * u * (1 - u)
        return 2 * u0 * t / np.sqrt(rest) if rest > 0 else 0.0

    sweep, _ = integrate.quad(integrand, 0.0, 1.0, epsabs=1e-15, epsrel=1e-13, limit=200)
    return float(2 * sweep - np.pi)


def build() -> dict[str, Any]:
    return {
        "generator": f"numpy {np.__version__}, scipy {scipy.__version__}",
        "orbits": [{"p": p, "e": e, "shift": _orbit_shift(p, e)} for p, e in ORBITS],
        "infall": {"r0": 1.0, "gm": 1.0, "t": INFALL_TIMES, "r": _infall(INFALL_TIMES)},
        "deflection": [{"b": b, "angle": _deflection(b)} for b in IMPACT],
    }


def write(path: Path) -> dict[str, Any]:
    fixtures = build()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(fixtures) + "\n")
    return fixtures
