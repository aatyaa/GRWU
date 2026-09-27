<script lang="ts">
  import { onMount } from 'svelte';
  import { scaleLog } from 'd3-scale';
  import { play, stop } from '~/lib/audio/play';
  import { aligoDesignPsd } from '~/lib/dsp/models';
  import { powerOfTen, scientific } from '~/lib/format';
  import { highlightedTerm } from '~/lib/state';
  import { dspWorker } from '~/lib/workers/dsp';
  import {
    loadChannel,
    params,
    spectrum,
    type SkeletonDataset,
    type SpectrumResult,
  } from './skeleton-state';

  interface Props {
    datasets: SkeletonDataset[];
  }
  let { datasets }: Props = $props();
  // Unique per instance, so two figures on one page keep their ids and radio groups apart.
  const uid = $props.id();

  const SEGMENTS = [0.25, 0.5, 1, 2, 4, 8];
  const F_MIN = 10;
  const F_MAX = 2048;
  const MARGIN = { top: 12, right: 16, bottom: 40, left: 56 };
  const X_TICKS = [10, 20, 50, 100, 200, 500, 1000, 2000];

  let settings = $state(params.get());
  let result = $state<SpectrumResult | null>(null);
  let status = $state<'loading' | 'ready' | 'error'>('loading');
  let message = $state('');
  let highlight = $state<string | null>(null);
  let audio = $state<'idle' | 'playing'>('idle');
  let hoverIndex = $state<number | null>(null);
  // Drawn at its real pixel size, so the text stays legible on a phone.
  let width = $state(640);
  const height = $derived(Math.round(Math.min(340, Math.max(240, width * 0.55))));

  const current = $derived(datasets.find((d) => d.id === settings.dataset) ?? datasets[0]);
  const segmentIndex = $derived(Math.max(0, SEGMENTS.indexOf(settings.segment)));

  let request = 0;
  async function compute(info: SkeletonDataset, segment: number, average: 'mean' | 'median') {
    const id = ++request;
    status = 'loading';
    try {
      const data = await loadChannel(info, info.channel);
      const nperseg = segment * data.sampleRate;
      // Welch on the stored (scaled) values, then rescale: PSD is quadratic in the data.
      const estimate = await dspWorker().welch(data.stored, {
        sampleRate: data.sampleRate,
        nperseg,
        average,
      });
      if (id !== request) return;
      const scale2 = data.scale * data.scale;
      result = {
        datasetId: info.id,
        channel: info.channel,
        nperseg,
        average,
        segments: estimate.segments,
        freqs: estimate.freqs,
        psd: estimate.psd.map((p) => p * scale2),
        stored: data.stored,
        scale: data.scale,
        sampleRate: data.sampleRate,
      };
      spectrum.set(result);
      status = 'ready';
    } catch (error) {
      if (id !== request) return;
      status = 'error';
      message = error instanceof Error ? error.message : String(error);
    }
  }

  $effect(() => {
    void compute(current, settings.segment as number, settings.average as 'mean' | 'median');
  });

  onMount(() => {
    const offParams = params.subscribe((value) => (settings = { ...value }));
    const offHighlight = highlightedTerm.subscribe((term) => (highlight = term));
    return () => {
      offParams();
      offHighlight();
      stop();
    };
  });

  // Scales and paths
  const inBand = $derived.by(() => {
    if (!result) return [] as number[];
    const indices: number[] = [];
    result.freqs.forEach((f, i) => {
      if (f >= F_MIN && f <= F_MAX) indices.push(i);
    });
    return indices;
  });

  const design = Array.from({ length: 160 }, (_, i) => {
    const f = F_MIN * (F_MAX / F_MIN) ** (i / 159);
    return [f, Math.sqrt(aligoDesignPsd(f))] as const;
  });

  const x = $derived(
    scaleLog()
      .domain([F_MIN, F_MAX])
      .range([MARGIN.left, width - MARGIN.right]),
  );

  const y = $derived.by(() => {
    let lo = Infinity;
    let hi = 0;
    for (const [, asd] of design) {
      lo = Math.min(lo, asd);
      hi = Math.max(hi, asd);
    }
    if (result) {
      for (const i of inBand) {
        const asd = Math.sqrt(result.psd[i]);
        if (asd > 0) {
          lo = Math.min(lo, asd);
          hi = Math.max(hi, asd);
        }
      }
    }
    const bottom = 10 ** Math.floor(Math.log10(lo));
    const top = 10 ** Math.ceil(Math.log10(hi));
    return scaleLog()
      .domain([bottom, top])
      .range([height - MARGIN.bottom, MARGIN.top]);
  });

  function line(points: Iterable<readonly [number, number]>): string {
    let d = '';
    for (const [f, asd] of points) d += `${d ? 'L' : 'M'}${x(f).toFixed(1)},${y(asd).toFixed(1)}`;
    return d;
  }

  const dataPath = $derived.by(() => {
    if (!result) return '';
    const r = result;
    return line(inBand.map((i) => [r.freqs[i], Math.sqrt(r.psd[i])] as const));
  });
  const designPath = $derived(line(design));

  // A narrow plot labels only the decades; every tick keeps its grid line.
  const xLabels = $derived(width < 480 ? [10, 100, 1000] : X_TICKS);
  const yTicks = $derived.by(() => {
    const [lo, hi] = y.domain();
    const ticks: number[] = [];
    for (let e = Math.round(Math.log10(lo)); e <= Math.round(Math.log10(hi)); e++)
      ticks.push(10 ** e);
    return ticks;
  });

  const summary = $derived.by(() => {
    if (!result) return '';
    const r = result;
    let best = inBand[0] ?? 0;
    for (const i of inBand) if (r.psd[i] < r.psd[best]) best = i;
    return `Amplitude spectral density of ${current.label}, from ${F_MIN} Hz to ${F_MAX} Hz, estimated from ${r.segments} segments. Lowest: ${scientific(Math.sqrt(r.psd[best]))} per root hertz near ${Math.round(r.freqs[best])} Hz.`;
  });

  const hover = $derived.by(() => {
    if (!result || hoverIndex === null || hoverIndex >= result.freqs.length) return null;
    return { f: result.freqs[hoverIndex], asd: Math.sqrt(result.psd[hoverIndex]) };
  });

  function onPointerMove(event: PointerEvent) {
    if (!result || inBand.length === 0) return;
    const svg = event.currentTarget as SVGSVGElement;
    const box = svg.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * width;
    const f = x.invert(Math.min(Math.max(px, MARGIN.left), width - MARGIN.right));
    const df = result.freqs[1] - result.freqs[0];
    hoverIndex = Math.min(inBand[inBand.length - 1], Math.max(inBand[0], Math.round(f / df)));
    // Pointing at the curve lights up its symbol in the equation, and vice versa.
    if (highlightedTerm.get() !== 'psd') highlightedTerm.set('psd');
  }

  function onPointerLeave() {
    hoverIndex = null;
    if (highlightedTerm.get() === 'psd') highlightedTerm.set(null);
  }

  async function listen(which: 'data' | 'signal') {
    const name =
      which === 'signal' && current.signalChannel ? current.signalChannel : current.channel;
    const data = await loadChannel(current, name);
    audio = 'playing';
    await play(data.stored, {
      sampleRate: data.sampleRate,
      from: Math.max(0, current.listenAt - 2.5),
      seconds: 3,
      onEnded: () => (audio = 'idle'),
    });
  }

  function silence() {
    stop();
    audio = 'idle';
  }
