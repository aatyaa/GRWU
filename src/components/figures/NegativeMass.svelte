<script lang="ts">
  import { onMount } from 'svelte';

  /**
   * A case where the prior saves you (Laplace Closes the Circle): poor data whose best fit is
   * a negative mass. The prior is zero below zero; multiplying by it removes the impossible
   * half, and what survives is renormalised.
   */
  const SIGMA = 1;
  const LO = -4;
  const HI = 5;
  const N = 450;
  const grid = Array.from({ length: N }, (_, i) => LO + ((i + 0.5) * (HI - LO)) / N);

  let best = $state(-0.8);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  const like = $derived(grid.map((m) => Math.exp(-0.5 * ((m - best) / SIGMA) ** 2)));
  const prior = grid.map((m) => (m >= 0 ? 1 : 0));
  const post = $derived.by(() => {
    const p = like.map((l, i) => l * prior[i]);
    const s = p.reduce((a, b) => a + b, 0) || 1;
    return p.map((v) => v / s);
  });
  const median = $derived.by(() => {
    let c = 0;
    for (let i = 0; i < N; i++) {
      c += post[i];
      if (c >= 0.5) return grid[i];
    }
    return grid[N - 1];
  });
  // The share of the likelihood on impossible masses: the normal CDF at 0.
  const erf = (x: number) => {
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const y =
      1 -
      ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
        t *
        Math.exp(-x * x);
    return x >= 0 ? y : -y;
  };
  const removed = $derived(0.5 * (1 + erf((0 - best) / (SIGMA * Math.SQRT2))));

  let width = $state(640);
  const stacked = $derived(width < 520);
  const panelW = $derived(stacked ? width : (width - 40) / 3);
  const PH = 120;
  const H = $derived(stacked ? 3 * (PH + 34) : PH + 44);
  const origin = (k: number) =>
    stacked ? { x: 0, y: k * (PH + 34) } : { x: k * (panelW + 20), y: 0 };
  const curve = (values: number[], k: number, filled = false) => {
    const o = origin(k);
    const max = Math.max(...values) || 1;
    const x = (m: number) => o.x + 8 + ((m - LO) / (HI - LO)) * (panelW - 16);
    const y = (v: number) => o.y + 22 + PH - (v / max) * (PH - 16);
    let d = values
      .map((v, i) => `${i ? 'L' : 'M'}${x(grid[i]).toFixed(1)},${y(v).toFixed(1)}`)
      .join('');
    if (filled)
      d += `L${x(HI).toFixed(1)},${y(0).toFixed(1)}L${x(LO).toFixed(1)},${y(0).toFixed(1)}Z`;
    return d;
  };
  const zeroX = (k: number) => origin(k).x + 8 + ((0 - LO) / (HI - LO)) * (panelW - 16);
  const titles = [
    'prior: mass cannot be below 0',
    'likelihood: the data alone',
    'posterior: only what was possible',
  ];
</script>

<div
  class="negative-mass"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-best={best.toFixed(2)}
  data-median={median.toFixed(2)}
  data-removed={removed.toFixed(2)}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`Prior times likelihood equals posterior. The data alone favour a mass of ${best.toFixed(2)}. The prior is zero below zero, so the posterior keeps only non-negative masses, with a median of ${median.toFixed(2)}.`}
  >
    {#each [0, 1, 2] as k (k)}
      {@const o = origin(k)}
      <text class="caps" x={o.x + 8} y={o.y + 12}>{titles[k]}</text>
      <line class="axis" x1={o.x + 8} x2={o.x + panelW - 8} y1={o.y + 22 + PH} y2={o.y + 22 + PH} />
      <line class="zero" x1={zeroX(k)} x2={zeroX(k)} y1={o.y + 22} y2={o.y + 22 + PH} />
      <text x={zeroX(k)} y={o.y + 36 + PH} text-anchor="middle">0</text>
    {/each}
    <path class="prior" d={curve(prior, 0, true)} />
    <path class="like" d={curve(like, 1)} />
    <path class="post" d={curve(post, 2, true)} />
  </svg>
  <div class="controls">
    <label class="slider">
      <span>Where the data alone put the mass <b>{best.toFixed(2)}</b></span>
      <input
        type="range"
        min="-2.5"
        max="2.5"
        step="0.05"
        bind:value={best}
        aria-valuetext={best.toFixed(2)}
      />
    </label>
  </div>
  <dl class="readouts">
    <div>
      <dt>best fit, on its own</dt>
      <dd class:bad={best < 0}>{best.toFixed(2)}{best < 0 ? ' · impossible' : ''}</dd>
    </div>
    <div>
      <dt>posterior median</dt>
      <dd>{median.toFixed(2)}</dd>
    </div>
    <div>
      <dt>share of the likelihood on impossible masses</dt>
      <dd>{Math.round(removed * 100)}%</dd>
    </div>
  </dl>
</div>

<style>
  .negative-mass {
    width: 100%;
  }

  .zero {
    stroke: var(--rule);
    stroke-width: 1;
  }

  .prior {
    fill: var(--rule-soft);
    stroke: var(--noise);
    stroke-width: 1.5;
    stroke-dasharray: 5 4;
  }

  .like {
    fill: none;
    stroke: var(--ink-soft);
    stroke-width: 1.8;
  }

  .post {
    fill: var(--signal-bg);
    stroke: var(--signal);
    stroke-width: 2;
  }

  .slider {
    display: grid;
    flex: 1 1 14rem;
    gap: 0.25rem;
    font-size: var(--text-sm);
    color: var(--ink-soft);
  }

  .readouts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
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
</style>
