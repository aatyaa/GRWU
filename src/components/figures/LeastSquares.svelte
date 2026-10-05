<script lang="ts">
  import { onDestroy } from 'svelte';
  import { fitLine, sumOfSquares, type Line } from '~/lib/stats/estimators';
  import { gaussian, mulberry32 } from '~/lib/stats/random';
  import { dragger, stepKey, tween } from '~/lib/figure/pointer';

  // Seven observations of a straight trend, each slightly wrong.
  const X_MAX = 9.5;
  const Y_MIN = -0.3;
  const Y_UNITS = 5;
  const draw = gaussian(mulberry32(1801));
  const xs = [0.8, 2.1, 3.4, 4.7, 6.0, 7.3, 8.6];
  const ys = xs.map((x) => 0.36 * x + 0.9 + 0.55 * draw());
  const best = fitLine(xs, ys);
  const bestTotal = sumOfSquares(xs, ys, best);

  // The reader's line, held by its heights at the two edges.
  let left = $state(2.9);
  let right = $state(2.3);
  const line = $derived<Line>({ slope: (right - left) / X_MAX, intercept: left });
  const total = $derived(sumOfSquares(xs, ys, line));
  const solved = $derived(Math.abs(total - bestTotal) < 1e-3);

  let width = $state(640);
  const PAD = { left: 18, right: 18, top: 16, bottom: 30 };
  const k = $derived((width - PAD.left - PAD.right) / X_MAX); // px per unit, same on both axes
  const height = $derived(Math.round(Y_UNITS * k + PAD.top + PAD.bottom));
  const px = (x: number) => PAD.left + x * k;
  const py = (y: number) => PAD.top + (Y_MIN + Y_UNITS - y) * k;
  const fromPy = (v: number) => Y_MIN + Y_UNITS - (v - PAD.top) / k;
  const clampY = (y: number) => Math.min(Y_MIN + Y_UNITS, Math.max(Y_MIN, y));

  let svg = $state<SVGSVGElement>();
  let cancel: (() => void) | undefined;
  onDestroy(() => cancel?.());

  const dragLeft = dragger(
    () => svg,
    (p) => (left = clampY(fromPy(p.y))),
  );
  const dragRight = dragger(
    () => svg,
    (p) => (right = clampY(fromPy(p.y))),
  );

  // Dragging the line itself slides it up and down without turning it.
  let grab = 0;
  const dragLine = dragger(
    () => svg,
    (p) => {
      const y = fromPy(p.y);
      const at = left + (right - left) * ((p.x - PAD.left) / k / X_MAX);
      if (!grab) grab = y - at || 1e-9;
      const shift = y - at - grab;
      left = clampY(left + shift);
      right = clampY(right + shift);
    },
    () => (grab = 0),
  );

  function gauss() {
    cancel?.();
    const [l0, r0] = [left, right];
    const [l1, r1] = [best.intercept, best.intercept + best.slope * X_MAX];
    cancel = tween(0, 1, (u) => {
      left = l0 + (l1 - l0) * u;
      right = r0 + (r1 - r0) * u;
    });
  }

  function reset() {
    cancel?.();
    left = 2.9;
    right = 2.3;
  }

  const fmt = (v: number) => v.toFixed(2);
</script>

<div
  class="least-squares"
  bind:clientWidth={width}
  data-total={total.toFixed(3)}
  data-best={bestTotal.toFixed(3)}
>
  <svg
    bind:this={svg}
    class="fig"
    viewBox="0 0 {width} {height}"
    {width}
    {height}
    role="group"
    aria-label="Seven observations and a line you can move. Each observation's miss is drawn as a square; the fit that makes the total area smallest is the least-squares fit."
  >
    <line class="axis" x1={PAD.left} x2={width - PAD.right} y1={py(0)} y2={py(0)} />

    <!-- The squares: one per observation, side equal to its miss. -->
    {#each xs as x, i (i)}
      {@const yLine = line.slope * x + line.intercept}
      {@const r = ys[i] - yLine}
      {@const side = Math.abs(r) * k}
      {@const toRight = x < X_MAX - 1.2}
      <rect
        class="square"
        x={toRight ? px(x) : px(x) - side}
        y={Math.min(py(ys[i]), py(yLine))}
        width={side}
        height={side}
      />
      <line class="miss" x1={px(x)} x2={px(x)} y1={py(ys[i])} y2={py(yLine)} />
    {/each}

    <!-- The best fit, faint, once the reader has found it or asked for it. -->
    <line
      class="best"
      class:shown={solved}
      x1={px(0)}
      x2={px(X_MAX)}
      y1={py(best.intercept)}
      y2={py(best.intercept + best.slope * X_MAX)}
    />

    <!-- Dragging the line is a pointer shortcut; the two handles give the same control from the keyboard. -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <line
      class="reader-line"
      x1={px(0)}
      x2={px(X_MAX)}
      y1={py(left)}
      y2={py(right)}
      onpointerdown={dragLine}
    />

    {#each xs as x, i (i)}
      <circle class="dot" cx={px(x)} cy={py(ys[i])} r="5" />
    {/each}

    <circle
      class="handle"
      cx={px(0)}
      cy={py(left)}
      r="8"
      tabindex="0"
      role="slider"
      aria-label="Left end of the line"
      aria-valuemin={Y_MIN}
      aria-valuemax={Y_MIN + Y_UNITS}
      aria-valuenow={Number(left.toFixed(2))}
      aria-valuetext="height {fmt(left)}"
      onpointerdown={dragLeft}
      onkeydown={(e) => {
        const v = stepKey(e, left, { step: 0.05, min: Y_MIN, max: Y_MIN + Y_UNITS });
        if (v !== null) left = v;
      }}
    />
    <circle
      class="handle"
      cx={px(X_MAX)}
      cy={py(right)}
      r="8"
      tabindex="0"
      role="slider"
      aria-label="Right end of the line"
      aria-valuemin={Y_MIN}
      aria-valuemax={Y_MIN + Y_UNITS}
      aria-valuenow={Number(right.toFixed(2))}
      aria-valuetext="height {fmt(right)}"
      onpointerdown={dragRight}
      onkeydown={(e) => {
        const v = stepKey(e, right, { step: 0.05, min: Y_MIN, max: Y_MIN + Y_UNITS });
        if (v !== null) right = v;
      }}
    />
    <text x={width - PAD.right} y={height - 8} text-anchor="end" class="caps">
      drag the ends, or the line
    </text>
  </svg>

  <div class="controls">
    <p class="readout" aria-live="polite">
      <span>total shaded area <b class:signal={solved}>{fmt(total)}</b></span>
      <span>
        {#if solved}
          the smallest it can be
        {:else}
          smallest possible <b>{fmt(bestTotal)}</b>
        {/if}
      </span>
    </p>
    <button type="button" class="btn" onclick={gauss} disabled={solved}>Let Gauss choose</button>
    <button type="button" class="btn" onclick={reset}>Reset</button>
  </div>
</div>

<style>
  .least-squares {
    width: 100%;
  }

  .square {
    fill: var(--signal-bg);
    stroke: var(--signal);
    stroke-width: 0.8;
    stroke-opacity: 0.55;
  }

  .miss {
    stroke: var(--signal);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }

  .reader-line {
    stroke: var(--ink);
    stroke-width: 2;
    cursor: grab;
  }

  .best {
    stroke: var(--ok);
    stroke-width: 1;
    stroke-dasharray: 2 4;
    opacity: 0;
    transition: opacity var(--dur) var(--ease);
  }

  .best.shown {
    opacity: 1;
  }

  .controls .readout {
    margin: 0;
  }
</style>
