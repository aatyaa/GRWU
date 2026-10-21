"""Reference outputs for the black-hole physics in Mass, Spin and Nothing Else.

Each value comes from scipy, independently of the site's TypeScript:

- white dwarfs: Chandrasekhar's equilibrium of a cold, fully degenerate electron gas, integrated
  by an adaptive solver with the surface found by event detection, where the site steps the
  same equations with fixed-step Runge-Kutta;
- collapse: the surface of a pressureless star (Oppenheimer and Snyder), integrated from the
  radial geodesic equations, where the site uses the closed-form cycloid and its Schwarzschild
  time;
- Kerr orbits: the innermost stable circular orbit found as the minimum of the orbital energy
  (by root-finding on its derivative, taken by complex step), and the photon orbits as the roots
  of the energy's denominator, where the site uses the closed forms of Bardeen, Press and
  Teukolsky.

Units: white dwarfs in solar masses and kilometres; collapse with r_s = 1 and c = 1; Kerr
orbits with GM/c^2 = 1.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import scipy
from scipy import constants, integrate, optimize

GM_SUN = 1.327_124_4e20  # m^3 s^-2, IAU 2015 nominal, as in src/lib/physics/relativity.ts
MU_E = 2.0  # nucleons per electron: helium, carbon, oxygen
CENTRAL = [0.3, 1.0, 3.0, 10.0, 30.0, 100.0, 1000.0]  # central Fermi momentum, in m_e c
R0 = 4.0  # where the collapsing surface starts at rest, in Schwarzschild radii
COLLAPSE_TAU = [0.0, 2.0, 4.0, 6.0, 8.0, 10.0, 11.0]
SPINS = [0.0, 0.3, 0.6, 0.9, 0.99]


def white_dwarf_units() -> tuple[float, float]:
    """The length (m) and mass (kg) that make Chandrasekhar's equations dimensionless.

    With x the Fermi momentum in m_e c and y = x^2, the pressure is K f(x) with
    K = pi m_e^4 c^5 / (3 h^3) and the density is mu_e m_u x^3 / (3 pi^2 lambda^3), lambda the
    reduced Compton wavelength. Hydrostatic equilibrium then reads
    dy/dr = -A m sqrt(1 + y) / r^2 and dm/dr = B r^2 y^(3/2), and r = L xi, m = B L^3 mu with
    L = 1 / sqrt(A B) remove the constants.
    """
    me, c, h, hbar, g, mu = (
        constants.m_e,
        constants.c,
        constants.h,
        constants.hbar,
        constants.G,
        constants.atomic_mass,
    )
    lam = hbar / (me * c)
    k = np.pi * me**4 * c**5 / (3 * h**3)
    a = g * MU_E * mu / (12 * np.pi**2 * lam**3 * k)
    b = 4 * MU_E * mu / (3 * np.pi * lam**3)
    length = 1 / np.sqrt(a * b)
    return float(length), float(b * length**3)


def _white_dwarf(xc: float) -> tuple[float, float]:
    """Mass (solar masses) and radius (km) of the white dwarf with central Fermi momentum xc."""
    yc = xc * xc

    def rhs(xi: float, s: np.ndarray) -> list[float]:
        y = max(s[0], 0.0)
        return [-s[1] * np.sqrt(1 + y) / xi**2, xi**2 * y**1.5]

    def surface(_: float, s: np.ndarray) -> float:
        return s[0]

    surface.terminal = True  # type: ignore[attr-defined]
    surface.direction = -1  # type: ignore[attr-defined]
    # Start just off the centre on the series solution.
    xi0 = 1e-6
    start = [yc - yc**1.5 * np.sqrt(1 + yc) * xi0**2 / 6, yc**1.5 * xi0**3 / 3]
    solution = integrate.solve_ivp(
        rhs, (xi0, 100.0), start, events=surface, rtol=1e-11, atol=1e-14, method="DOP853"
    )
    length, mass = white_dwarf_units()
    m_sun = GM_SUN / constants.G
    xi_r = solution.t_events[0][0]
    mu_r = solution.y_events[0][0][1]
    return float(mu_r * mass / m_sun), float(xi_r * length / 1e3)


def _collapse() -> dict[str, Any]:
    """The surface of a pressureless star released from rest at R0, with r_s = 1, c = 1.

    Along the radial geodesic, dr/dtau = -sqrt(1/r - 1/R0) and the Schwarzschild time obeys
    dt/dtau = E / (1 - 1/r) with E = sqrt(1 - 1/R0). Near the start 1/r - 1/R0 is a tiny
    difference of two nearly equal numbers, so the depth fallen, w = R0 - r, is followed
    instead: dw/dtau = sqrt(w / (r R0)). The time is followed only outside the horizon, where
    it diverges.
    """
    energy = np.sqrt(1 - 1 / R0)

    def rhs(_: float, s: np.ndarray) -> list[float]:
        w = max(s[0], 0.0)
        r = R0 - w
        return [np.sqrt(w / (r * R0)), energy / (1 - 1 / r)]

    def horizon(_: float, s: np.ndarray) -> float:
        return s[0] - (R0 - 1.0)

    horizon.terminal = True  # type: ignore[attr-defined]
    # Leave rest on the series w = tau^2 / (4 R0^2), t = E tau / (1 - 1/R0).
    tau0 = 1e-4
    start = [tau0**2 / (4 * R0**2), energy * tau0 / (1 - 1 / R0)]
    taus = [t for t in COLLAPSE_TAU if t > 0]
    clocks = integrate.solve_ivp(
        rhs, (tau0, max(taus)), start, t_eval=taus, rtol=1e-12, atol=1e-16, method="DOP853"
    )
    # The depth alone, past the last sample to the horizon, where dt/dtau diverges.
    depth = integrate.solve_ivp(
        lambda tau, s: rhs(tau, [s[0], 0.0])[:1],
        (tau0, 2 * R0**1.5),
        start[:1],
        events=horizon,
        rtol=1e-12,
        atol=1e-16,
        method="DOP853",
    )
    return {
        "r0": R0,
        "tau": [0.0, *taus],
        "r": [R0, *(float(R0 - v) for v in clocks.y[0])],
        "t": [0.0, *(float(v) for v in clocks.y[1])],
        "tau_horizon": float(depth.t_events[0][0]),
        "tau_centre": _time_to_centre(),
    }


def _time_to_centre() -> float:
    """Proper time from rest at R0 to r = 0: with r = R0 - u^2 the integrand of
    dtau = dr / sqrt(1/r - 1/R0) becomes 2 sqrt(R0 (R0 - u^2)), smooth on [0, sqrt(R0)]."""
    value, _ = integrate.quad(
        lambda u: 2 * np.sqrt(R0 * (R0 - u * u)), 0.0, np.sqrt(R0), epsabs=1e-14, epsrel=1e-13
    )
    return float(value)


def _energy(r: complex, a: float) -> complex:
    """Energy per unit mass of a prograde circular equatorial Kerr orbit (a < 0: retrograde)."""
    s = np.sqrt(r)
    return (r * s - 2 * s + a) / (r**0.75 * np.sqrt(r * s - 3 * s + 2 * a))


def _photon_orbit(a: float) -> float:
    """Where the circular-orbit energy diverges: r^(3/2) - 3 r^(1/2) + 2a = 0, outside r = 1."""
    return float(optimize.brentq(lambda r: r**1.5 - 3 * np.sqrt(r) + 2 * a, 1.0 + 1e-12, 4.0))


def _isco(a: float) -> float:
    """The innermost stable circular orbit: the minimum of the orbit's energy."""
    step = 1e-30

    def slope(r: float) -> float:
        return float(np.imag(_energy(r + 1j * step, a)) / step)

    return float(optimize.brentq(slope, _photon_orbit(a) + 1e-6, 12.0, xtol=1e-14, rtol=1e-15))


