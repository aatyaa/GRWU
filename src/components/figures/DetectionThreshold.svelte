<script lang="ts">
  import { onMount } from 'svelte';
  import { powerOfTen, scientific } from '~/lib/format';
  import { detection, falseAlarm, noisePdf, signalPdf } from '~/lib/stats/detection';

  /**
   * Where to draw the line (A Peak Is Only a Candidate): how the matched filter's score is
   * spread in noise alone and with a signal of a given strength, and what a threshold costs
   * on each side. The vertical axis is logarithmic, so the noise's tail stays visible.
   */
  let threshold = $state(8);
  let strength = $state(10);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  // A search tries about a thousand independent templates and times every second.
  const TRIALS_PER_YEAR = 1000 * 3.156e7;
  const pfa = $derived(falseAlarm(threshold));
  const perYear = $derived(pfa * TRIALS_PER_YEAR);
  const pd = $derived(detection(threshold, strength));

  let width = $state(600);
  const H = 300;
  const PAD = { l: 44, r: 14, t: 30, b: 44 };
  const RHO = 20;
  const FLOOR = 1e-14;
  const x = (r: number) => PAD.l + (r / RHO) * (width - PAD.l - PAD.r);
  const y = (p: number) =>
    PAD.t + (Math.log10(Math.max(p, FLOOR)) / Math.log10(FLOOR)) * (H - PAD.t - PAD.b);
  const grid = Array.from({ length: 401 }, (_, i) => (RHO * i) / 400);
  const curve = (f: (r: number) => number, from = 0) => {
    const pts = grid.filter((r) => r >= from);
    if (from > 0) pts.unshift(from);
    return pts.map((r, i) => `${i ? 'L' : 'M'}${x(r).toFixed(1)},${y(f(r)).toFixed(1)}`).join('');
  };
  const area = (f: (r: number) => number, from: number) =>
    `${curve(f, from)}L${x(RHO).toFixed(1)},${y(FLOOR)}L${x(from).toFixed(1)},${y(FLOOR)}Z`;
  const noiseLine = $derived(curve(noisePdf, 0.01));
  const signalLine = $derived(curve((r) => signalPdf(r, strength), 0.01));
  const noiseTail = $derived(area(noisePdf, threshold));
  const signalTail = $derived(area((r) => signalPdf(r, strength), threshold));
  const decades = [1, 1e-4, 1e-8, 1e-12];
  const oneIn = (p: number) =>
    p > 0.01 ? `1 in ${Math.round(1 / p)}` : `1 in ${scientific(1 / p)}`;
</script>

<div
  class="threshold"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-threshold={threshold.toFixed(1)}
  data-pd={pd.toFixed(3)}
  data-per-year={perYear.toExponential(2)}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`How the score is spread in noise alone and with a signal of strength ${strength}. With the line at ${threshold.toFixed(1)}, noise alone crosses it ${oneIn(pfa)} tries, and the signal crosses it ${(100 * pd).toFixed(1)} percent of the time.`}
  >
    <text class="caps" x={PAD.l} y="16">how often each score turns up · log scale</text>
    {#each decades as d (d)}
      <line class="grid" x1={PAD.l} x2={width - PAD.r} y1={y(d)} y2={y(d)} />
      <text x={PAD.l - 8} y={y(d)} dy="4" text-anchor="end">{d === 1 ? '1' : powerOfTen(d)}</text>
    {/each}
    <path class="noise-tail" d={noiseTail} />
    <path class="signal-tail" d={signalTail} />
    <path class="noise" d={noiseLine} />
    <path class="signal" d={signalLine} />
    <text class="halo" x={x(0.3)} y={y(1e-6)}>noise</text>
    <text
      class="signal"
      x={x(Math.min(Math.max(strength, 3), 17))}
      y={y(0.4) - 8}
      text-anchor="middle">with a signal</text
    >
    <line class="line" x1={x(threshold)} x2={x(threshold)} y1={PAD.t} y2={H - PAD.b} />
    <text class="ink" x={x(threshold) + 6} y={H - PAD.b - 8}>the line, {threshold.toFixed(1)}</text>
    <line class="axis" x1={PAD.l} x2={width - PAD.r} y1={H - PAD.b} y2={H - PAD.b} />
    {#each [0, 4, 8, 12, 16, 20] as v (v)}
      <text x={x(v)} y={H - PAD.b + 16} text-anchor="middle">{v}</text>
    {/each}
    <text x={width - PAD.r} y={H - 6} text-anchor="end">matched-filter score</text>
  </svg>

  <div class="controls">
    <label class="slider">
      <span>Draw the line at <b>{threshold.toFixed(1)}</b></span>
      <input type="range" min="3" max="12" step="0.1" bind:value={threshold} />
    </label>
    <label class="slider">
      <span>Signal strength <b>{strength.toFixed(1)}</b></span>
      <input type="range" min="0" max="16" step="0.5" bind:value={strength} />
    </label>
  </div>
  <dl class="readouts">
    <div>
      <dt>noise alone crosses it</dt>
      <dd>{oneIn(pfa)} tries</dd>
    </div>
    <div>
      <dt>false alarms a year</dt>
      <dd class:bad={perYear >= 1}>
        {perYear >= 0.01 ? perYear.toPrecision(2) : scientific(perYear)}
      </dd>
    </div>
    <div>
      <dt>signals it catches</dt>
      <dd>{(100 * pd).toFixed(1)}%</dd>
    </div>
  </dl>
</div>

<style>
  .threshold {
    width: 100%;
  }

  /* A halo in the page colour keeps the label legible where a curve crosses it. */
  .fig text.halo {
    paint-order: stroke;
    stroke: var(--ground);
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  .noise-tail {
    fill: color-mix(in srgb, var(--noise) 30%, transparent);
  }

  .signal-tail {
    fill: var(--signal-bg);
  }

  .line {
    stroke: var(--ink);
    stroke-width: 1.5;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.5rem;
    margin-top: 0.75rem;
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
</style>
