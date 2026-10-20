<script lang="ts">
  import { onMount } from 'svelte';
  import { gaussian, mulberry32 } from '~/lib/stats/random';

  /**
   * Gauss–Newton (Laplace Closes the Circle): fitting the frequency of a wave to noisy data.
   * The cost across frequency has one deep valley and several shallow ones. Each step
   * pretends the model is a straight line nearby, solves least squares for that, and moves.
   * It always reaches a valley floor, not necessarily the deepest.
   */
  const N = 60;
  const F_TRUE = 3.2;
  const F_LO = 0.5;
  const F_HI = 7;
  const t = Array.from({ length: N }, (_, i) => i / N);
  const draw = gaussian(mulberry32(1801));
  const y = t.map(
    (ti) =>
      Math.cos(2 * Math.PI * F_TRUE * ti) +
      0.4 * Math.sin(2 * Math.PI * F_TRUE * ti) +
      0.3 * draw(),
  );

  /** Best amplitudes at a fixed frequency, and the total squared miss they leave. */
  function solve(f: number) {
    let cc = 0;
    let ss = 0;
    let cs = 0;
    let yc = 0;
    let ys = 0;
    for (let i = 0; i < N; i++) {
      const c = Math.cos(2 * Math.PI * f * t[i]);
      const s = Math.sin(2 * Math.PI * f * t[i]);
      cc += c * c;
      ss += s * s;
      cs += c * s;
      yc += y[i] * c;
      ys += y[i] * s;
    }
    const det = cc * ss - cs * cs;
    const a = (yc * ss - ys * cs) / det;
    const b = (ys * cc - yc * cs) / det;
    let cost = 0;
    for (let i = 0; i < N; i++) {
      const r = y[i] - a * Math.cos(2 * Math.PI * f * t[i]) - b * Math.sin(2 * Math.PI * f * t[i]);
      cost += r * r;
    }
    return { a, b, cost };
  }

  /** One Gauss–Newton step in frequency, and the straight-line model it solved. */
  function linearise(f: number) {
    const { a, b } = solve(f);
    let jr = 0;
    let jj = 0;
    const r: number[] = [];
    const J: number[] = [];
    for (let i = 0; i < N; i++) {
      const w = 2 * Math.PI * t[i];
      const c = Math.cos(w * f);
      const s = Math.sin(w * f);
      r.push(y[i] - a * c - b * s);
      J.push(w * (-a * s + b * c));
      jr += J[i] * r[i];
      jj += J[i] * J[i];
    }
    const step = Math.max(-1, Math.min(1, jr / jj));
    // The cost the linearised model predicts for a nearby frequency f + δ.
    const predicted = (delta: number) =>
      r.reduce((sum, ri, i) => sum + (ri - J[i] * delta) ** 2, 0);
    return { next: Math.min(F_HI, Math.max(F_LO, f + step)), predicted };
  }

  const costs = Array.from({ length: 651 }, (_, i) => F_LO + ((F_HI - F_LO) * i) / 650).map(
    (f) => ({
      f,
      cost: solve(f).cost,
    }),
  );
  const deepest = costs.reduce((m, p) => (p.cost < m.cost ? p : m)).f;

  let start = $state(5.2);
  let path = $state<number[]>([5.2]);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });
  const current = $derived(path[path.length - 1]);
  const local = $derived(linearise(current));
  const found = $derived(path.length > 1 && Math.abs(current - deepest) < 0.15);
  const settled = $derived(
    path.length > 1 && Math.abs(path[path.length - 1] - path[path.length - 2]) < 0.005,
  );

  function stepOnce() {
    path = [...path, linearise(current).next];
  }
  function run() {
    let f = current;
    const more: number[] = [];
    for (let k = 0; k < 12; k++) {
      f = linearise(f).next;
      more.push(f);
    }
    path = [...path, ...more];
  }
  function restart(f: number) {
    start = f;
    path = [f];
  }

  let width = $state(640);
  const H = 240;
  const PAD = 16;
  const BASE = 196;
  const TOP = 28;
  const fx = (f: number) => PAD + ((f - F_LO) / (F_HI - F_LO)) * (width - 2 * PAD);
  // A monotone stretch of the cost, so the shallow valleys are visible next to the deep one:
  // the log of how much of the data each frequency leaves unexplained. Valleys stay put.
  const total = y.reduce((sum, v) => sum + v * v, 0);
  const stretch = (c: number) => -Math.log10(Math.max(total - c, 1e-3));
  const sLo = Math.min(...costs.map((p) => stretch(p.cost)));
  const sHi = Math.max(...costs.map((p) => stretch(p.cost)));
  const cy = (c: number) =>
    BASE - 4 - ((Math.min(stretch(c), sHi) - sLo) / (sHi - sLo)) * (BASE - TOP - 4);
  const costPath = $derived(
    costs.map((p, i) => `${i ? 'L' : 'M'}${fx(p.f).toFixed(1)},${cy(p.cost).toFixed(1)}`).join(''),
  );
  const localPath = $derived.by(() => {
    let d = '';
    for (let k = 0; k <= 40; k++) {
      const delta = -0.8 + (1.6 * k) / 40;
      const f = current + delta;
      if (f < F_LO || f > F_HI) continue;
      d += `${d ? 'L' : 'M'}${fx(f).toFixed(1)},${cy(local.predicted(delta)).toFixed(1)}`;
    }
    return d;
  });
