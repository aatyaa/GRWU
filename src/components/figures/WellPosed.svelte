<script lang="ts">
  import { onMount } from 'svelte';
  import { amplification, type Hyperbolicity } from '~/lib/physics/hyperbolic';

  /**
   * Why the obvious equations blew up (Only Ever Forwards). The same tiny error in every wave a
   * grid can hold, evolved exactly by a weakly hyperbolic system (the defect of the ADM
   * equations) and by a strongly hyperbolic one (what BSSN and generalised harmonic
   * coordinates achieve). The weak system amplifies the error in proportion to the wavenumber,
   * so a finer grid makes it worse; the strong one keeps it bounded. Log scale.
   */
  const GRIDS = [16, 32, 64, 128, 256, 512];
  const CROSSING = 2 * Math.PI;
  const T_END = 2 * CROSSING;
  const SAMPLES = 80;
  const Y_MAX = 4;

  let level = $state(3);
  let width = $state(600);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  const curves = GRIDS.map((n) => ({
    n,
    weak: Array.from({ length: SAMPLES + 1 }, (_, i) =>
      amplification('weak', n, (T_END * i) / SAMPLES),
    ),
    strong: Array.from({ length: SAMPLES + 1 }, (_, i) =>
      amplification('strong', n, (T_END * i) / SAMPLES),
    ),
  }));

  const n = $derived(GRIDS[level]);
  // The largest growth over the whole run: the strong system's error returns to its starting size
  // whenever a whole number of crossings brings every wave back into phase.
  const weakEnd = $derived(Math.max(...curves[level].weak));
  const strongEnd = $derived(Math.max(...curves[level].strong));

  const H = 280;
  const PAD = { l: 66, r: 20, t: 30, b: 42 };
  const x = $derived((t: number) => PAD.l + (t / T_END) * (width - PAD.l - PAD.r));
  const y = (g: number) => PAD.t + (1 - Math.log10(g) / Y_MAX) * (H - PAD.t - PAD.b);
  const path = (values: number[]) =>
    values
      .map((g, i) => `${i ? 'L' : 'M'}${x((T_END * i) / SAMPLES).toFixed(1)},${y(g).toFixed(1)}`)
      .join('');
  const label = (system: Hyperbolicity) =>
    system === 'weak' ? 'weak: grows, more on finer grids' : 'strong: stays bounded';
</script>

<div
  class="well-posed"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-n={n}
  data-weak={weakEnd.toFixed(1)}
  data-strong={strongEnd.toFixed(2)}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`How much a round-off error has grown against time, on a log scale, for grids of 16 to 512 points. With ${n} points, over two crossings of the grid the weakly hyperbolic system multiplies it by up to ${weakEnd.toFixed(0)} and the strongly hyperbolic one by up to ${strongEnd.toFixed(1)}.`}
  >
    <text class="caps" x={PAD.l} y="16">how much a round-off error has grown</text>
    {#each [1, 10, 100, 1000, 10000] as g (g)}
      <line class="grid" x1={PAD.l} x2={width - PAD.r} y1={y(g)} y2={y(g)} />
      <text x={PAD.l - 6} y={y(g) + 4} text-anchor="end">×{g.toLocaleString('en-GB')}</text>
    {/each}
    {#each curves as c (c.n)}
      <path class="weak" class:faint={c.n !== n} d={path(c.weak)} />
      <path class="strong" class:faint={c.n !== n} d={path(c.strong)} />
    {/each}
    {#each curves as c (c.n)}
      <text
        class={c.n === n ? 'bias halo' : 'halo'}
        x={width - PAD.r - 2}
        y={y(c.weak[SAMPLES]) - 5}
        text-anchor="end">{c.n}</text
      >
    {/each}
    <text class="bias halo" x={PAD.l + 8} y={PAD.t + 14}>{label('weak')}</text>
    <text class="ok halo" x={width - PAD.r - 2} y={y(1.4) - 8} text-anchor="end"
      >{label('strong')}</text
    >
    <line class="axis" x1={PAD.l} x2={width - PAD.r} y1={H - PAD.b} y2={H - PAD.b} />
    {#each [0, 1, 2] as k (k)}
      <text x={x(k * CROSSING)} y={H - PAD.b + 16} text-anchor="middle">{k}</text>
    {/each}
    <text x={width - PAD.r} y={H - 6} text-anchor="end">time, in crossings of the grid</text>
  </svg>

  <div class="controls">
    <label class="slider">
      <span>Points on the grid <b>{n}</b></span>
      <input type="range" min="0" max={GRIDS.length - 1} step="1" bind:value={level} />
    </label>
  </div>
  <dl class="readouts">
    <div>
      <dt>largest growth, weak</dt>
      <dd class="bad">× {weakEnd.toFixed(0)}</dd>
    </div>
    <div>
      <dt>largest growth, strong</dt>
      <dd class="good">× {strongEnd.toFixed(2)}</dd>
    </div>
  </dl>
</div>

<style>
  .well-posed {
    width: 100%;
  }

  .fig text.halo {
    paint-order: stroke;
    stroke: var(--ground);
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  .weak {
    fill: none;
    stroke: var(--bias);
    stroke-width: 2;
  }

  .strong {
    fill: none;
    stroke: var(--ok);
    stroke-width: 2;
  }

  .faint {
    stroke-width: 1;
    opacity: 0.35;
  }

  .slider {
    display: grid;
    flex: 1 1 14rem;
    gap: 0.25rem;
  }

  .readouts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.5rem 1rem;
    margin: 0.75rem 0 0;
  }

  .readouts div {
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--rule-soft);
    border-radius: 8px;
    background: var(--surface);
  }

  .readouts dt {
    font-size: 0.78rem;
    color: var(--ink-soft);
  }

  .readouts dd {
    margin: 0.15rem 0 0;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .readouts dd.bad {
    color: var(--bias);
  }

  .readouts dd.good {
    color: var(--ok);
  }
</style>
