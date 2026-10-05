<script lang="ts">
  import { scaleLinear } from 'd3-scale';
  import { onDestroy, onMount } from 'svelte';
  import { tween } from '~/lib/figure/pointer';
  import {
    RANGE,
    ringData,
    reducedChi2 as reduced,
    SIGMA,
    times as t,
  } from '~/lib/figure/ring-in-noise';
  import { amplitudes, fitRing, ringModel } from '~/lib/stats/ringfit';

  /**
   * Fitting a Ring in Noise: one damped tone (250 Hz, τ = 4 ms) in white noise of known spread,
   * sampled at 4096 Hz (lib/figure/ring-in-noise.ts, shared with the article's text). The
   * reader sets the frequency and damping time; for each setting the best amplitude and phase
   * are solved exactly (stats/ringfit.ts), so the curve always fits as well as those two numbers
   * allow. Below the data: what is left over, and the reduced χ² at every frequency for the
   * chosen damping time. "Fit it for me" runs the least-squares search, checked against
   * scipy's curve_fit.
   */
  const START = { f: 200, tau: 0.008 };
  const N = t.length;
  const FS = 1 / (t[1] - t[0]);
  const y = ringData();
  const best = fitRing(t, y, RANGE);

  let f = $state(START.f);
  let tauMs = $state(START.tau * 1000);
  let width = $state(640);
  let hydrated = $state(false);
  let cancel: (() => void) | undefined;
  onMount(() => {
    hydrated = true;
  });
  onDestroy(() => cancel?.());

  const fit = $derived(amplitudes(t, y, f, tauMs / 1000));
  const model = $derived(ringModel(t, { f, tau: tauMs / 1000, a: fit.a, b: fit.b }));
  const chi2 = $derived(reduced(fit.rss));
  const fitted = $derived(
    Math.abs(f - best.f) < 0.5 && Math.abs(tauMs / 1000 / best.tau - 1) < 0.02,
  );

  // χ² across frequency at the chosen damping time: the valley the search slides into.
  const FREQS = Array.from({ length: 201 }, (_, i) => RANGE.fMin + i);
  const landscape = $derived(FREQS.map((v) => reduced(amplitudes(t, y, v, tauMs / 1000).rss)));

  const PAD = { l: 40, r: 12 };
  const H_DATA = 190;
  const H_RES = 90;
  const H_LAND = 120;
  const x = $derived(
    scaleLinear()
      .domain([0, (N - 1) / FS])
      .range([PAD.l, width - PAD.r]),
  );
  const yData = scaleLinear()
    .domain([-1.3, 1.3])
    .range([H_DATA - 22, 8]);
  const yRes = scaleLinear()
    .domain([-0.6, 0.6])
    .range([H_RES - 8, 8]);
  const fx = $derived(
    scaleLinear()
      .domain([RANGE.fMin, RANGE.fMax])
      .range([PAD.l, width - PAD.r]),
  );
  // A fixed scale: χ² ranges from about 0.9 at the best fit to about 2.2 for no ring at all.
  const yLand = scaleLinear()
    .domain([0.6, 2.4])
    .range([H_LAND - 26, 8])
    .clamp(true);
  const line = (values: ArrayLike<number>, sx: (i: number) => number, sy: (v: number) => number) =>
    Array.from(values, (v, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(
      '',
    );
  const msTicks = [0, 10, 20, 30];
  const fTicks = $derived(width < 480 ? [150, 250, 350] : [150, 200, 250, 300, 350]);

  function fitForMe() {
    cancel?.();
    const [f0, tau0] = [f, tauMs];
    const [f1, tau1] = [best.f, best.tau * 1000];
    cancel = tween(0, 1, (u) => {
      f = f0 + (f1 - f0) * u;
      tauMs = tau0 + (tau1 - tau0) * u;
    });
  }

  function reset() {
    cancel?.();
    f = START.f;
    tauMs = START.tau * 1000;
  }
</script>

<div
  class="ring-fit"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-f={f.toFixed(1)}
  data-tau-ms={tauMs.toFixed(2)}
  data-chi2={chi2.toFixed(2)}
  data-fitted={fitted}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H_DATA}"
    {width}
    height={H_DATA}
    role="img"
    aria-label={`A ringing signal in noise, ${N} samples, with a fitted ring of ${f.toFixed(1)} Hz fading in ${tauMs.toFixed(1)} ms.`}
  >
    <line class="axis" x1={PAD.l} x2={width - PAD.r} y1={yData(0)} y2={yData(0)} />
    {#each msTicks as ms (ms)}
      <text x={x(ms / 1000)} y={H_DATA - 6} text-anchor={ms ? 'middle' : 'start'}>{ms} ms</text>
    {/each}
    <text x={PAD.l - 6} y={yData(1) + 4} text-anchor="end">+1</text>
    <text x={PAD.l - 6} y={yData(-1) + 4} text-anchor="end">−1</text>
    {#each y as v, i (i)}
      <circle class="sample" cx={x(t[i])} cy={yData(v)} r="2" />
    {/each}
    <path class="model" d={line(model, (i) => x(t[i]), yData)} />
  </svg>

  <svg
    class="fig"
    viewBox="0 0 {width} {H_RES}"
    {width}
    height={H_RES}
    role="img"
    aria-label="What the fitted ring leaves over, sample by sample, against the band the noise alone would fill."
  >
    <rect
      class="area-noise"
      x={PAD.l}
      y={yRes(SIGMA)}
      width={width - PAD.l - PAD.r}
      height={yRes(-SIGMA) - yRes(SIGMA)}
    />
    <line class="axis" x1={PAD.l} x2={width - PAD.r} y1={yRes(0)} y2={yRes(0)} />
    <text x={PAD.l - 6} y={yRes(0) + 4} text-anchor="end">0</text>
    {#each y as v, i (i)}
      <circle
        class="residual"
        cx={x(t[i])}
        cy={yRes(Math.max(-0.6, Math.min(0.6, v - model[i])))}
        r="1.8"
      />
    {/each}
  </svg>

  <svg
    class="fig"
    viewBox="0 0 {width} {H_LAND}"
    {width}
    height={H_LAND}
    role="img"
    aria-label={`The reduced chi-squared at each frequency for a damping time of ${tauMs.toFixed(1)} ms. At ${f.toFixed(1)} Hz it is ${chi2.toFixed(2)}.`}
  >
    <line class="one" x1={PAD.l} x2={width - PAD.r} y1={yLand(1)} y2={yLand(1)} />
    <line class="one" x1={PAD.l} x2={width - PAD.r} y1={yLand(2)} y2={yLand(2)} />
    <text x={PAD.l - 6} y={yLand(1) + 4} text-anchor="end">1</text>
    <text x={PAD.l - 6} y={yLand(2) + 4} text-anchor="end">2</text>
    <path class="data" d={line(landscape, (i) => fx(FREQS[i]), yLand)} />
    {#each fTicks as v (v)}
      <text
        x={fx(v)}
        y={H_LAND - 6}
        text-anchor={v === RANGE.fMin ? 'start' : v === RANGE.fMax ? 'end' : 'middle'}>{v} Hz</text
      >
    {/each}
    <circle class="here" cx={fx(f)} cy={yLand(chi2)} r="5" />
  </svg>

  <ul class="legend">
    <li><i class="k-sample"></i>the data</li>
    <li><i class="k-model"></i>your ring</li>
    <li><i class="k-noise"></i>the noise’s typical size</li>
    <li><i class="k-land"></i>reduced χ² at each frequency</li>
  </ul>

  <div class="sliders">
    <label>
      <span>Frequency <b>{f.toFixed(1)} Hz</b></span>
      <input type="range" min={RANGE.fMin} max={RANGE.fMax} step="0.5" bind:value={f} />
    </label>
    <label>
      <span>Damping time <b>{tauMs.toFixed(1)} ms</b></span>
      <input
        type="range"
        min={RANGE.tauMin * 1000}
        max={RANGE.tauMax * 1000}
        step="0.1"
        bind:value={tauMs}
      />
    </label>
  </div>

  <div class="controls">
    <p class="readout" aria-live="polite">
      <span>reduced χ² <b class:signal={fitted}>{chi2.toFixed(2)}</b></span>
      <span>
        {#if fitted}
          the best fit: what is left looks like noise
        {:else}
          best possible <b>{reduced(best.rss).toFixed(2)}</b>
        {/if}
      </span>
    </p>
    <button type="button" class="btn" onclick={fitForMe} disabled={fitted}>Fit it for me</button>
    <button type="button" class="btn" onclick={reset}>Reset</button>
  </div>
</div>

<style>
  .ring-fit {
    width: 100%;
  }

  .ring-fit svg + svg {
    margin-top: 0.4rem;
  }

  .sample {
    fill: var(--signal);
  }

  .residual {
    fill: var(--signal);
    opacity: 0.8;
  }

  .one {
    stroke: var(--ink-faint);
    stroke-dasharray: 2 3;
  }

  .here {
    fill: var(--surface);
    stroke: var(--ink);
    stroke-width: 2;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.3rem 1.2rem;
    margin: 0.5rem 0 0;
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

  .k-sample {
    width: 6px !important;
    height: 6px !important;
    border-radius: 50% !important;
    background: var(--signal);
  }

  .k-model {
    background: repeating-linear-gradient(90deg, var(--model) 0 5px, transparent 5px 8px);
  }

  .k-noise {
    height: 10px !important;
    background: color-mix(in srgb, var(--noise) 18%, transparent);
  }

  .k-land {
    background: var(--ink-soft);
  }

  .sliders {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: 0.6rem 1.2rem;
    margin-top: 0.7rem;
    font-size: 0.9rem;
    color: var(--ink-soft);
  }

  .sliders label {
    display: grid;
    gap: 0.25rem;
  }

  b {
    color: var(--ink);
  }

  input[type='range'] {
    width: 100%;
    accent-color: var(--ink);
  }

  .controls .readout {
    margin: 0;
  }
</style>
