import type { Exercise } from './types';

export const posteriorFile: Exercise = {
  id: 'posterior-file',
  setup: `import numpy as np

# Made-up samples, laid out the way released posteriors are: one row per sample, one
# column per parameter. Not the result of any real analysis.
_rng = np.random.default_rng(150914)
_mass = 55 + _rng.gamma(2.0, 4.0, 4000)
_spin = np.clip(0.69 + 0.05 * _rng.standard_normal(4000), 0, 0.99)
np.savetxt("posterior.csv", np.column_stack([_mass, _spin]), delimiter=",",
           header="final_mass,final_spin", comments="", fmt="%.6f")
del _rng, _mass, _spin
`,
  starter: `import numpy as np

samples = np.genfromtxt("posterior.csv", delimiter=",", names=True)
print(samples.dtype.names)

mass = ...       # the final_mass column, in solar masses
median = ...
lo, hi = ...     # the 90% equal-tailed credible interval
print(f"final mass: {median:.1f} (+{hi - median:.1f} / -{median - lo:.1f})")
`,
  solution: `import numpy as np

samples = np.genfromtxt("posterior.csv", delimiter=",", names=True)
print(samples.dtype.names)

mass = samples["final_mass"]
median = np.median(mass)
lo, hi = np.quantile(mass, [0.05, 0.95])
print(f"final mass: {median:.1f} (+{hi - median:.1f} / -{median - lo:.1f})")
`,
  wrong: [
    `import numpy as np
samples = np.genfromtxt("posterior.csv", delimiter=",", names=True)
mass = samples["final_spin"]
median = np.median(mass)
lo, hi = np.quantile(mass, [0.05, 0.95])
`,
    `import numpy as np
samples = np.genfromtxt("posterior.csv", delimiter=",", names=True)
mass = samples["final_mass"]
median = np.mean(mass)
lo, hi = np.quantile(mass, [0.05, 0.95])
`,
    `import numpy as np
samples = np.genfromtxt("posterior.csv", delimiter=",", names=True)
mass = samples["final_mass"]
median = np.median(mass)
lo, hi = np.percentile(mass, [0.05, 0.95])
`,
    `import numpy as np
samples = np.genfromtxt("posterior.csv", delimiter=",", names=True)
mass = samples["final_mass"]
median = np.median(mass)
lo, hi = np.quantile(mass, [0.1, 0.9])
`,
  ],
  check: `import numpy as np

def check(ns, output):
    for name in ("median", "lo", "hi"):
        if name not in ns:
            raise Feedback(f"Keep the names median, lo and hi; {name} is missing.")
    try:
        median, lo, hi = (float(ns[k]) for k in ("median", "lo", "hi"))
    except TypeError:
        raise Feedback("median, lo or hi is still ... : compute them from the mass column.")
    data = np.genfromtxt("posterior.csv", delimiter=",", names=True)
    mass, spin = data["final_mass"], data["final_spin"]
    right = (np.median(mass), *np.quantile(mass, [0.05, 0.95]))
    if median < 2:
        raise Feedback(
            f"A median of {median:.2f} is a spin, not a mass: pick the column by its name, "
            'samples["final_mass"]. Names are safer than positions, which change between files.'
        )
    if np.isclose(median, np.mean(mass)) and not np.isclose(median, right[0]):
        raise Feedback(
            f"That is the mean, {median:.1f}. This posterior is lopsided, and the median, the value "
            "with half the samples below it, is what releases quote."
        )
    held = np.mean((mass >= lo) & (mass <= hi))
    if np.isclose(median, right[0]) and np.allclose([lo, hi], np.percentile(mass, [0.05, 0.95])):
        raise Feedback(
            f"np.percentile takes percents, 5 and 95, not fractions: your interval sits at the very bottom "
            f"and holds only {held:.1%} of the samples. Use np.quantile with 0.05 and 0.95, or np.percentile "
            "with 5 and 95."
        )
    if np.isclose(median, right[0]) and not np.isclose(held, 0.9, atol=0.005):
        raise Feedback(f"Your interval holds {held:.0%} of the samples; a 90% interval holds 90%, with 5% left out on each side.")
    if not np.allclose([median, lo, hi], right):
        raise Feedback(
            f"Expected a median of {right[0]:.1f} and an interval from {right[1]:.1f} to {right[2]:.1f}; "
            f"you have {median:.1f}, {lo:.1f} to {hi:.1f}."
        )
    return (
        f"Right: the final mass is {median:.1f} (+{hi - median:.1f} / -{median - lo:.1f}) solar masses, "
        "for this made-up posterior. The interval is lopsided because the posterior is."
    )
`,
  hints: [
    'With names=True, each column is reached by its name: samples["final_mass"].',
    'The median is np.median; the 90% equal-tailed interval leaves 5% out on each side: np.quantile(mass, [0.05, 0.95]).',
    'mass = samples["final_mass"]; median = np.median(mass); lo, hi = np.quantile(mass, [0.05, 0.95])',
  ],
};
