import numpy as np
import pytest

from grwu_pipeline import relativity


def test_orbit_shift_approaches_the_weak_field_formula():
    # Far from the hole the advance per orbit tends to 6 pi GM / (c^2 p) = 3 pi r_s / p.
    p = 1.0e5
    assert relativity._orbit_shift(p, 0.2056) == pytest.approx(3 * np.pi / p, rel=1e-4)


def test_orbit_shift_grows_faster_than_the_formula_close_in():
    assert relativity._orbit_shift(14.0, 0.2) > 1.3 * 3 * np.pi / 14.0


def test_infall_reaches_the_centre_at_the_free_fall_time():
    # Released from rest at r = 1 with GM = 1, a body reaches r = 0 at t = (pi / 2) sqrt(1 / 2).
    t_ff = np.pi / 2 * np.sqrt(0.5)
    (r,) = relativity._infall([t_ff - 1e-4])
    assert 0 < r < 0.01


def test_light_bending_tends_to_twice_the_newtonian_value():
    b = 1.0e6
    assert relativity._deflection(b) == pytest.approx(2.0 / b, rel=1e-5)
