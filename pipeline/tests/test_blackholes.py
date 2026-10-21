import numpy as np
import pytest

from grwu_pipeline import blackholes


def test_white_dwarfs_approach_the_chandrasekhar_mass():
    # For mu_e = 2 the limit is 5.83 / mu_e^2 solar masses, about 1.46.
    mass, radius = blackholes._white_dwarf(1.0e4)
    assert mass == pytest.approx(1.457, abs=0.002)
    assert radius < 10.0


def test_a_typical_white_dwarf_is_the_size_of_the_earth():
    masses, radii = zip(*(blackholes._white_dwarf(x) for x in (0.8, 1.0, 1.2)), strict=True)
    assert 0.4 < masses[1] < 0.7
    assert 6000 < radii[1] < 12000


def test_collapse_reaches_the_horizon_and_the_centre_when_the_cycloid_says():
    data = blackholes._collapse()
    r0 = data["r0"]
    # r = (R0/2)(1 + cos eta), tau = (R0/2) sqrt(R0) (eta + sin eta), with r_s = 1.
    eta = 2 * np.pi / 3
    crossing = r0 / 2 * np.sqrt(r0) * (eta + np.sin(eta))
    assert data["tau_horizon"] == pytest.approx(crossing, rel=1e-8)
    assert data["tau_centre"] == pytest.approx(np.pi / 2 * r0**1.5, rel=1e-12)


def test_kerr_orbits_reduce_to_schwarzschild_and_tighten_with_spin():
    still = blackholes._kerr(0.0)
    assert still["isco_pro"] == pytest.approx(6.0, abs=1e-9)
    assert still["photon_pro"] == pytest.approx(3.0, abs=1e-9)
    assert still["efficiency_pro"] == pytest.approx(1 - np.sqrt(8 / 9), abs=1e-12)
    fast = blackholes._kerr(0.99)
    assert fast["isco_pro"] < 1.5 < 8.9 < fast["isco_retro"]
