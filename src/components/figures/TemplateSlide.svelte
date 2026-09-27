<script lang="ts">
  import { untrack } from 'svelte';
  import type { TemplateSlideData } from '~/lib/articles/hidden';

  /**
   * Slide a known chirp along whitened data and watch the match score (Hidden in the Noise).
   * The data and scores are computed at build time from the toy-chirp dataset; the island
   * only draws them. The score curve fills in where the reader has looked.
   */
  let { data }: { data: TemplateSlideData } = $props();

  const B = $derived(data.score.length);
  const [w0, w1] = $derived(data.window);
  const bucket = $derived((w1 - w0) / B);
  const peakBucket = $derived(data.score.indexOf(Math.max(...data.score)));

  // The data never changes after mount, so the initial values are read once.
  const initial = untrack(() => ({ end: data.window[0] + 1.6, buckets: data.score.length }));
  let end = $state(initial.end);
  let visited = $state<boolean[]>(Array.from({ length: initial.buckets }, () => false));
  let noiseOnly = $state(false);

  const index = $derived(Math.min(B - 1, Math.max(0, Math.floor((end - w0) / bucket))));
  let last = -1;
  $effect(() => {
    const i = index;
    const from = last < 0 ? i : Math.min(last, i);
    const to = last < 0 ? i : Math.max(last, i);
    for (let k = from; k <= to; k++) visited[k] = true;
    last = i;
  });

  const score = $derived(data.score[index]);
  const found = $derived(index === peakBucket);

  let width = $state(640);
  const H = 352;
  const PAD = 12;
  const DATA_MID = 82;
  const DATA_HALF = 46;
  const SCORE_TOP = 196;
  const SCORE_BASE = 322;
  const SCORE_MAX = 22;
  const x = (t: number) => PAD + ((t - w0) / (w1 - w0)) * (width - 2 * PAD);
  const dataMax = $derived(Math.max(...data.data.hi.map(Math.abs), ...data.data.lo.map(Math.abs)));
  const dy = (v: number) => DATA_MID - (v / dataMax) * DATA_HALF;
  const sy = (s: number) =>
    SCORE_BASE - (Math.min(s, SCORE_MAX) / SCORE_MAX) * (SCORE_BASE - SCORE_TOP);
  const bt = (b: number) => w0 + (b + 0.5) * bucket;

  const dataBand = $derived.by(() => {
    let d = '';
    data.data.hi.forEach(
      (v, b) => (d += `${b ? 'L' : 'M'}${x(bt(b)).toFixed(1)},${dy(v).toFixed(1)}`),
    );
    for (let b = data.data.lo.length - 1; b >= 0; b--)
      d += `L${x(bt(b)).toFixed(1)},${dy(data.data.lo[b]).toFixed(1)}`;
    return `${d}Z`;
  });
  const templateBand = $derived.by(() => {
    const { t, lo, hi } = data.template;
    let d = '';
    t.forEach(
      (tt, i) => (d += `${i ? 'L' : 'M'}${x(end + tt).toFixed(1)},${dy(hi[i]).toFixed(1)}`),
    );
    for (let i = t.length - 1; i >= 0; i--)
      d += `L${x(end + t[i]).toFixed(1)},${dy(lo[i]).toFixed(1)}`;
    return `${d}Z`;
  });
  const scorePath = (values: number[], show: (b: number) => boolean) => {
    let d = '';
    let pen = false;
    values.forEach((s, b) => {
      if (!show(b)) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(bt(b)).toFixed(1)},${sy(s).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const seen = $derived(scorePath(data.score, (b) => visited[b]));
  const noisePath = $derived(scorePath(data.noiseScore, () => true));
  const seenCount = $derived(visited.filter(Boolean).length);
</script>

<div
  class="template-slide"
  bind:clientWidth={width}
  data-score={score.toFixed(1)}
  data-found={found}
  data-seen={seenCount}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label="Top: whitened data that looks like noise, with a chirp template placed at the chosen time. Bottom: the match score at every position tried so far. It stays near two or three everywhere except one sharp spike near twenty, where the template lines up with the chirp hidden in the data."
  >
    <text class="caps" x={PAD} y="16">the data, whitened · a chirp is in there somewhere</text>
    <path class="area-noise" d={dataBand} />
    <path class="template" d={templateBand} />
    <text class="model-label" x={x(end - 0.55)} y={DATA_MID + DATA_HALF + 18} text-anchor="middle">
      ↑ the template
    </text>

    <text class="caps" x={PAD} y={SCORE_TOP - 12}>match score at each position you have tried</text>
    {#each [0, 5, 10, 15, 20] as s (s)}
      <line class="grid" x1={PAD} x2={width - PAD} y1={sy(s)} y2={sy(s)} />
      <text x={width - PAD} y={sy(s) - 3} text-anchor="end">{s}</text>
    {/each}
    {#if noiseOnly}
      <path class="noise-score" d={noisePath} />
      <text x={PAD} y={sy(data.noisePeak) - 6}>
        noise alone: never above {data.noisePeak.toFixed(1)}
      </text>
    {/if}
    <path class="score" d={seen} />
    <line class="cursor" x1={x(end)} x2={x(end)} y1={SCORE_TOP} y2={SCORE_BASE} />
    <circle class="dot" cx={x(end)} cy={sy(score)} r="4" />
    {#if found}
      <text class="signal" x={x(end)} y={sy(score) - 10} text-anchor="middle">
        found it · SNR {score.toFixed(1)}
      </text>
    {/if}
  </svg>

  <div class="controls">
    <label class="slider">
      <span>Slide the template</span>
      <input
        type="range"
        min={w0 + 1.1}
        max={w1}
        step={bucket}
        bind:value={end}
        aria-valuetext={`template ends at ${(end - w0).toFixed(2)} s, score ${score.toFixed(1)}`}
      />
    </label>
    <button
      type="button"
      class="btn"
      onclick={() => {
        visited = visited.map(() => true);
        end = bt(peakBucket);
      }}
    >
      Scan the whole stretch
    </button>
    <button
      type="button"
      class="btn"
      aria-pressed={noiseOnly}
      onclick={() => (noiseOnly = !noiseOnly)}
    >
      {noiseOnly ? 'Hide noise alone' : 'Compare with noise alone'}
    </button>
    <span class="readout">score here <b>{score.toFixed(1)}</b></span>
  </div>
</div>

<style>
  .template-slide {
    width: 100%;
  }

  .template {
    fill: var(--model);
    opacity: 0.85;
  }

  .model-label {
    fill: var(--model);
  }

  .score {
    fill: none;
    stroke: var(--signal);
    stroke-width: 1.6;
  }

  .noise-score {
    fill: none;
    stroke: var(--noise);
    stroke-width: 1.2;
    stroke-dasharray: 4 3;
  }

  .cursor {
    stroke: var(--ink-faint);
    stroke-width: 1;
    stroke-dasharray: 2 3;
  }

  .slider {
    display: grid;
    flex: 1 1 14rem;
    gap: 0.25rem;
    font-size: var(--text-sm);
    color: var(--ink-soft);
  }
</style>
