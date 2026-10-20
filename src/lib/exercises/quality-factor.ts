import type { Exercise } from './types';

export const qualityFactor: Exercise = {
  id: 'quality-factor',
  starter: `import math

def quality_factor(f, tau):
    """Q of a ring with frequency f (in Hz) and damping time tau (in seconds)."""
    return ...

print(quality_factor(250, 0.004))
`,
  solution: `import math

def quality_factor(f, tau):
    """Q of a ring with frequency f (in Hz) and damping time tau (in seconds)."""
    return math.pi * f * tau

print(quality_factor(250, 0.004))
`,
  wrong: [
    'def quality_factor(f, tau):\n    return f * tau\n',
    'import math\ndef quality_factor(f, tau):\n    return math.pi * f / tau\n',
    'def q(f, tau):\n    return 3.14159 * f * tau\n',
  ],
  check: `import math

def check(ns, output):
    q = ns.get("quality_factor")
    if not callable(q):
        raise Feedback("Define a function called quality_factor(f, tau).")
    for f, tau in [(250, 0.004), (60, 0.01), (1000, 0.0005)]:
        got = q(f, tau)
        if got is Ellipsis or got is None:
            raise Feedback("quality_factor still returns nothing: replace ... with the formula.")
        if abs(got - f * tau) < 1e-12:
            raise Feedback("That is f τ, the number of cycles in one damping time. Q is π times it.")
        if abs(got - math.pi * f * tau) > 1e-9 * max(1.0, abs(got)):
            raise Feedback(f"quality_factor({f}, {tau}) gave {got!r}; it should be {math.pi * f * tau:.4g}.")
    return "Right. A 250 Hz ring that fades in 4 ms has Q = π: it lasts about one cycle."
`,
  hints: [
    'Q measures how long a ring lasts, counted in oscillations: the number of cycles in one damping time, times π.',
    'The number of cycles in one damping time is f × tau. Python has π as math.pi.',
    'return math.pi * f * tau',
  ],
};
