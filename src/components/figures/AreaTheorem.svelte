<script lang="ts">
  import { onMount } from 'svelte';
  import { M_SUN_KG } from '~/lib/physics/blackhole';
  import { horizonArea, horizonAreaSI, minimumFinalMass } from '~/lib/physics/horizon';

  /**
   * Hawking's area theorem as a budget (Only Ever Forwards). Two non-spinning holes of 10 solar
   * masses merge; the reader sets the mass and spin of the hole they make. Each disc has the area
   * of its horizon, to scale, and the merger is allowed only if the final area is at least the
   * two first areas together.
   */
  const PARENT = 10;
  let mf = $state(20);
  let chi = $state(0);
  let width = $state(600);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  const before = 2 * PARENT * PARENT * horizonArea(0);
  const after = $derived(mf * mf * horizonArea(chi));
  const allowed = $derived(after >= before * (1 - 1e-9));
  const change = $derived(after / before - 1);
  const radiated = $derived(1 - mf / (2 * PARENT));
  const least = $derived(minimumFinalMass(PARENT, PARENT, 0, 0, chi));
  const km2 = (massSun: number, spin: number) => horizonAreaSI(massSun * M_SUN_KG, spin) / 1e6;
  const fmt = (v: number) => Math.round(v / 100) * 100;

  // A 10-solar-mass horizon has radius R0 on screen; radii go as the square root of the area.
  const R0 = $derived(Math.min(52, width / 11));
  const H = $derived(R0 * 4.2 + 142);
  const radius = (m: number, spin: number) =>
    R0 * Math.sqrt((m * m * horizonArea(spin)) / (PARENT * PARENT * horizonArea(0)));
  const cy = $derived(R0 * 2.1 + 44);
  const barY = $derived(cy + R0 * 2.1 + 22);
  const barX0 = 118;
  const barW = $derived(width - barX0 - 96);
  // The largest final area the controls allow: 20 solar masses, no spin.
  const bar = (area: number) => (area / (4 * PARENT * PARENT * horizonArea(0))) * barW;
</script>

<div
  class="area-theorem"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-mf={mf.toFixed(1)}
  data-chi={chi.toFixed(2)}
  data-allowed={allowed}
  data-radiated={(radiated * 100).toFixed(1)}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`Two black holes of 10 solar masses, with horizons of ${fmt(km2(PARENT, 0))} square kilometres each, merge into one of ${mf.toFixed(1)} solar masses spinning at ${chi.toFixed(2)}, with a horizon of ${fmt(km2(mf, chi))} square kilometres. The area ${allowed ? 'grows' : 'would shrink'} by ${Math.abs(change * 100).toFixed(0)} per cent, so the merger is ${allowed ? 'allowed' : 'forbidden'}.`}
  >
    <text class="caps" x="12" y="16">two in, one out, to scale</text>
    <circle class="hole" cx={width * 0.13} {cy} r={radius(PARENT, 0)} />
    <circle class="hole" cx={width * 0.13 + R0 * 2.5} {cy} r={radius(PARENT, 0)} />
    <text x={width * 0.13 + R0 * 1.25} y={cy + R0 + 18} text-anchor="middle">10 + 10 M☉</text>
    <path class="arrow" d="M{width * 0.13 + R0 * 3.75},{cy}h{R0 * 1.1}m-7,-6l7,6l-7,6" />
    <circle class="hole" class:forbidden={!allowed} cx={width * 0.72} {cy} r={radius(mf, chi)} />
    <circle class="least" cx={width * 0.72} {cy} r={radius(least, chi)} />
    <text x={width * 0.72} y={cy - radius(mf, chi) - 8} text-anchor="middle"
      >{mf.toFixed(1)} M☉, spin {chi.toFixed(2)}</text
    >

    <text class="ink" x={barX0 - 10} y={barY + 4} text-anchor="end">area before</text>
    <rect class="before" x={barX0} y={barY - 7} width={bar(before)} height="14" rx="2" />
    <text x={barX0 + bar(before) + 6} y={barY + 4}>{fmt(km2(PARENT, 0) * 2)} km²</text>
    <text class="ink" x={barX0 - 10} y={barY + 28} text-anchor="end">area after</text>
    <rect
      class="after"
      class:forbidden={!allowed}
      x={barX0}
      y={barY + 17}
      width={bar(after)}
      height="14"
      rx="2"
    />
    <text x={barX0 + bar(after) + 6} y={barY + 28}>{fmt(km2(mf, chi))} km²</text>
    <line
      class="axis"
      x1={barX0 + bar(before)}
      x2={barX0 + bar(before)}
      y1={barY - 12}
      y2={barY + 36}
    />
    <text class={allowed ? 'ok' : 'bias'} x={12} y={H - 24}
      >{allowed
        ? `allowed: the area grows by ${(change * 100).toFixed(0)} %`
        : `forbidden: the area would shrink by ${(-change * 100).toFixed(0)} %`}</text
    >
    <text x={12} y={H - 6}>dashed circle: the smallest final hole allowed</text>
  </svg>

  <div class="controls">
    <label class="slider">
      <span>Mass of the final hole <b>{mf.toFixed(1)} M☉</b></span>
      <input type="range" min="10" max="20" step="0.1" bind:value={mf} />
    </label>
    <label class="slider">
      <span>Its spin <b>χ = {chi.toFixed(2)}</b></span>
      <input type="range" min="0" max="0.99" step="0.01" bind:value={chi} />
    </label>
  </div>
  <dl class="readouts">
    <div>
      <dt>radiated as waves</dt>
      <dd>{(20 - mf).toFixed(1)} M☉ ({(radiated * 100).toFixed(1)} %)</dd>
    </div>
    <div>
      <dt>the most the area allows</dt>
      <dd>{(20 - least).toFixed(1)} M☉ ({((1 - least / 20) * 100).toFixed(1)} %)</dd>
    </div>
    <div>
      <dt>so this merger is</dt>
      <dd class:bad={!allowed} class:good={allowed}>{allowed ? 'allowed' : 'forbidden'}</dd>
    </div>
  </dl>
</div>

<style>
  .area-theorem {
    width: 100%;
  }

  .hole {
    fill: var(--ink);
  }

  .hole.forbidden {
    fill: var(--bias);
  }

  .least {
    fill: none;
    stroke: var(--model);
    stroke-width: 1.4;
    stroke-dasharray: 5 4;
  }

  .arrow {
    fill: none;
    stroke: var(--ink-soft);
    stroke-width: 2;
  }

  .before {
    fill: color-mix(in srgb, var(--noise) 45%, transparent);
  }

  .after {
    fill: var(--ink);
  }

  .after.forbidden {
    fill: var(--bias);
  }

  .controls {
    display: grid;
    gap: 0.9rem;
  }

  .slider {
    display: grid;
    flex: 1 1 14rem;
    gap: 0.25rem;
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

  .readouts dd.good {
    color: var(--ok);
  }
</style>
