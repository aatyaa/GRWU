import type { Exercise } from './types';

export const metropolisStep: Exercise = {
  id: 'metropolis-step',
  setup: `import numpy as np

def log_posterior(f):
    """A posterior for a ring's frequency: a bell centred on 250 Hz, 10 Hz wide."""
    return -0.5 * ((f - 250.0) / 10.0) ** 2
`,
  starter: `import numpy as np

def walk(steps, step_size=15.0, start=200.0, seed=1):
    rng = np.random.default_rng(seed)
    current = start
    chain = []
    for _ in range(steps):
        proposal = current + step_size * rng.standard_normal()
        # Accept the proposal with probability min(1, p(proposal) / p(current)).
        accept = ...
        if accept:
            current = proposal
        chain.append(current)
    return np.array(chain)

chain = walk(20000)
print(chain[2000:].mean(), chain[2000:].std())
`,
  solution: `import numpy as np

def walk(steps, step_size=15.0, start=200.0, seed=1):
    rng = np.random.default_rng(seed)
    current = start
    chain = []
    for _ in range(steps):
        proposal = current + step_size * rng.standard_normal()
        accept = np.log(rng.uniform()) < log_posterior(proposal) - log_posterior(current)
        if accept:
            current = proposal
        chain.append(current)
    return np.array(chain)

chain = walk(20000)
print(chain[2000:].mean(), chain[2000:].std())
`,
  wrong: [
    `import numpy as np
def walk(steps, step_size=15.0, start=200.0, seed=1):
    rng = np.random.default_rng(seed)
    current = start
    chain = []
    for _ in range(steps):
        proposal = current + step_size * rng.standard_normal()
        if log_posterior(proposal) > log_posterior(current):
            current = proposal
        chain.append(current)
    return np.array(chain)
`,
    `import numpy as np
def walk(steps, step_size=15.0, start=200.0, seed=1):
    rng = np.random.default_rng(seed)
    current = start
    chain = []
    for _ in range(steps):
        current = current + step_size * rng.standard_normal()
        chain.append(current)
    return np.array(chain)
`,
  ],
  check: `import numpy as np

def check(ns, output):
    walk = ns.get("walk")
    if not callable(walk):
        raise Feedback("Keep the function walk(steps, ...).")
    try:
        chain = np.asarray(walk(20000, seed=5), dtype=float)
    except TypeError:
        raise Feedback("accept is still ... : write the rule that decides whether to move.")
    kept = chain[2000:]
    mean, spread = kept.mean(), kept.std()
    if spread < 2:
        raise Feedback(
            f"Your walk settles at {mean:.1f} Hz and barely moves (spread {spread:.1f} Hz): it only ever climbs. "
            "Moves downhill must sometimes be accepted too, with probability p(proposal) / p(current)."
        )
    if spread > 30 or abs(mean - 250) > 20:
        raise Feedback(
            f"Your walk wanders off (mean {mean:.0f} Hz, spread {spread:.0f} Hz): it accepts everything. "
            "Compare a uniform random number with p(proposal) / p(current)."
        )
    if abs(mean - 250) > 1.5 or abs(spread - 10) > 1.0:
        raise Feedback(f"Close, but the walk's mean {mean:.1f} Hz and spread {spread:.1f} Hz should be near 250 and 10.")
    return f"Right: the walk samples the posterior, mean {mean:.1f} Hz and spread {spread:.1f} Hz, as it should."
`,
  hints: [
    'Uphill moves are always accepted. A downhill move is accepted with probability p(proposal) / p(current), so the walk spends time everywhere in proportion to the posterior.',
    'With logarithms: accept if log(u) < log_posterior(proposal) − log_posterior(current), where u is a uniform random number from rng.uniform().',
    'accept = np.log(rng.uniform()) < log_posterior(proposal) - log_posterior(current)',
  ],
};
