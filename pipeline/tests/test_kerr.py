import pytest

from grwu_pipeline import kerr


@pytest.fixture(scope="module")
def reference():
    return kerr.build()


def test_schwarzschild_modes_match_the_literature(reference):
    # Leaver (1985); Berti, Cardoso & Starinets (2009), Table 2: M omega for s = -2, l = 2.
    known = {"220": (0.37367, 0.08896), "221": (0.34671, 0.27391), "222": (0.30105, 0.47828)}
    for key, (re, im) in known.items():
        mode = reference["modes"][key]
        assert mode["omega_re"][0] == pytest.approx(re, abs=1e-5)
        assert mode["omega_im"][0] == pytest.approx(im, abs=1e-5)


def test_spin_raises_pitch_and_overtones_die_faster(reference):
    modes = reference["modes"]
    for key in modes:
        assert modes[key]["omega_re"] == sorted(modes[key]["omega_re"])
    for i, _ in enumerate(reference["spins"]):
        damping = [modes[key]["omega_im"][i] for key in ("220", "221", "222")]
        assert damping == sorted(damping), "each overtone decays faster than the one before"
