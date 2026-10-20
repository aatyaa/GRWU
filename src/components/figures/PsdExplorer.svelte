<script lang="ts">
  import { scaleLog } from 'd3-scale';
  import { onMount } from 'svelte';
  import { loadDataset } from '~/lib/data/dataset';
  import { aligoDesignPsd } from '~/lib/dsp/models';
  import { withBase } from '~/lib/url';
  import { dspWorker } from '~/lib/workers/dsp';

  /**
   * Every Signal Is a Chord: the noise of a real detector. 32 s of LIGO Hanford or Livingston
   * strain around GW150914 (GWOSC, CC BY 4.0), its amplitude spectral density by Welch's method
   * (lib/dsp/welch.ts, checked against scipy) in a worker, and the Advanced LIGO design curve
   * as a dashed model. The reader chooses the detector and the segment length: short segments
   * give a smooth but blurred curve, long ones a sharp but noisy one.
   */
  const SEGMENTS = [0.25, 1, 4];
  const F_MIN = 10;
  const F_MAX = 1500; // GWOSC's 4 kHz data are filtered against aliasing above about 1.7 kHz

  let detector = $state<'H1' | 'L1'>('H1');
  let segment = $state(1);
  let width = $state(640);
  let hydrated = $state(false);
  let phase = $state<'loading' | 'ready' | 'error'>('loading');
  let asd = $state<{ f: number; a: number }[]>([]);
  let segments = $state(0);

  let request = 0;
  async function compute(det: 'H1' | 'L1', seconds: number) {
    const id = ++request;
    phase = 'loading';
    try {
      const data = await loadDataset(withBase('data/events/GW150914'), { channels: [det] });
      const ch = data.channels[det];
      const est = await dspWorker().welch(ch.stored, {
        sampleRate: ch.sampleRate,
        nperseg: seconds * ch.sampleRate,
      });
      if (id !== request) return;
      const points: { f: number; a: number }[] = [];
      for (let k = 1; k < est.freqs.length; k++) {
        const f = est.freqs[k];
        if (f >= F_MIN && f <= F_MAX) points.push({ f, a: Math.sqrt(est.psd[k]) * ch.scale });
      }
      asd = points;
      segments = est.segments;
      phase = 'ready';
    } catch {
      if (id === request) phase = 'error';
    }
  }
  onMount(() => {
    hydrated = true;
  });
  $effect(() => {
    if (hydrated) void compute(detector, segment);
  });

  const H = 300;
  const PAD = { l: 52, r: 14, t: 12, b: 32 };
  const x = $derived(
    scaleLog()
      .domain([F_MIN, F_MAX])
      .range([PAD.l, width - PAD.r]),
  );
  const y = scaleLog()
    .domain([1e-24, 1e-19])
    .range([H - PAD.b, PAD.t])
    .clamp(true);
  const dataPath = $derived(
    asd.map((p, i) => `${i ? 'L' : 'M'}${x(p.f).toFixed(1)},${y(p.a).toFixed(1)}`).join(''),
  );
  const designPath = $derived(
    Array.from({ length: 200 }, (_, i) => {
      const f = F_MIN * (F_MAX / F_MIN) ** (i / 199);
      return `${i ? 'L' : 'M'}${x(f).toFixed(1)},${y(Math.sqrt(aligoDesignPsd(f))).toFixed(1)}`;
    }).join(''),
  );
  /** The quietest frequency, where the detector listens best. */
  const quietest = $derived(asd.length ? asd.reduce((m, p) => (p.a < m.a ? p : m)) : null);
  /** An exponent in superscript digits, e.g. −23 → ⁻²³. */
  const sup = (e: number) =>
    String(e)
      .replace('-', '⁻')
      .replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);
  const fmt = (v: number) => {
    const e = Math.floor(Math.log10(v));
    return `${(v / 10 ** e).toFixed(1)} × 10${sup(e)}`;
  };
</script>

