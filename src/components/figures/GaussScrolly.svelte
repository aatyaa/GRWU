<script lang="ts">
  import { onMount } from 'svelte';
  import { Tween } from 'svelte/motion';
  import { cubicInOut } from 'svelte/easing';
  import { scrollySteps } from '~/lib/state';
  import { fitLine, sumOfSquares, type Line } from '~/lib/stats/estimators';
  import { gaussian, mulberry32 } from '~/lib/stats/random';

  interface Props {
    /** The id of the <Scrolly> section driving this figure. */
    id: string;
  }
  let { id }: Props = $props();

  // Seven observations of a slow drift, each slightly wrong (the same sample as the playground).
  const X_MAX = 9.5;
  const Y_MIN = -0.3;
  const Y_UNITS = 5;
  const draw = gaussian(mulberry32(1801));
  const xs = [0.8, 2.1, 3.4, 4.7, 6.0, 7.3, 8.6];
  const ys = xs.map((x) => 0.36 * x + 0.9 + 0.55 * draw());
  const best = fitLine(xs, ys);
  const guess: Line = { slope: -0.08, intercept: 3.1 };

  let step = $state(0);
  onMount(() => scrollySteps.subscribe((steps) => (step = steps[id] ?? 0)));

  const reduce =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = { duration: reduce ? 0 : 1100, easing: cubicInOut };
  const left = new Tween(guess.intercept, motion);
  const right = new Tween(guess.intercept + guess.slope * X_MAX, motion);
  $effect(() => {
    const line = step >= 4 ? best : guess;
    left.target = line.intercept;
    right.target = line.intercept + line.slope * X_MAX;
  });
  const line = $derived<Line>({
    slope: (right.current - left.current) / X_MAX,
    intercept: left.current,
  });
  const total = $derived(sumOfSquares(xs, ys, line));

  let width = $state(560);
  const PAD = { left: 16, right: 16, top: 20, bottom: 36 };
  const k = $derived((width - PAD.left - PAD.right) / X_MAX);
  const height = $derived(Math.round(Y_UNITS * k + PAD.top + PAD.bottom));
  const px = (x: number) => PAD.left + x * k;
  const py = (y: number) => PAD.top + (Y_MIN + Y_UNITS - y) * k;

  const captions = [
    'Seven observations, each a little off',
    'A candidate: any line is a guess',
    'How far it misses each observation',
    'Square each miss: the total is its score',
    'Gauss: the smallest total wins',
  ];
</script>

<div class="gauss" bind:clientWidth={width} data-step={step}>
  <svg
    class="fig"
    viewBox="0 0 {width} {height}"
    {width}
    {height}
    role="img"
    aria-label="{captions[Math.min(step, 4)]}. Total of the squared misses: {total.toFixed(2)}."
  >
    <line class="axis" x1={PAD.left} x2={width - PAD.right} y1={py(0)} y2={py(0)} />
    <text x={width - PAD.right} y={py(0) + 22} text-anchor="end">time →</text>

    {#each xs as x, i (i)}
      {@const yLine = line.slope * x + line.intercept}
      {@const side = Math.abs(ys[i] - yLine) * k}
      {@const toRight = x < X_MAX - 1.4}
      <rect
        class="square"
        class:on={step >= 3}
        x={toRight ? px(x) : px(x) - side}
        y={Math.min(py(ys[i]), py(yLine))}
        width={side}
        height={side}
      />
      <line class="miss" class:on={step >= 2} x1={px(x)} x2={px(x)} y1={py(ys[i])} y2={py(yLine)} />
    {/each}

    <line
      class="candidate"
      class:on={step >= 1}
      class:best={step >= 4}
      x1={px(0)}
      x2={px(X_MAX)}
      y1={py(left.current)}
      y2={py(right.current)}
    />

    {#each xs as x, i (i)}
      <circle class="dot obs" cx={px(x)} cy={py(ys[i])} r="6" style="--i: {i}" />
    {/each}
  </svg>

  <p class="gauss__readout" class:on={step >= 3} aria-hidden="true">
    total of the squares <b>{total.toFixed(2)}</b>
    {#if step >= 4}<span class="best-label">the smallest possible</span>{/if}
  </p>
</div>

<style>
  .gauss {
    width: 100%;
  }

  .square,
  .miss,
  .candidate,
  .gauss__readout {
    opacity: 0;
    transition: opacity 0.6s var(--ease);
  }

  .on {
    opacity: 1;
  }

  .square {
    fill: var(--signal-bg);
    stroke: var(--signal);
    stroke-width: 1;
    stroke-opacity: 0.6;
  }

  .miss {
    stroke: var(--signal);
    stroke-width: 1.2;
    stroke-dasharray: 3 3;
  }

  .candidate {
    stroke: var(--ink);
    stroke-width: 2.5;
    transition:
      opacity 0.6s var(--ease),
      stroke 0.6s var(--ease);
  }

  .candidate.best {
    stroke: var(--ok);
  }

  .gauss__readout {
    margin: 0.4rem 0 0;
    font-size: 0.95rem;
    color: var(--ink-soft);
    font-variant-numeric: tabular-nums;
  }

  .gauss__readout b {
    font-size: 1.3rem;
    font-weight: 600;
    color: var(--signal);
  }

  .best-label {
    margin-inline-start: 0.5rem;
    font-weight: 600;
    color: var(--ok);
  }

  @media (prefers-reduced-motion: no-preference) {
    .obs {
      animation: pop 0.5s var(--ease) backwards;
      animation-delay: calc(var(--i) * 90ms);
    }
  }

  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
  }
</style>
