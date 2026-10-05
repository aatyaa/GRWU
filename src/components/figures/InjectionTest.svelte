<script lang="ts">
  import { bin } from 'd3-array';
  import { scaleLinear } from 'd3-scale';
  import { onDestroy, onMount } from 'svelte';
  import { reducedMotion } from '~/lib/state';
  import { gaussian, mulberry32 } from '~/lib/stats/random';
  import { fitRing, ringErrors, ringModel } from '~/lib/stats/ringfit';

  /**
   * Fitting a Ring in Noise: an injection test. The same ring as in RingFit (250 Hz, τ = 4 ms)
   * is added to 300 different stretches of noise, and each is fitted exactly as the reader's
   * one was. The histogram is where the answers land; the dashed curve is the spread the error
   * bar of a single fit predicts (stats/ringfit.ts, both checked against scipy's curve_fit).
   * The noise is seeded, so the histogram is the same on every visit.
   */
  const FS = 4096;
  const N = 160;
  const COUNT = 300;
  const TRUTH = { f: 250, tau: 0.004, amplitude: 1, phase: 0.4 };
  const RANGE = { fMin: 150, fMax: 350, tauMin: 0.001, tauMax: 0.012, grid: 8 };
  const LEVELS = [
    { id: 'quiet', label: 'quiet', sigma: 0.3 },
    { id: 'medium', label: 'as before', sigma: 0.15 },
    { id: 'loud', label: 'loud', sigma: 0.075 },
  ] as const;
  type Level = (typeof LEVELS)[number]['id'];

  const t = Float64Array.from({ length: N }, (_, i) => i / FS);
  const clean = ringModel(t, {
    f: TRUTH.f,
    tau: TRUTH.tau,
    a: Math.cos(TRUTH.phase),
    b: -Math.sin(TRUTH.phase),
  });
  const power = Math.sqrt(clean.reduce((s, v) => s + v * v, 0));

  let level = $state<Level>('medium');
  let answers = $state<number[]>([]);
  let shown = $state<number[]>([]);
  let width = $state(640);
  let hydrated = $state(false);
  let reduce = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = reducedMotion.subscribe((v) => (reduce = v));
  onMount(() => {
    hydrated = true;
  });
  onDestroy(() => {
    clearTimeout(timer);
    unsubscribe();
  });

  const sigma = $derived(LEVELS.find((l) => l.id === level)!.sigma);
  const snr = $derived(power / sigma);
  const reported = $derived(ringErrors(t, TRUTH, sigma).f);

  // Fit a few injections per task so the page stays responsive while the histogram fills.
  $effect(() => {
    const s = sigma;
    const id = level;
    clearTimeout(timer);
    const g = gaussian(mulberry32(1000 + LEVELS.findIndex((l) => l.id === id)));
    const found: number[] = [];
    answers = [];
    shown = [];
    const batch = () => {
      for (let k = 0; k < 15 && found.length < COUNT; k++) {
        const y = Float64Array.from(clean, (v) => v + s * g());
        found.push(fitRing(t, y, RANGE).f);
      }
      if (!reduce || found.length === COUNT) shown = found.slice();
      if (found.length < COUNT) timer = setTimeout(batch, 0);
      else answers = found.slice();
    };
    timer = setTimeout(batch, 0);
  });

  const done = $derived(answers.length === COUNT);
  const mean = $derived(shown.length ? shown.reduce((a, b) => a + b, 0) / shown.length : NaN);
  const spread = $derived(
    shown.length > 1
      ? Math.sqrt(shown.reduce((a, b) => a + (b - mean) ** 2, 0) / (shown.length - 1))
      : NaN,
  );

  const DOMAIN: [number, number] = [190, 310];
  const BIN = 2.5;
  const H = 230;
  const PAD = { l: 14, r: 14, t: 26, b: 30 };
  const inside = $derived(shown.filter((v) => v >= DOMAIN[0] && v < DOMAIN[1]));
  const outside = $derived(shown.length - inside.length);
  const bins = $derived(
    bin()
      .domain(DOMAIN)
      .thresholds(
        Array.from(
          { length: (DOMAIN[1] - DOMAIN[0]) / BIN - 1 },
          (_, i) => DOMAIN[0] + (i + 1) * BIN,
        ),
      )(inside),
  );
  const x = $derived(
    scaleLinear()
      .domain(DOMAIN)
      .range([PAD.l, width - PAD.r]),
  );
  // A fixed height scale per loudness: the expected peak of the histogram, with headroom.
  const peak = $derived((COUNT * BIN) / (Math.sqrt(2 * Math.PI) * reported));
  const y = $derived(
    scaleLinear()
      .domain([0, peak * 1.35])
      .range([H - PAD.b, PAD.t])
      .clamp(true),
  );
  const curve = $derived(
    Array.from({ length: 241 }, (_, i) => {
      const v = DOMAIN[0] + (i / 240) * (DOMAIN[1] - DOMAIN[0]);
      const height =
        ((shown.length || COUNT) * BIN * Math.exp(-0.5 * ((v - TRUTH.f) / reported) ** 2)) /
        (Math.sqrt(2 * Math.PI) * reported);
      return `${i ? 'L' : 'M'}${x(v).toFixed(1)},${y(height).toFixed(1)}`;
    }).join(''),
  );
  const ticks = $derived(width < 480 ? [200, 250, 300] : [200, 225, 250, 275, 300]);