</script>

<div
  class="gauss-newton"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-f={current.toFixed(3)}
  data-steps={path.length - 1}
  data-deepest={found}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`The fitting cost across frequency; valleys are good fits. Starting from ${start.toFixed(2)} hertz, ${path.length - 1} Gauss–Newton steps have reached ${current.toFixed(2)} hertz${found ? ', the deepest valley' : ''}.`}
  >
    <text class="caps" x={PAD} y="14"
      >how badly each frequency fits · stretched scale · lower is better</text
    >
    <path class="cost" d={costPath} />
    <path class="local" d={localPath} />
    {#each path as f, i (i)}
      <circle
        class="visit"
        cx={fx(f)}
        cy={cy(solve(f).cost)}
        r={i === path.length - 1 ? 6 : 3}
        class:now={i === path.length - 1}
      />
    {/each}
    <line class="axis" x1={PAD} x2={width - PAD} y1={BASE} y2={BASE} />
    {#each [1, 2, 3, 4, 5, 6, 7] as f (f)}
      <text x={fx(f)} y={BASE + 16} text-anchor="middle">{f}</text>
    {/each}
    <text x={width - PAD} y={H - 4} text-anchor="end">frequency of the fitted wave (Hz)</text>
    {#if settled}
      <text
        class={found ? 'ok' : 'bias'}
        x={fx(current)}
        y={cy(solve(current).cost) - 14}
        text-anchor="middle"
      >
        {found ? 'the deepest valley' : 'a valley floor, not the deepest'}
      </text>
    {/if}
  </svg>
  <div class="controls">
    <label class="slider">
      <span>Starting guess <b>{start.toFixed(2)} Hz</b></span>
      <input
        type="range"
        min={F_LO}
        max={F_HI}
        step="0.05"
        value={start}
        oninput={(e) => restart(Number(e.currentTarget.value))}
        aria-valuetext={`${start.toFixed(2)} hertz`}
      />
    </label>
    <button type="button" class="btn" onclick={stepOnce}>Take one step</button>
    <button type="button" class="btn" onclick={run}>Keep stepping</button>
    <span class="readout"
      >now at <b>{current.toFixed(2)} Hz</b> after {path.length - 1} step{path.length === 2
        ? ''
        : 's'}</span
    >
  </div>
</div>

<style>
  .gauss-newton {
    width: 100%;
  }

  .cost {
    fill: none;
    stroke: var(--ink-soft);
    stroke-width: 1.6;
  }

  .local {
    fill: none;
    stroke: var(--model);
    stroke-width: 1.6;
    stroke-dasharray: 5 4;
  }

  .visit {
    fill: var(--signal);
    opacity: 0.55;
  }

  .visit.now {
    opacity: 1;
    stroke: var(--ink);
    stroke-width: 1.5;
  }

  .slider {
    display: grid;
    flex: 1 1 14rem;
    gap: 0.25rem;
    font-size: var(--text-sm);
    color: var(--ink-soft);
  }
</style>
