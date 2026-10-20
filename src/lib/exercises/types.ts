/**
 * A coding exercise (ADR 0010): what the reader starts from, what a right answer looks like,
 * and how it is checked. The unit tests run `solution` (it must pass) and every `wrong` answer
 * (each must fail with feedback) through the same runner the reader uses.
 */
export interface Exercise {
  id: string;
  /** Hidden code run before the reader's: data and helpers. */
  setup?: string;
  starter: string;
  solution: string;
  /** Plausible mistakes; the checker must turn each down with a message. */
  wrong: string[];
  /** Python defining `check(ns, output)`: raise Feedback(message) when the answer is not right. */
  check: string;
  /** Revealed one at a time, from a nudge to nearly the answer. */
  hints: string[];
}
