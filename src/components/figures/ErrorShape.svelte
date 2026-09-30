<script lang="ts">
  import { normalPdf } from '~/lib/stats/estimators';
  import { gaussian, mulberry32 } from '~/lib/stats/random';

  // Measurement errors, one tick each, gathered into counts; the curve they trace appears once
  // there are enough of them to see it.
  const SIZES = [12, 40, 150, 600, 2500];
  const draw = gaussian(mulberry32(1809));
  const pool = Array.from({ length: SIZES[SIZES.length - 1] }, draw);

  let sizeIndex = $state(1);
  const n = $derived(SIZES[sizeIndex]);
  const sample = $derived(pool.slice(0, n));

  const RANGE = 3.6;
  const BINS = 24;
  const binWidth = (2 * RANGE) / BINS;
  const counts = $derived.by(() => {
    const c = new Array(BINS).fill(0);
    for (const e of sample) {
      const b = Math.floor((e + RANGE) / binWidth);
      if (b >= 0 && b < BINS) c[b]++;
    }
    return c;
  });

  let width = $state(640);
  const PAD = 22;
  const height = 250;
  const TICKS = 214; // baseline of the rug
  const BASE = 188; // baseline of the bars
  const TOP = 24;
  const px = (e: number) => PAD + ((e + RANGE) / (2 * RANGE)) * (width - 2 * PAD);
  // Density scale: bars and curve share it, so the curve is the limit of the bars.
  const py = (density: number) => BASE - (density / 0.42) * (BASE - TOP);
  const curve = $derived.by(() => {
    let d = '';
    for (let i = 0; i <= 120; i++) {
      const e = -RANGE + (2 * RANGE * i) / 120;
      d += `${i ? 'L' : 'M'}${px(e).toFixed(1)},${py(normalPdf(e)).toFixed(1)}`;
    }
    return d;
  });
</script>

<div class="error-shape" bind:clientWidth={width} data-n={n}>
  <svg
    class="fig"
    viewBox="0 0 {width} {height}"
    {width}
    {height}
    role="img"
    aria-label="{n} measurement errors as tick marks, gathered into a histogram, with the bell curve drawn over it."
  >
    {#each counts as count, b (b)}
      {@const density = count / (n * binWidth)}
      <rect
        class="bar"
        x={px(-RANGE + b * binWidth) + 1}
        y={py(density)}
        width={Math.max(0, px(binWidth - RANGE) - px(-RANGE) - 2)}
        height={BASE - py(density)}
      />
    {/each}
    <path class="signal bell" class:shown={n >= 150} d={curve} />
    <line class="axis" x1={PAD} x2={width - PAD} y1={BASE} y2={BASE} />
    {#each sample.slice(0, 600) as e, i (i)}
      <line class="tick" x1={px(e)} x2={px(e)} y1={TICKS - 8} y2={TICKS} />
    {/each}
    <text x={px(0)} y={height - 10} text-anchor="middle">no error</text>
    <text x={PAD} y={height - 10}>too low</text>
    <text x={width - PAD} y={height - 10} text-anchor="end">too high</text>
  </svg>
  <div class="controls">
    <label>
      measurements
      <input
        type="range"
        min="0"
        max={SIZES.length - 1}
        step="1"
        bind:value={sizeIndex}
        aria-valuetext="{n} measurements"
      />
      <b class="count">{n}</b>
    </label>
  </div>
</div>

<style>
  .bar {
    fill: color-mix(in srgb, var(--noise) 30%, transparent);
    stroke: var(--noise);
    stroke-width: 0.6;
  }

  .tick {
    stroke: var(--ink-soft);
    stroke-width: 1;
    opacity: 0.45;
  }

  .bell {
    opacity: 0;
    transition: opacity var(--dur) var(--ease);
  }

  .bell.shown {
    opacity: 1;
  }

  .count {
    min-width: 4ch;
    font-weight: 500;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
</style>