</script>

<figure
  class="spectrum"
  data-state={status}
  data-dataset={result?.datasetId ?? ''}
  data-highlight={highlight ?? ''}
  data-segments={result?.segments ?? ''}
  data-audio={audio}
>
  <div class="spectrum__controls">
    <label>
      Data
      <select
        value={settings.dataset}
        onchange={(e) => params.setKey('dataset', e.currentTarget.value)}
      >
        {#each datasets as option (option.id)}
          <option value={option.id}>{option.label}</option>
        {/each}
      </select>
    </label>
    <div class="spectrum__field">
      <!-- A plain span, not <output>: an <output> inside the label would take its name. -->
      <span><label for="{uid}-segment">Segment length</label> {SEGMENTS[segmentIndex]} s</span>
      <input
        id="{uid}-segment"
        type="range"
        min="0"
        max={SEGMENTS.length - 1}
        step="1"
        value={segmentIndex}
        aria-valuetext="{SEGMENTS[segmentIndex]} seconds"
        oninput={(e) => params.setKey('segment', SEGMENTS[Number(e.currentTarget.value)])}
      />
    </div>
    <fieldset>
      <legend>Average</legend>
      {#each ['mean', 'median'] as option (option)}
        <label>
          <input
            type="radio"
            name="{uid}-average"
            value={option}
            checked={settings.average === option}
            onchange={() => params.setKey('average', option)}
          />
          {option}
        </label>
      {/each}
    </fieldset>
  </div>

  <ul class="spectrum__legend">
    <li><span class="swatch swatch--data"></span> Estimated from the data, Ŝ(f)</li>
    <li><span class="swatch swatch--design"></span> Advanced LIGO design (model)</li>
  </ul>

  <div bind:clientWidth={width}>
    <svg
      viewBox="0 0 {width} {height}"
      role="img"
      aria-labelledby="{uid}-title"
      aria-describedby="{uid}-desc"
      onpointermove={onPointerMove}
      onpointerleave={onPointerLeave}
    >
      <title id="{uid}-title">Noise spectrum of {current.label}</title>
      <desc id="{uid}-desc">{summary}</desc>
      <g class="grid">
        {#each X_TICKS as tick (tick)}
          <line x1={x(tick)} x2={x(tick)} y1={MARGIN.top} y2={height - MARGIN.bottom} />
          {#if xLabels.includes(tick)}
            <text x={x(tick)} y={height - MARGIN.bottom + 18} text-anchor="middle">{tick}</text>
          {/if}
        {/each}
        {#each yTicks as tick (tick)}
          <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} />
          <text x={MARGIN.left - 8} y={y(tick) + 4} text-anchor="end">{powerOfTen(tick)}</text>
        {/each}
        <text
          class="axis-label"
          x={(MARGIN.left + width - MARGIN.right) / 2}
          y={height - 4}
          text-anchor="middle"
        >
          Frequency (Hz)
        </text>
      </g>
      <path class="data" d={dataPath} />
      <!-- The model goes on top: noise simulated at design sensitivity would hide it. -->
      <path class="design" d={designPath} />
      {#if hover}
        <line
          class="crosshair"
          x1={x(hover.f)}
          x2={x(hover.f)}
          y1={MARGIN.top}
          y2={height - MARGIN.bottom}
        />
        <circle class="crosshair-dot" cx={x(hover.f)} cy={y(hover.asd)} r="4" />
      {/if}
    </svg>
  </div>

  <p class="spectrum__readout" aria-hidden="true">
    {#if hover}
      {hover.f.toFixed(2)} Hz: {scientific(hover.asd)} /√Hz
    {:else}
      Strain amplitude spectral density (1/√Hz). Point at the curve to read it.
    {/if}
  </p>

  <div class="spectrum__listen">
    <button type="button" onclick={() => listen('data')}>Listen to the data</button>
    {#if current.signalChannel}
      <button type="button" onclick={() => listen('signal')}>Listen to the chirp alone</button>
    {/if}
    <button type="button" onclick={silence} disabled={audio !== 'playing'}>Stop</button>
  </div>

  <figcaption aria-live="polite">
    {#if status === 'error'}
      Could not compute the spectrum: {message}
    {:else if result}
      {result.segments} segments of {SEGMENTS[segmentIndex]} s, so the frequency resolution is 1/{SEGMENTS[
        segmentIndex
      ]} s = {(1 / SEGMENTS[segmentIndex]).toFixed(2)} Hz.
    {:else}
      Loading data…
    {/if}
  </figcaption>
</figure>

<style>
  .spectrum {
    margin: var(--space-8) 0;
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-2);
    background: var(--surface-1);
  }

  .spectrum__controls {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4) var(--space-8);
    align-items: end;
    font-size: var(--text-sm);
  }

  .spectrum__controls > label,
  .spectrum__field {
    display: grid;
    gap: var(--space-1);
  }

  .spectrum__controls fieldset {
    display: flex;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    border: 0;
  }

  .spectrum__controls fieldset label {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .spectrum__controls legend {
    margin-bottom: var(--space-1);
    padding: 0;
  }

  .spectrum__legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    margin: var(--space-4) 0 var(--space-2);
    padding: 0;
    list-style: none;
    font-size: var(--text-sm);
    color: var(--ink-2);
  }

  .swatch {
    display: inline-block;
    width: 1.5rem;
    height: 0;
    margin-inline-end: var(--space-1);
    vertical-align: middle;
    border-top: 2px solid var(--c-data);
  }

  .swatch--design {
    border-top: 2px dashed var(--c-noise);
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
    /* Vertical swipes still scroll the page; horizontal ones read the curve. */
    touch-action: pan-y;
  }

  .grid line {
    stroke: var(--grid);
    stroke-width: 1;
  }

  .grid text {
    fill: var(--ink-2);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .data {
    fill: none;
    stroke: var(--c-data);
    stroke-width: 1.5;
    stroke-linejoin: round;
    transition: stroke-width var(--dur-fast) var(--ease);
  }

  [data-highlight='psd'] .data {
    stroke-width: 3;
  }

  .design {
    fill: none;
    stroke: var(--c-noise);
    stroke-width: 2;
    stroke-dasharray: 6 4;
  }

  .crosshair {
    stroke: var(--ink-muted);
    stroke-dasharray: 2 3;
  }

  .crosshair-dot {
    fill: var(--c-data);
    stroke: var(--surface-1);
    stroke-width: 2;
  }

  .spectrum__readout {
    margin: var(--space-1) 0;
    min-height: 1.5em;
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
    color: var(--ink-2);
  }

  .spectrum__listen {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin: var(--space-2) 0 var(--space-3);
  }

  figcaption {
    font-size: var(--text-sm);
    color: var(--ink-2);
  }

  button,
  select {
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-1);
    background: var(--surface-2);
    color: var(--ink-1);
    font: inherit;
    font-size: var(--text-sm);
  }

  button {
    cursor: pointer;
  }

  button:disabled {
    cursor: default;
    opacity: 0.6;
  }
</style>
