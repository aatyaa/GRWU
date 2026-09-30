<script lang="ts">
  import { onMount } from 'svelte';
  import { normalPdf } from '~/lib/stats/estimators';
  import { mulberry32 } from '~/lib/stats/random';

  /**
   * Sums forget the shape they were made of (Laplace Closes the Circle). Each measurement
   * error is a total of many small disturbances; choose what one disturbance looks like and
   * how many are added, and compare the totals with the bell. Heavy-tailed disturbances, the
   * kind a detector glitch is, never settle.
   */
  const shapes = {
    die: { label: 'Flat, like a die', draw: (u: number) => Math.floor(u * 6) + 1 },
    lopsided: { label: 'Lopsided', draw: (u: number) => -Math.log(1 - u) },
    coin: { label: 'Two-valued, like a coin', draw: (u: number) => (u < 0.5 ? -1 : 1) },
    glitchy: {
      label: 'Heavy-tailed, like glitches',
      draw: (u: number) => Math.tan(Math.PI * (u - 0.5)),
    },
  } as const;
  type ShapeId = keyof typeof shapes;
  const COUNTS = [1, 2, 3, 4, 6, 10, 20, 50];
  const SAMPLES = 20000;
  const LIM = 5;
  const BINS = 50;
  const BIN = (2 * LIM) / BINS;

  let shape = $state<ShapeId>('die');
  let countIndex = $state(0);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });
  const n = $derived(COUNTS[countIndex]);

  // Totals are expensive to draw; each (shape, count) is drawn once. Not reactive state.
  const cache: Record<string, { density: number[]; tail: number }> = {};
  const result = $derived.by(() => {
    const key = `${shape}:${n}`;
    const hit = cache[key];
    if (hit) return hit;
    const rand = mulberry32(1812 + n * 7 + Object.keys(shapes).indexOf(shape) * 1000);
    const draw = shapes[shape].draw;
    const totals = new Float64Array(SAMPLES);
    for (let s = 0; s < SAMPLES; s++) {
      let sum = 0;
      for (let k = 0; k < n; k++) sum += draw(rand());
      totals[s] = sum;
    }
    // Standardise by the median and the interquartile range (1.349 σ for a bell), which
    // exist even when the variance does not.
    const sorted = Float64Array.from(totals).sort();
    const q = (p: number) => sorted[Math.floor(p * (SAMPLES - 1))];
    const centre = q(0.5);
    const spread = (q(0.75) - q(0.25)) / 1.349 || 1;
    const counts = new Array(BINS).fill(0);
    let tail = 0;
    for (const x of totals) {
      const z = (x - centre) / spread;
      if (Math.abs(z) > 4) tail++;
      const b = Math.floor((z + LIM) / BIN);
      if (b >= 0 && b < BINS) counts[b]++;
    }
    const out = { density: counts.map((c) => c / (SAMPLES * BIN)), tail: tail / SAMPLES };
    cache[key] = out;
    return out;
  });

  let width = $state(640);
  const H = 230;
  const PAD = 16;
  const BASE = 196;
  const TOP = 24;
  const px = (z: number) => PAD + ((z + LIM) / (2 * LIM)) * (width - 2 * PAD);
  const py = (d: number) => BASE - (Math.min(d, 0.8) / 0.8) * (BASE - TOP);
  const bell = $derived(
    Array.from({ length: 121 }, (_, i) => -LIM + (2 * LIM * i) / 120)
      .map((z, i) => `${i ? 'L' : 'M'}${px(z).toFixed(1)},${py(normalPdf(z)).toFixed(1)}`)
      .join(''),
  );
  const pct = (v: number) => (v < 0.001 ? `${(v * 100).toFixed(3)}%` : `${(v * 100).toFixed(1)}%`);
</script>

<div
  class="sums"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-shape={shape}
  data-n={n}
  data-tail={result.tail.toFixed(4)}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`Totals of ${n} ${shapes[shape].label.toLowerCase()} disturbances, standardised, against the bell curve. ${pct(result.tail)} of the totals lie more than four spreads from the centre; a bell would put 0.006% there.`}
  >
    <text class="caps" x={PAD} y="14"
      >totals of {n} disturbance{n > 1 ? 's' : ''}, against the bell</text
    >
    {#each result.density as d, b (b)}
      <rect
        class="bar"
        x={px(-LIM + b * BIN) + 0.5}
        y={py(d)}
        width={Math.max(0, px(BIN) - px(0) - 1)}
        height={BASE - py(d)}
      />
    {/each}
    <path class="bell" d={bell} />
    <line class="axis" x1={PAD} x2={width - PAD} y1={BASE} y2={BASE} />
    {#each [-4, -2, 0, 2, 4] as z (z)}
      <text x={px(z)} y={BASE + 16} text-anchor="middle"
        >{z === 0 ? '0' : `${z > 0 ? '+' : '−'}${Math.abs(z)}`}</text
      >
    {/each}
    <text x={width - PAD} y={H - 2} text-anchor="end">spreads from the centre</text>
  </svg>
  <div class="controls">
    <fieldset class="choices">
      <legend>What one disturbance looks like</legend>
      {#each Object.entries(shapes) as [id, s] (id)}
        <label><input type="radio" name="shape" value={id} bind:group={shape} /> {s.label}</label>
      {/each}
    </fieldset>
    <label class="slider">
      <span>Disturbances added together <b>{n}</b></span>
      <input
        type="range"
        min="0"
        max={COUNTS.length - 1}
        step="1"
        bind:value={countIndex}
        aria-valuetext={`${n}`}
      />
    </label>
    <span class="readout">beyond four spreads <b>{pct(result.tail)}</b> · a bell: 0.006%</span>
  </div>
</div>

<style>
  .sums {
    width: 100%;
  }

  .bar {
    fill: var(--signal-bg);
    stroke: var(--signal);
    stroke-width: 0.5;
  }

  .bell {
    fill: none;
    stroke: var(--model);
    stroke-width: 2;
    stroke-dasharray: 6 4;
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

  .slider {
    display: grid;
    flex: 1 1 14rem;
    gap: 0.25rem;
    font-size: var(--text-sm);
    color: var(--ink-soft);
  }
</style>
