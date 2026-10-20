import type { Exercise } from './types';

export const credibleInterval: Exercise = {
  id: 'credible-interval',
  setup: `import numpy as np
# 4000 posterior samples of a black hole's damping time, in milliseconds: lopsided, as they often are.
samples = 2.0 + np.random.default_rng(3).gamma(2.0, 1.0, 4000)
`,
  starter: `import numpy as np

# samples holds 4000 draws from a posterior.
median = np.median(samples)
lo, hi = ..., ...   # the 90% equal-tailed credible interval
print(f"{median:.2f} ms, 90% interval {lo:.2f} to {hi:.2f}")
`,
  solution: `import numpy as np

median = np.median(samples)
lo, hi = np.quantile(samples, [0.05, 0.95])
print(f"{median:.2f} ms, 90% interval {lo:.2f} to {hi:.2f}")
`,
  wrong: [
    'import numpy as np\nlo, hi = np.quantile(samples, [0.1, 0.9])\n',
    'import numpy as np\nm, s = samples.mean(), samples.std()\nlo, hi = m - 1.645 * s, m + 1.645 * s\n',
    'import numpy as np\nlo, hi = samples.min(), samples.max()\n',
  ],
  check: `import numpy as np

def check(ns, output):
    lo, hi = ns.get("lo"), ns.get("hi")
    if lo is Ellipsis or hi is Ellipsis or lo is None or hi is None:
        raise Feedback("Set lo and hi, the ends of the interval.")
    s = ns["samples"]
    want = np.quantile(s, [0.05, 0.95])
    inside = float(np.mean((s >= lo) & (s <= hi)))
    if np.allclose([lo, hi], want, rtol=0, atol=1e-9):
        return "Right: 5% of the samples lie below lo and 5% above hi."
    if abs(inside - 0.8) < 0.01:
        raise Feedback(f"Your interval holds {inside:.0%} of the samples. A 90% interval leaves 5% on each side: the 5th and 95th percentiles.")
    if np.allclose([lo, hi], [s.min(), s.max()]):
        raise Feedback("That is the whole range of the samples. A 90% interval leaves out the most extreme 10%.")
    if abs(inside - 0.9) < 0.02:
        raise Feedback(
            f"Your interval holds {inside:.0%} of the samples, but it is placed by a formula for a symmetric bell. "
            "This posterior is lopsided: read the 5th and 95th percentiles off the samples themselves."
        )
    raise Feedback(f"Your interval holds {inside:.0%} of the samples; a 90% interval holds 90%, with 5% on each side.")
`,
  hints: [
    'With samples, an interval is just a pair of percentiles: the value below which 5% of them fall, and the value below which 95% fall.',
    'np.quantile(samples, q) returns the value below which a fraction q of the samples lie.',
    'lo, hi = np.quantile(samples, [0.05, 0.95])',
  ],
};
