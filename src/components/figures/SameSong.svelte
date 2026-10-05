<script lang="ts">
  import { onMount } from 'svelte';
  import type { ToyWaveform } from '~/lib/articles/skills';

  /**
   * Same song, different tempo (Almost None of It Is About Gravitational Waves). One toy
   * waveform in units of the total mass; the reader picks the mass and the clock and the
   * pitch rescale, while the shape stays. The detector's band starts at 20 Hz.
   */
  let {
    wave,
    fIsco,
    fRing,
    tMerge,
    tSun,
  }: { wave: ToyWaveform; fIsco: number; fRing: number; tMerge: number; tSun: number } = $props();

  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });
  let mass = $state(65);
  const F_LOW = 20;
  const sec = $derived(mass * tSun);
  const isco = $derived(fIsco / sec);
  const ring = $derived(fRing / sec);

  // In-band content: the inspiral from 20 Hz to the ISCO, then merger and ringdown.
  const eta = 0.25;
  const mc = eta ** 0.6;
  const cyclesFrom = (fM: number) => (1 / (32 * Math.PI ** (8 / 3))) * (mc * fM) ** (-5 / 3);
  const tauFrom = (fM: number) => (5 / (256 * eta)) * (Math.PI * fM) ** (-8 / 3);
  const lowM = $derived(F_LOW * sec);
  const inspiralCycles = $derived(lowM < fIsco ? cyclesFrom(lowM) - cyclesFrom(fIsco) : 0);
  const inspiralSeconds = $derived(lowM < fIsco ? (tauFrom(lowM) - tauFrom(fIsco)) * sec : 0);
  const lateSeconds = $derived((tMerge + 3 * 11.8) * sec);

  let width = $state(640);
  const H = 316;
  const PAD = 14;
  const WAVE_TOP = 50;
  const WAVE_BOT = 170;
  const t0 = $derived(wave.t[0]);
  const t1 = $derived(wave.t[wave.t.length - 1]);
  const x = (t: number) => PAD + ((t - t0) / (t1 - t0)) * (width - 2 * PAD);
  const peak = $derived(Math.max(...wave.h.map(Math.abs)));
  const mid = (WAVE_TOP + WAVE_BOT) / 2;
  const y = (v: number) => mid - (v / peak) * ((WAVE_BOT - WAVE_TOP) / 2 - 4);

  const path = $derived(
    wave.t
      .map((t, i) => (i % 2 ? '' : `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(wave.h[i]).toFixed(1)}`))
      .join(''),
  );
  // Where the waveform is still below the detector's band.
  const firstInBand = $derived(wave.f.findIndex((fM) => fM / sec >= F_LOW));
  const outOfBand = $derived(firstInBand > 0 ? x(wave.t[firstInBand]) - x(t0) : 0);

  // Millisecond ticks on the time axis, relative to the peak.
  const ticks = $derived.by(() => {
    const spanMs = (t1 - t0) * sec * 1e3;
    const raw = spanMs / 5;
    const p = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 5, 10].map((k) => k * p).find((s) => s >= raw) ?? raw;
    const out: number[] = [];
    for (let ms = Math.ceil((t0 * sec * 1e3) / step) * step; ms <= t1 * sec * 1e3; ms += step)
      out.push(ms);
    return out;
  });
  const xMs = (ms: number) => x(ms / 1e3 / sec);

  // Frequency ruler: 10 Hz to 5 kHz, log.
  const RULER_Y = 252;
  const fx = (f: number) => PAD + (Math.log10(f / 10) / Math.log10(500)) * (width - 2 * PAD);
  const fmt = (v: number) => (v >= 100 ? Math.round(v).toString() : v.toFixed(1));
</script>