</script>

<div
  class="injections"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-level={level}
  data-count={shown.length}
  data-done={done}
  data-mean={Number.isFinite(mean) ? mean.toFixed(1) : ''}
  data-spread={Number.isFinite(spread) ? spread.toFixed(1) : ''}
  data-reported={reported.toFixed(1)}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`${shown.length} fits of the same ring in different noise. Their answers average ${Number.isFinite(mean) ? mean.toFixed(1) : '…'} Hz with a spread of ±${Number.isFinite(spread) ? spread.toFixed(1) : '…'} Hz; one fit reports ±${reported.toFixed(1)} Hz.`}
  >
    {#each bins as b, i (i)}
      <rect
        class="bar"
        x={x(b.x0 ?? 0) + 0.5}
        y={y(b.length)}
        width={Math.max(0, x(b.x1 ?? 0) - x(b.x0 ?? 0) - 1)}
        height={y(0) - y(b.length)}
      />
    {/each}
    <path class="model" d={curve} />
    <line class="axis" x1={PAD.l} x2={width - PAD.r} y1={H - PAD.b} y2={H - PAD.b} />
    <line class="truth" x1={x(TRUTH.f)} x2={x(TRUTH.f)} y1={PAD.t - 6} y2={H - PAD.b} />
    <text class="ok" x={x(TRUTH.f) + 6} y={PAD.t - 8}>the truth, {TRUTH.f} Hz</text>
    {#each ticks as v (v)}
      <text x={x(v)} y={H - 10} text-anchor="middle">{v} Hz</text>
    {/each}
  </svg>

  <ul class="legend">
    <li><i class="k-bar"></i>where the fits landed</li>
    <li><i class="k-model"></i>what one fit’s error bar predicts</li>
    <li><i class="k-truth"></i>the frequency that was put in</li>
  </ul>

  <fieldset class="levels">
    <legend>How loud the ring is</legend>
    {#each LEVELS as l (l.id)}
      <label>
        <input type="radio" name="injection-level" value={l.id} bind:group={level} />
        {l.label}
      </label>
    {/each}
  </fieldset>

  <dl class="numbers" aria-live="polite">
    <div>
      <dt>signal-to-noise ratio</dt>
      <dd>{snr.toFixed(0)}</dd>
    </div>
    <div>
      <dt>fits so far</dt>
      <dd>{shown.length} of {COUNT}</dd>
    </div>
    <div>
      <dt>average answer</dt>
      <dd>{Number.isFinite(mean) ? `${mean.toFixed(1)} Hz` : '…'}</dd>
    </div>
    <div>
      <dt>spread of the answers</dt>
      <dd>{Number.isFinite(spread) ? `±${spread.toFixed(1)} Hz` : '…'}</dd>
    </div>
    <div>
      <dt>error bar one fit reports</dt>
      <dd>±{reported.toFixed(1)} Hz</dd>
    </div>
  </dl>
  {#if outside > 0}
    <p class="figure-note">{outside} of the fits landed outside the range drawn.</p>
  {/if}
</div>

<style>
  .injections {
    width: 100%;
  }

  .bar {
    fill: var(--signal);
    opacity: 0.75;
  }

  .truth {
    stroke: var(--ok);
    stroke-width: 1.6;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.3rem 1.2rem;
    margin: 0.4rem 0 0;
    padding: 0;
    list-style: none;
    font-size: 0.85rem;
    color: var(--ink-soft);
  }

  .legend li {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }

  .legend i {
    display: block;
    width: 16px;
    height: 3px;
    border-radius: 2px;
  }

  .k-bar {
    height: 10px !important;
    width: 10px !important;
    background: var(--signal);
    opacity: 0.75;
  }

  .k-model {
    background: repeating-linear-gradient(90deg, var(--model) 0 5px, transparent 5px 8px);
  }

  .k-truth {
    background: var(--ok);
  }

  .levels {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1rem;
    margin: 0.7rem 0 0;
    padding: 0;
    border: 0;
    font-size: 0.9rem;
    color: var(--ink);
  }

  .levels legend {
    float: left;
    margin-right: 0.5rem;
    color: var(--ink-soft);
  }

  .levels label {
    display: inline-flex;
    gap: 0.3rem;
    align-items: center;
  }

  input {
    accent-color: var(--ink);
  }

  .numbers {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.5rem 1.2rem;
    margin: 0.8rem 0 0;
  }

  .numbers dt {
    font-size: 0.8rem;
    color: var(--ink-soft);
  }

  .numbers dd {
    margin: 0;
    font-size: 1.05rem;
    font-variant-numeric: tabular-nums;
    color: var(--ink);
  }

  .figure-note {
    margin: 0.5rem 0 0;
    font-size: 0.9rem;
    color: var(--ink-soft);
  }
</style>
