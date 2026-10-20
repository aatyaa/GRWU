<script lang="ts">
  import { scaleLinear } from 'd3-scale';
  import { onMount } from 'svelte';
  import {
    blackHoleOf,
    detectorFrameMass,
    horizonArea,
    R_SUN_KM,
    ringOf,
  } from '~/lib/physics/kerr';

  /**
   * A Bell That Weighs Itself: the fundamental tone (l = m = 2, n = 0) of a Kerr black hole of
   * the mass and spin the reader chooses, as it arrives at a detector after travelling from
   * redshift z. The detector reads the ring back into a mass and spin; the mass comes out
   * heavier by 1 + z, the spin does not change. physics/kerr.ts, checked against qnm.
   */
  let mass = $state(60);
  let chi = $state(0.7);
  let z = $state(0);
  let width = $state(640);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  const T_MS = 20;
  const H = 220;
  const PAD = { l: 14, r: 14, t: 12, b: 28 };
  const seen = $derived(ringOf('220', detectorFrameMass(mass, z), chi));
  const read = $derived(blackHoleOf(seen.f, seen.tau));
  const x = $derived(
    scaleLinear()
      .domain([0, T_MS])
      .range([PAD.l, width - PAD.r]),
  );
  const y = scaleLinear()
    .domain([-1.1, 1.1])
    .range([H - PAD.b, PAD.t]);
  const wave = $derived(
    Array.from({ length: 801 }, (_, i) => {
      const t = (i / 800) * T_MS * 1e-3;
      const v = Math.exp(-t / seen.tau) * Math.cos(2 * Math.PI * seen.f * t);
      return `${i ? 'L' : 'M'}${x(t * 1e3).toFixed(1)},${y(v).toFixed(1)}`;
    }).join(''),
  );
  const envelope = $derived(
    [1, -1].map((s) =>
      Array.from({ length: 101 }, (_, i) => {
        const t = (i / 100) * T_MS * 1e-3;
        return `${i ? 'L' : 'M'}${x(t * 1e3).toFixed(1)},${y(s * Math.exp(-t / seen.tau)).toFixed(1)}`;
      }).join(''),
    ),
  );
  const areaKm2 = $derived(horizonArea(mass, chi) * R_SUN_KM ** 2);
</script>

<div
  class="kerr-ring"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-frequency={seen.f.toFixed(1)}
  data-tau-ms={(seen.tau * 1e3).toFixed(3)}
  data-read-mass={read ? read.mass.toFixed(2) : ''}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`The ring of a ${mass} solar-mass black hole with spin ${chi.toFixed(2)}, seen from redshift ${z.toFixed(2)}: ${seen.f.toFixed(0)} hertz, fading by e every ${(seen.tau * 1e3).toFixed(2)} milliseconds.`}
  >
    <line class="axis" x1={PAD.l} x2={width - PAD.r} y1={y(0)} y2={y(0)} />
    {#each [0, 5, 10, 15, 20] as ms (ms)}
      <text
        class="tick"
        x={x(ms)}
        y={H - 9}
        text-anchor={ms === 0 ? 'start' : ms === 20 ? 'end' : 'middle'}>{ms} ms</text
      >
    {/each}
    {#each envelope as d, i (i)}<path class="envelope" {d} />{/each}
    <path class="wave" d={wave} />
  </svg>

  <div class="sliders">
    <label>
      <span>Mass <b>{mass} M☉</b></span>
      <input type="range" min="10" max="150" step="1" bind:value={mass} />
    </label>
    <label>
      <span>Spin χ <b>{chi.toFixed(2)}</b></span>
      <input type="range" min="0" max="0.95" step="0.01" bind:value={chi} />
    </label>
    <label>
      <span>Redshift z <b>{z.toFixed(2)}</b></span>
      <input type="range" min="0" max="1" step="0.01" bind:value={z} />
    </label>
  </div>
  <dl class="numbers">
    <div>
      <dt>ring frequency</dt>
      <dd>{seen.f.toFixed(0)} Hz</dd>
    </div>
    <div>
      <dt>damping time</dt>
      <dd>{(seen.tau * 1e3).toFixed(2)} ms</dd>
    </div>
    <div>
      <dt>quality Q</dt>
      <dd>{(Math.PI * seen.f * seen.tau).toFixed(2)}</dd>
    </div>
    <div>
      <dt>mass read from the ring</dt>
      <dd class:heavier={z > 0}>{read ? read.mass.toFixed(1) : '—'} M☉</dd>
    </div>
    <div>
      <dt>spin read from the ring</dt>
      <dd>{read ? read.chi.toFixed(2) : '—'}</dd>
    </div>
    <div>
      <dt>horizon area</dt>
      <dd>{Math.round(areaKm2).toLocaleString('en')} km²</dd>
    </div>
  </dl>
  {#if z > 0}
    <p class="note">
      The ring arrived stretched by 1 + z = {(1 + z).toFixed(2)}, so it reads as a black hole
      {(1 + z).toFixed(2)} times heavier. The spin is read correctly: stretching changes f and τ together
      and leaves Q alone.
    </p>
  {/if}
</div>

<style>
  .kerr-ring {
    width: 100%;
  }

  .axis {
    stroke: var(--rule);
  }

  .tick {
    font-size: 11px;
    fill: var(--ink-soft);
  }

  .wave {
    fill: none;
    stroke: var(--model);
    stroke-width: 1.6;
  }

  .envelope {
    fill: none;
    stroke: var(--ink-soft);
    stroke-width: 1.1;
    stroke-dasharray: 5 4;
  }

  .sliders {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: 0.6rem 1.2rem;
    margin-top: 0.8rem;
    font-size: 0.9rem;
    color: var(--ink-soft);
  }

  .sliders label {
    display: grid;
    gap: 0.25rem;
  }

  .sliders b {
    color: var(--ink);
  }

  input[type='range'] {
    width: 100%;
    accent-color: var(--ink);
  }

  .numbers {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.5rem 1.2rem;
    margin: 0.9rem 0 0;
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

  .numbers dd.heavier {
    padding-left: 0.4rem;
    border-left: 3px solid var(--bias);
  }

  .note {
    margin: 0.7rem 0 0;
    font-size: 0.9rem;
    color: var(--ink-soft);
  }
</style>
