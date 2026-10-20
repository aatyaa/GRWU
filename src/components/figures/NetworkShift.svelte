<script lang="ts">
  import { onMount } from 'svelte';
  import type { NetworkData } from '~/lib/articles/route';

  /**
   * Line up GW150914 in the two LIGO detectors (From Strain to Source): shift Livingston in
   * time and flip its sign until it matches Hanford. Real data, whitened and limited to
   * 35–350 Hz at build time.
   */
  let { data }: { data: NetworkData } = $props();

  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });
  let shift = $state(0); // samples: positive delays Livingston
  let flip = $state(false);

  const n = $derived(data.h1.length);
  const l1At = (i: number) => (flip ? -1 : 1) * data.l1[i + data.margin - shift];
  const corr = $derived.by(() => {
    let s = 0;
    let a = 0;
    let c = 0;
    for (let i = 0; i < n; i++) {
      const l = l1At(i);
      s += data.h1[i] * l;
      a += data.h1[i] ** 2;
      c += l * l;
    }
    return s / Math.sqrt(a * c);
  });
  const shiftMs = $derived((shift / data.sampleRate) * 1e3);

  let width = $state(640);
  const H = 250;
  const PAD = 12;
  const mid = 120;
  const peak = $derived(Math.max(...data.h1.map(Math.abs), ...data.l1.map(Math.abs)));
  const x = (i: number) => PAD + (i / (n - 1)) * (width - 2 * PAD);
  const y = (v: number) => mid - (v / peak) * 92;
  const path = (value: (i: number) => number) => {
    let d = '';
    for (let i = 0; i < n; i++) d += `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(value(i)).toFixed(1)}`;
    return d;
  };
  const h1Path = $derived(path((i) => data.h1[i]));
  const l1Path = $derived(path(l1At));
  const tick = (s: number) => x(((s - data.t0) * data.sampleRate) | 0);
</script>

<div
  class="network"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-shift={shiftMs.toFixed(1)}
  data-corr={corr.toFixed(2)}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`GW150914 in LIGO Hanford and LIGO Livingston, whitened. Livingston is shifted by ${shiftMs.toFixed(1)} milliseconds${flip ? ' and flipped in sign' : ''}; the two traces agree with a correlation of ${corr.toFixed(2)}.`}
  >
    <text class="caps" x={PAD} y="16">GW150914 · whitened, 35–350 Hz</text>
    <path class="l1" d={l1Path} />
    <path class="h1" d={h1Path} />
    <line class="axis" x1={PAD} x2={width - PAD} y1={H - 26} y2={H - 26} />
    {#each [-0.15, -0.1, -0.05, 0, 0.05] as s (s)}
      <text x={tick(s)} y={H - 10} text-anchor="middle"
        >{s === 0 ? '0' : s.toFixed(2).replace('-', '−')} s</text
      >
    {/each}
    <text class="h1-label" x={width - PAD} y="16" text-anchor="end">Hanford</text>
    <text x={width - PAD} y="32" text-anchor="end">Livingston</text>
  </svg>
  <div class="controls">
    <label class="slider">
      <span>Shift Livingston by <b>{shiftMs.toFixed(1)} ms</b></span>
      <input
        type="range"
        min={-data.margin}
        max={data.margin}
        step="1"
        bind:value={shift}
        aria-valuetext={`${shiftMs.toFixed(1)} milliseconds`}
      />
    </label>
    <label class="toggle">
      <input type="checkbox" bind:checked={flip} />
      Flip its sign
    </label>
    <span class="readout">agreement <b>{corr.toFixed(2)}</b></span>
  </div>
</div>

<style>
  .network {
    width: 100%;
  }

  .h1 {
    fill: none;
    stroke: var(--signal);
    stroke-width: 1.6;
  }

  .l1 {
    fill: none;
    stroke: var(--ink-soft);
    stroke-width: 1.2;
  }

  .h1-label {
    fill: var(--signal);
  }

  .slider {
    display: grid;
    flex: 1 1 14rem;
    gap: 0.25rem;
    font-size: var(--text-sm);
    color: var(--ink-soft);
  }

  .toggle {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    font-size: var(--text-sm);
  }
</style>