<div
  class="same-song"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-mass={mass}
  data-isco={Math.round(isco)}
  data-cycles={Math.round(inspiralCycles)}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`A toy waveform for two equal black holes of ${mass} solar masses in total. The inspiral ends near ${Math.round(isco)} hertz and the ring is near ${Math.round(ring)} hertz. From 20 hertz the detector hears about ${inspiralSeconds.toFixed(2)} seconds and ${Math.round(inspiralCycles)} cycles of inspiral before the merger.`}
  >
    <rect
      class="regime"
      x={x(t0)}
      y={WAVE_TOP - 8}
      width={x(-tMerge) - x(t0)}
      height={WAVE_BOT - WAVE_TOP + 8}
    />
    <rect
      class="regime alt"
      x={x(-tMerge)}
      y={WAVE_TOP - 8}
      width={x(0) - x(-tMerge)}
      height={WAVE_BOT - WAVE_TOP + 8}
    />
    <rect
      class="regime"
      x={x(0)}
      y={WAVE_TOP - 8}
      width={x(t1) - x(0)}
      height={WAVE_BOT - WAVE_TOP + 8}
    />
    <text class="caps" x={x(t0)} y="14">inspiral · post-Newtonian theory</text>
    <text class="caps" x={x(t1)} y="14" text-anchor="end">ringdown · perturbation theory ↓</text>
    <text class="caps" x={x(0)} y="30" text-anchor="end">merger · numerical relativity ↓</text>
    {#if outOfBand > 1}
      <rect
        class="below-band"
        x={x(t0)}
        y={WAVE_TOP}
        width={outOfBand}
        height={WAVE_BOT - WAVE_TOP}
      />
      <text x={x(t0) + 6} y={WAVE_BOT - 8}>below 20 Hz: the detector cannot hear this</text>
    {/if}
    <path class="wave" d={path} />
    <line class="axis" x1={PAD} x2={width - PAD} y1={WAVE_BOT + 6} y2={WAVE_BOT + 6} />
    {#each ticks as ms (ms)}
      <text x={xMs(ms)} y={WAVE_BOT + 22} text-anchor="middle"
        >{ms === 0 ? '0' : ms.toFixed(ms % 1 ? 1 : 0).replace('-', '−')}</text
      >
    {/each}
    <text x={width - PAD} y={WAVE_BOT + 38} text-anchor="end">milliseconds from the peak</text>

    <text class="caps" x={PAD} y={RULER_Y - 22}>where it sings, against the detector's band</text>
    <rect class="band" x={fx(F_LOW)} y={RULER_Y - 10} width={fx(5000) - fx(F_LOW)} height="20" />
    <line class="axis" x1={fx(10)} x2={fx(5000)} y1={RULER_Y + 10} y2={RULER_Y + 10} />
    {#each [10, 20, 50, 100, 200, 500, 1000, 2000, 5000] as f (f)}
      <text x={fx(f)} y={RULER_Y + 26} text-anchor="middle">{f >= 1000 ? `${f / 1000}k` : f}</text>
    {/each}
    <line
      class="mark"
      x1={fx(Math.min(isco, 5000))}
      x2={fx(Math.min(isco, 5000))}
      y1={RULER_Y - 12}
      y2={RULER_Y + 12}
    />
    <line
      class="mark"
      x1={fx(Math.min(ring, 5000))}
      x2={fx(Math.min(ring, 5000))}
      y1={RULER_Y - 12}
      y2={RULER_Y + 12}
    />
    <text class="signal" x={fx(Math.min(isco, 5000))} y={RULER_Y + 42} text-anchor="end" dx="-4"
      >inspiral ends {fmt(isco)} Hz</text
    >
    <text class="signal" x={fx(Math.min(ring, 5000))} y={RULER_Y + 42} text-anchor="start" dx="4"
      >ring {fmt(ring)} Hz</text
    >
  </svg>

  <div class="controls">
    <label class="slider">
      <span>Total mass <b>{mass} M☉</b></span>
      <input
        type="range"
        min="10"
        max="200"
        step="1"
        bind:value={mass}
        aria-valuetext={`${mass} solar masses`}
      />
    </label>
    <button type="button" class="btn" onclick={() => (mass = 20)}>A light binary · 20</button>
    <button type="button" class="btn" onclick={() => (mass = 65)}>Like GW150914 · 65</button>
    <button type="button" class="btn" onclick={() => (mass = 180)}>A heavy one · 180</button>
  </div>
  <dl class="readouts">
    <div>
      <dt>inspiral heard, from 20 Hz</dt>
      <dd>
        {inspiralSeconds < 1
          ? `${(inspiralSeconds * 1e3).toFixed(0)} ms`
          : `${inspiralSeconds.toFixed(1)} s`}
      </dd>
    </div>
    <div>
      <dt>inspiral cycles heard</dt>
      <dd>{Math.round(inspiralCycles)}</dd>
    </div>
    <div>
      <dt>merger and ringdown</dt>
      <dd>{(lateSeconds * 1e3).toFixed(1)} ms · {wave.lateCycles.toFixed(0)} cycles</dd>
    </div>
  </dl>
</div>

<style>
  .same-song {
    width: 100%;
  }

  .regime {
    fill: var(--surface);
  }

  .regime.alt {
    fill: var(--surface-2);
  }

  .below-band {
    fill: var(--rule-soft);
    opacity: 0.75;
  }

  .wave {
    fill: none;
    stroke: var(--signal);
    stroke-width: 1.4;
  }

  .band {
    fill: var(--signal-bg);
  }

  .mark {
    stroke: var(--signal);
    stroke-width: 2;
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
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
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
</style>