<div
  class="psd"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-state={phase}
  data-segments={segments}
  data-quietest={quietest ? quietest.f.toFixed(0) : ''}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={quietest
      ? `Amplitude spectral density of ${detector} around GW150914 from 10 to 1500 hertz: highest at low frequency, quietest near ${quietest.f.toFixed(0)} hertz, with narrow lines. The design curve is shown dashed.`
      : 'Amplitude spectral density of LIGO data, loading.'}
  >
    {#each [1e-24, 1e-23, 1e-22, 1e-21, 1e-20, 1e-19] as v (v)}
      <line class="grid" x1={PAD.l} x2={width - PAD.r} y1={y(v)} y2={y(v)} />
      <text class="tick" x={PAD.l - 6} y={y(v) + 4} text-anchor="end"
        >10{sup(Math.round(Math.log10(v)))}</text
      >
    {/each}
    {#each [10, 30, 100, 300, 1000] as f (f)}
      <text class="tick" x={x(f)} y={H - 10} text-anchor={f === 10 ? 'start' : 'middle'}
        >{f} Hz</text
      >
    {/each}
    <path class="design" d={designPath} />
    {#if phase === 'ready'}<path class="data" d={dataPath} />{/if}
    {#if phase === 'loading'}
      <text class="tick" x={width / 2} y={H / 2} text-anchor="middle"
        >Loading 32 s of {detector} data…</text
      >
    {/if}
    {#if phase === 'error'}
      <text class="tick" x={width / 2} y={H / 2} text-anchor="middle"
        >The data could not be loaded.</text
      >
    {/if}
  </svg>

  <ul class="key">
    <li><i class="k-data"></i>LIGO {detector}, September 2015 (measured)</li>
    <li><i class="k-design"></i>Advanced LIGO design (model)</li>
  </ul>
  <div class="controls">
    <fieldset>
      <legend>Detector</legend>
      <label><input type="radio" name="psd-det" value="H1" bind:group={detector} /> Hanford</label>
      <label
        ><input type="radio" name="psd-det" value="L1" bind:group={detector} /> Livingston</label
      >
    </fieldset>
    <fieldset>
      <legend>Segment length</legend>
      {#each SEGMENTS as s (s)}
        <label><input type="radio" name="psd-seg" value={s} bind:group={segment} /> {s} s</label>
      {/each}
    </fieldset>
  </div>
  {#if quietest && phase === 'ready'}
    <p class="figure-note">
      Averaged over <b>{segments}</b> segments. Quietest near <b>{quietest.f.toFixed(0)} Hz</b>, at
      <b>{fmt(quietest.a)}</b> per √Hz.
    </p>
  {/if}
</div>

<style>
  .psd {
    width: 100%;
  }

  .grid {
    stroke: var(--rule-soft);
  }

  .tick {
    font-size: 11px;
    fill: var(--ink-soft);
  }

  .data {
    fill: none;
    stroke: var(--signal);
    stroke-width: 1.2;
  }

  .design {
    fill: none;
    stroke: var(--model);
    stroke-width: 1.5;
    stroke-dasharray: 6 4;
  }

  .key {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1.2rem;
    margin: 0.4rem 0 0;
    padding: 0;
    list-style: none;
    font-size: 0.85rem;
    color: var(--ink-soft);
  }

  .key li {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }

  .key i {
    display: block;
    width: 16px;
    height: 3px;
    border-radius: 2px;
  }

  .k-data {
    background: var(--signal);
  }

  .k-design {
    background: repeating-linear-gradient(90deg, var(--model) 0 5px, transparent 5px 8px);
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1.4rem;
    margin-top: 0.6rem;
  }

  fieldset {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.9rem;
    margin: 0;
    padding: 0;
    border: 0;
    font-size: 0.9rem;
    color: var(--ink);
  }

  legend {
    float: left;
    margin-right: 0.4rem;
    color: var(--ink-soft);
  }

  fieldset label {
    display: inline-flex;
    gap: 0.3rem;
    align-items: center;
  }

  input {
    accent-color: var(--ink);
  }

  .figure-note {
    margin: 0.5rem 0 0;
    font-size: 0.9rem;
    color: var(--ink-soft);
  }

  b {
    color: var(--ink);
  }
</style>
