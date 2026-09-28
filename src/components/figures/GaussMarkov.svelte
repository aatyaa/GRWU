<script lang="ts">
  import { onMount } from 'svelte';
  import { gaussian, mulberry32 } from '~/lib/stats/random';

  /**
   * Least squares without the bell (Laplace Closes the Circle): thousands of simulated
   * datasets, a straight line with noise of a chosen shape, and three honest ways to estimate
   * its slope. All three are centred on the truth; least squares is the narrowest whatever
   * the noise looks like, which is the Gauss–Markov theorem.
   */
  const X = Array.from({ length: 10 }, (_, i) => i + 1);
  const TRUE_SLOPE = 0.5;
  const K = 4000;
  const noises = {
    bell: 'A bell',
    flat: 'Flat',
    coin: 'Two-valued: ±1',
  } as const;
  type NoiseId = keyof typeof noises;

  const estimators = [
    { id: 'ols', label: 'least squares' },
    { id: 'halves', label: 'difference of the two halves' },
    { id: 'ends', label: 'first and last points only' },
  ] as const;

  let noise = $state<NoiseId>('flat');
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  // Each noise shape is simulated once. Not reactive state.
  const cache: Partial<Record<NoiseId, number[][]>> = {};
  const estimates = $derived.by(() => {
    const hit = cache[noise];
    if (hit) return hit;
    const rand = mulberry32(1900 + Object.keys(noises).indexOf(noise));
    const bell = gaussian(rand);
    const draw =
      noise === 'bell'
        ? bell
        : noise === 'flat'
          ? () => (rand() * 2 - 1) * Math.sqrt(3)
          : () => (rand() < 0.5 ? -1 : 1);
    const xm = X.reduce((s, x) => s + x, 0) / X.length;
    const sxx = X.reduce((s, x) => s + (x - xm) ** 2, 0);
    const out: number[][] = [[], [], []];
    for (let k = 0; k < K; k++) {
      const y = X.map((x) => 2 + TRUE_SLOPE * x + draw());
      const ym = y.reduce((s, v) => s + v, 0) / y.length;
      out[0].push(X.reduce((s, x, i) => s + (x - xm) * (y[i] - ym), 0) / sxx);
      const lo = (y[0] + y[1] + y[2] + y[3] + y[4]) / 5;
      const hi = (y[5] + y[6] + y[7] + y[8] + y[9]) / 5;
      out[1].push((hi - lo) / 5);
      out[2].push((y[9] - y[0]) / 9);
    }
    cache[noise] = out;
    return out;
  });
  const spread = (v: number[]) => {
    const m = v.reduce((s, x) => s + x, 0) / v.length;
    return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1));
  };
  const centre = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  const spreads = $derived(estimates.map(spread));

  let width = $state(640);
  const H = 220;
  const PAD = 16;
  const BASE = 186;
  const TOP = 26;
  const LO = 0;
  const HI = 1;
  const BINS = 40;
  const px = (v: number) => PAD + ((v - LO) / (HI - LO)) * (width - 2 * PAD);
  const outline = (v: number[]) => {
    const counts = new Array(BINS).fill(0);
    for (const e of v) {
      const b = Math.floor(((e - LO) / (HI - LO)) * BINS);
      if (b >= 0 && b < BINS) counts[b]++;
    }
    const max = K * 0.14;
    let d = `M${px(LO).toFixed(1)},${BASE}`;
    counts.forEach((c, b) => {
      const y = BASE - (Math.min(c, max) / max) * (BASE - TOP);
      d += `L${px(LO + (b * (HI - LO)) / BINS).toFixed(1)},${y.toFixed(1)}L${px(LO + ((b + 1) * (HI - LO)) / BINS).toFixed(1)},${y.toFixed(1)}`;
    });
    return `${d}L${px(HI).toFixed(1)},${BASE}`;
  };
</script>

<div
  class="gauss-markov"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-noise={noise}
  data-ols={spreads[0].toFixed(3)}
  data-rival={Math.min(spreads[1], spreads[2]).toFixed(3)}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`Slopes estimated from ${K} simulated datasets with ${noises[noise].toLowerCase()} noise. All three estimators centre on the true slope of 0.5; least squares spreads ${spreads[0].toFixed(3)}, the difference of halves ${spreads[1].toFixed(3)}, the end points ${spreads[2].toFixed(3)}.`}
  >
    <text class="caps" x={PAD} y="14"
      >the slope, estimated from {K.toLocaleString('en')} datasets</text
    >
    <line class="truth" x1={px(TRUE_SLOPE)} x2={px(TRUE_SLOPE)} y1={TOP - 6} y2={BASE} />
    <text class="ok" x={px(TRUE_SLOPE) + 6} y={TOP + 4}>the truth, 0.5</text>
    <path class="est ends" d={outline(estimates[2])} />
    <path class="est halves" d={outline(estimates[1])} />
    <path class="est ols" d={outline(estimates[0])} />
    <line class="axis" x1={PAD} x2={width - PAD} y1={BASE} y2={BASE} />
    {#each [0, 0.25, 0.5, 0.75, 1] as v (v)}
      <text x={px(v)} y={BASE + 16} text-anchor="middle">{v}</text>
    {/each}
  </svg>
  <div class="controls">
    <fieldset class="choices">
      <legend>The shape of the noise</legend>
      {#each Object.entries(noises) as [id, label] (id)}
        <label><input type="radio" name="gm-noise" value={id} bind:group={noise} /> {label}</label>
      {/each}
    </fieldset>
  </div>
  <dl class="readouts">
    {#each estimators as e, i (e.id)}
      <div class:best={i === 0}>
        <dt><span class="key {e.id}"></span>{e.label}</dt>
        <dd>centre {centre(estimates[i]).toFixed(3)} · spread {spreads[i].toFixed(3)}</dd>
      </div>
    {/each}
  </dl>
</div>

<style>
  .gauss-markov {
    width: 100%;
  }

  .truth {
    stroke: var(--ok);
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
  }

  .est {
    fill: none;
    stroke-width: 1.6;
  }

  .est.ols {
    fill: var(--signal-bg);
    stroke: var(--signal);
    stroke-width: 2;
  }

  .est.halves {
    stroke: var(--model);
    stroke-dasharray: 6 4;
  }

  .est.ends {
    stroke: var(--noise);
    stroke-dasharray: 2 3;
  }

  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1rem;
    margin: 0;
    padding: 0;
    border: 0;
    font-size: var(--text-sm);
  }

  .choices legend {
    width: 100%;
    margin-bottom: 0.3rem;
    color: var(--ink-soft);
  }

  .readouts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0.5rem 1rem;
    margin: 0.75rem 0 0;
  }

  .readouts div {
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--rule-soft);
    border-radius: 8px;
    background: var(--surface);
  }

  .readouts div.best {
    border-color: var(--signal);
  }

  .readouts dt {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.8rem;
    color: var(--ink-soft);
  }

  .readouts dd {
    margin: 0.15rem 0 0;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .key {
    display: inline-block;
    width: 1.2rem;
    border-top: 2px solid var(--signal);
  }

  .key.halves {
    border-top: 2px dashed var(--model);
  }

  .key.ends {
    border-top: 2px dotted var(--noise);
  }
</style>