def _kerr(chi: float) -> dict[str, Any]:
    roots = np.roots([1.0, -2.0, chi * chi])
    outer = float(max(roots.real))
    inner = float(min(roots.real))
    pro = _isco(chi)
    retro = _isco(-chi)
    return {
        "chi": chi,
        "r_plus": outer,
        "r_minus": inner,
        "isco_pro": pro,
        "isco_retro": retro,
        "photon_pro": _photon_orbit(chi),
        "photon_retro": _photon_orbit(-chi),
        "efficiency_pro": float(1 - np.real(_energy(pro, chi))),
        # The irreducible mass, from the horizon area A = 8 pi (M r+): M_irr = sqrt(A / 16 pi).
        "extractable": float(1 - np.sqrt(8 * np.pi * outer / (16 * np.pi))),
    }


def build() -> dict[str, Any]:
    length, mass = white_dwarf_units()
    dwarfs = [_white_dwarf(xc) for xc in CENTRAL]
    return {
        "generator": f"numpy {np.__version__}, scipy {scipy.__version__}",
        "white_dwarf": {
            "mu_e": MU_E,
            "length_km": length / 1e3,
            "mass_unit_sun": mass / (GM_SUN / constants.G),
            "x_central": CENTRAL,
            "mass_sun": [m for m, _ in dwarfs],
            "radius_km": [r for _, r in dwarfs],
        },
        "collapse": _collapse(),
        "kerr": [_kerr(chi) for chi in SPINS],
    }


def write(path: Path) -> dict[str, Any]:
    fixtures = build()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(fixtures) + "\n")
    return fixtures
