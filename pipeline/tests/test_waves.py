import numpy as np
import pytest

from grwu_pipeline import waves


def test_a_still_hole_has_area_16_pi_and_surface_gravity_one_quarter():
    still = waves._kerr(0.0)
    assert still["area"] == pytest.approx(16 * np.pi, rel=1e-12)
    assert still["kappa"] == pytest.approx(0.25, rel=1e-12)
    assert still["omega"] == 0.0


def test_kerr_holes_obey_smarr():
    # M = 2 Omega J + kappa A / 4 pi, with M = 1 and J = chi.
    for chi in waves.SPINS:
        hole = waves._kerr(chi)
        assert 2 * hole["omega"] * chi + hole["kappa"] * hole["area"] / (4 * np.pi) == (
            pytest.approx(1.0, rel=1e-12)
        )


def test_a_solar_mass_hole_is_at_sixty_nanokelvin_with_entropy_ten_to_the_77():
    sun = waves._hole(1.0)
    assert sun["temperature"] == pytest.approx(6.17e-8, rel=0.01)
    assert 1.0e77 < sun["entropy"] < 1.1e77


def test_equal_masses_leave_a_hole_of_0_95_spinning_at_0_69():
    # SXS:BBH:0001 (Scheel et al. 2009): 0.95162 and 0.68646.
    equal = waves._remnant(1.0)
    assert equal["final_mass"] == pytest.approx(0.9516, abs=2e-4)
    assert equal["final_spin"] == pytest.approx(0.6865, abs=2e-4)


def test_the_weak_system_amplifies_errors_more_on_finer_grids():
    weak = [waves._amplification("weak", n, 5.0) for n in waves.GRIDS]
    strong = [waves._amplification("strong", n, 5.0) for n in waves.GRIDS]
    assert weak[0] < weak[1] < weak[2]
    assert max(strong) < np.sqrt(2.5) + 1e-12
