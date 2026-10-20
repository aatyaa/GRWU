<script lang="ts">
  import { scaleLinear } from 'd3-scale';
  import { onMount } from 'svelte';
  import { rfft } from '~/lib/dsp/fft';

  /**
   * Every Signal Is a Chord: three tones the reader tunes, their sum in time, and the spectrum
   * that takes the sum apart again. The spectrum is the real FFT of the summed samples
   * (lib/dsp/fft.ts, checked against numpy), scaled so a tone of amplitude A shows as a bar of
   * height A.
   */
  const FS = 256;
  const N = 512; // two seconds: 0.5 Hz between frequency bins
  const SHOW_S = 1;
  const F_MAX = 64;

  let tones = $state([
    { f: 5, a: 1, on: true },
    { f: 12, a: 0.6, on: true },
    { f: 30, a: 0.3, on: true },
  ]);
  let width = $state(640);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  const samples = $derived.by(() => {
    const x = new Float64Array(N);
    for (const tone of tones) {
      if (!tone.on) continue;
      for (let i = 0; i < N; i++) x[i] += tone.a * Math.sin((2 * Math.PI * tone.f * i) / FS);
    }
    return x;
  });
  const amplitude = $derived.by(() => {
    const { re, im } = rfft(samples);
    return Array.from(re, (r, k) => (2 * Math.hypot(r, im[k])) / N);
  });
  const peaks = $derived(
    amplitude
      .map((a, k) => ({ f: (k * FS) / N, a }))
      .filter((p) => p.a > 0.05 && p.f <= F_MAX)
      .map((p) => p.f),
  );

  const PAD = { l: 14, r: 14 };
  const TOP = { y0: 10, y1: 150 };
  const BOT = { y0: 196, y1: 300 };
  const H = 330;
  const xt = $derived(
    scaleLinear()
      .domain([0, SHOW_S])
      .range([PAD.l, width - PAD.r]),
  );
  const yt = scaleLinear().domain([-2, 2]).range([TOP.y1, TOP.y0]);
  const xf = $derived(
    scaleLinear()
      .domain([0, F_MAX])
      .range([PAD.l, width - PAD.r]),
  );
  const yf = scaleLinear().domain([0, 1.05]).range([BOT.y1, BOT.y0]);
  const shown = Math.round(SHOW_S * FS);
  const sumPath = $derived(
    Array.from(
      samples.subarray(0, shown + 1),
      (v, i) => `${i ? 'L' : 'M'}${xt(i / FS).toFixed(1)},${yt(v).toFixed(1)}`,
    ).join(''),
  );
</script>

<div
  class="tone-mixer"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-peaks={peaks.join(',')}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`The sum of ${tones.filter((t) => t.on).length} tones over one second, and its spectrum with peaks at ${peaks.join(', ')} hertz.`}
  >
    <text class="label" x={PAD.l} y={TOP.y0 + 4}>the sum, over one second</text>
    <line class="axis" x1={PAD.l} x2={width - PAD.r} y1={yt(0)} y2={yt(0)} />
    <path class="sum" d={sumPath} />

    <text class="label" x={PAD.l} y={BOT.y0 - 12}>its spectrum: how much of each frequency</text>
    <line class="axis" x1={PAD.l} x2={width - PAD.r} y1={BOT.y1} y2={BOT.y1} />
    {#each amplitude as a, k (k)}
      {#if a > 0.01 && (k * FS) / N <= F_MAX}
        <line class="bar" x1={xf((k * FS) / N)} x2={xf((k * FS) / N)} y1={BOT.y1} y2={yf(a)} />
      {/if}
    {/each}
    {#each [0, 10, 20, 30, 40, 50, 60] as f (f)}
      <text class="tick" x={xf(f)} y={H - 8} text-anchor={f === 0 ? 'start' : 'middle'}>{f} Hz</text
      >
    {/each}
  </svg>

  <div class="tones">
    {#each tones as tone, i (i)}
      <fieldset>
        <legend>
          <label class="on"><input type="checkbox" bind:checked={tone.on} /> Tone {i + 1}</label>
        </legend>
        <label>
          <span>frequency <b>{tone.f} Hz</b></span>
          <input type="range" min="1" max="60" step="1" bind:value={tone.f} disabled={!tone.on} />
        </label>
        <label>
          <span>loudness <b>{tone.a.toFixed(2)}</b></span>
          <input type="range" min="0" max="1" step="0.05" bind:value={tone.a} disabled={!tone.on} />
        </label>
      </fieldset>
    {/each}
  </div>
</div>

<style>
  .tone-mixer {
    width: 100%;
  }

  .axis {
    stroke: var(--rule);
  }

  .label,
  .tick {
    font-size: 11px;
    fill: var(--ink-soft);
  }

  .sum {
    fill: none;
    stroke: var(--signal);
    stroke-width: 1.6;
  }

  .bar {
    stroke: var(--signal);
    stroke-width: 4;
    stroke-linecap: round;
  }

  .tones {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0.6rem 1rem;
    margin-top: 0.6rem;
  }

  fieldset {
    display: grid;
    gap: 0.35rem;
    margin: 0;
    padding: 0.5rem 0.7rem 0.7rem;
    border: 1px solid var(--rule-soft);
    border-radius: 8px;
    font-size: 0.88rem;
    color: var(--ink-soft);
  }

  legend {
    padding: 0 0.3rem;
    font-weight: 600;
    color: var(--ink);
  }

  fieldset > label {
    display: grid;
    gap: 0.15rem;
  }

  b {
    color: var(--ink);
  }

  input[type='range'] {
    width: 100%;
    accent-color: var(--ink);
  }
</style>
