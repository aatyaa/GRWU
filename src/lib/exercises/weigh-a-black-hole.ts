import type { Exercise } from './types';

/** The fit and constant are those of src/lib/physics/kerr.ts (Berti, Cardoso & Will 2006). */
export const weighABlackHole: Exercise = {
  id: 'weigh-a-black-hole',
  setup: `import math
T_SUN = 4.925490947641267e-6  # G M_sun / c^3, in seconds

def m_omega(chi):
    """M times the angular frequency of the fundamental tone, for spin chi (Berti et al. 2006)."""
    return 1.5251 - 1.1568 * (1 - chi) ** 0.1292
`,
  starter: `def mass_from_ring(f, chi):
    """Mass in solar masses of a black hole of spin chi whose fundamental tone rings at f Hz."""
    omega = ...          # angular frequency, in radians per second
    mass_seconds = ...   # the mass as a time: m_omega(chi) / omega
    return ...           # in solar masses

print(mass_from_ring(250, 0.7))
`,
  solution: `def mass_from_ring(f, chi):
    """Mass in solar masses of a black hole of spin chi whose fundamental tone rings at f Hz."""
    omega = 2 * math.pi * f
    mass_seconds = m_omega(chi) / omega
    return mass_seconds / T_SUN

print(mass_from_ring(250, 0.7))
`,
  wrong: [
    'def mass_from_ring(f, chi):\n    return m_omega(chi) / f / T_SUN\n',
    'def mass_from_ring(f, chi):\n    return m_omega(chi) / (2 * math.pi * f)\n',
    'def mass_from_ring(f, chi):\n    return (2 * math.pi * f) / m_omega(chi) / T_SUN\n',
  ],
  check: `import math

def check(ns, output):
    mass_from_ring = ns.get("mass_from_ring")
    if not callable(mass_from_ring):
        raise Feedback("Define mass_from_ring(f, chi).")
    for mass, chi in [(60, 0.7), (20, 0.0), (140, 0.9)]:
        f = ns["m_omega"](chi) / (2 * math.pi * mass * ns["T_SUN"])
        got = mass_from_ring(f, chi)
        if got is None or got is Ellipsis:
            raise Feedback("mass_from_ring returns nothing yet: fill in the three lines.")
        got = float(got)
        if abs(got / mass - 2 * math.pi) < 1e-6:
            raise Feedback("Off by a factor 2π: the fit gives M times the angular frequency ω = 2π f, not f.")
        if abs(got - mass * ns["T_SUN"]) < 1e-9:
            raise Feedback("That is the mass as a time, in seconds. Divide by T_SUN to get solar masses.")
        if abs(got * mass - 1) < 1e-6 or got < 1e-3 or got > 1e6:
            raise Feedback(f"For a {mass} M☉ black hole you got {got:.4g}. Check the formula: M = m_omega(chi) / ω.")
        if abs(got - mass) > 1e-6 * mass:
            raise Feedback(f"For a {mass} M☉ black hole with spin {chi} you got {got:.4g} M☉.")
    return "Right: from one frequency and a spin you have weighed the black hole."
`,
  hints: [
    'The angular frequency is ω = 2π f. The fit m_omega(chi) is the mass times ω, with the mass measured as a time.',
    'So the mass as a time is m_omega(chi) / ω, in seconds. One solar mass is T_SUN seconds.',
    'return m_omega(chi) / (2 * math.pi * f) / T_SUN',
  ],
};
