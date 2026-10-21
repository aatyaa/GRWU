<script lang="ts">
  import { onMount } from 'svelte';
  import {
    accretionEfficiency,
    ergosurface,
    extractable,
    kerrHorizons,
    kerrIsco,
    kerrPhotonOrbit,
  } from '~/lib/physics/blackhole';

  /**
   * A spinning black hole, cut through its axis (Mass, Spin and Nothing Else). The horizon, the
   * ergosphere around it, and in the equatorial plane the light orbit and the last stable orbit,
   * for matter going with the spin (right) and against it (left). Radii in Boyer–Lindquist r,
   * in units of GM/c². Past χ = 1 there is no horizon left.
   */
  const EXTENT = 10;
  let chi = $state(0.9);
  let width = $state(600);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  const horizons = $derived(kerrHorizons(chi));
  const bound = $derived(Math.min(chi, 1));
  const iscoPro = $derived(kerrIsco(bound, true));
  const iscoRetro = $derived(kerrIsco(bound, false));
  const lightPro = $derived(kerrPhotonOrbit(bound, true));
  const lightRetro = $derived(kerrPhotonOrbit(bound, false));

  const H = $derived(Math.min(360, Math.max(260, width * 0.55)));
  const cx = $derived(width / 2);
  const cy = $derived(H / 2 + 6);
  const k = $derived(Math.min((width / 2 - 16) / EXTENT, (H / 2 - 30) / 5.2));
  const ergo = $derived(
    horizons
      ? Array.from({ length: 181 }, (_, i) => {
          const theta = (2 * Math.PI * i) / 180;
          const r = ergosurface(chi, theta);
          return `${i ? 'L' : 'M'}${(cx + r * k * Math.sin(theta)).toFixed(1)},${(cy - r * k * Math.cos(theta)).toFixed(1)}`;
        }).join('') + 'Z'
      : '',
  );
  const pct = (v: number) => `${(v * 100).toFixed(1)} %`;
</script>

<div
  class="kerr-radii"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-chi={chi.toFixed(2)}
  data-horizon={horizons ? horizons.outer.toFixed(3) : 'none'}
  data-isco={iscoPro.toFixed(3)}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={horizons
      ? `A black hole spinning at χ = ${chi.toFixed(2)}, cut through its axis. Horizon at ${horizons.outer.toFixed(2)} GM/c², ergosphere reaching 2 GM/c² at the equator. Going with the spin, light orbits at ${lightPro.toFixed(2)} and the last stable orbit is at ${iscoPro.toFixed(2)}; against it, at ${lightRetro.toFixed(2)} and ${iscoRetro.toFixed(2)}.`
      : `At χ = ${chi.toFixed(2)} there is no horizon: the singularity would be visible from outside.`}
  >
    <text class="caps" x="12" y="14">a spinning hole, cut through its axis</text>
    <line class="axis-line" x1={cx} x2={cx} y1={cy - 5 * k} y2={cy + 5 * k} />
    <line class="equator" x1={cx - EXTENT * k} x2={cx + EXTENT * k} y1={cy} y2={cy} />
    {#if horizons}
      <path class="ergo" d={ergo} />
      <circle class="hole" {cx} {cy} r={horizons.outer * k} />
      <circle class="inner" {cx} {cy} r={horizons.inner * k} />
      <text class="ink halo" x={cx + 2.1 * k} y={cy - 1.5 * k}>ergosphere</text>
      <text class="halo" x={cx} y={cy + horizons.outer * k + 16} text-anchor="middle">horizon</text>
    {:else}
      <circle class="naked" {cx} {cy} r={4} />
      <text class="bias halo" x={cx} y={cy - 16} text-anchor="middle">no horizon at all</text>
    {/if}
    {#if horizons}
      <!-- Going with the spin on the right, against it on the left. -->
      <circle class="light-orbit" cx={cx + lightPro * k} {cy} r="4" />
      <circle class="light-orbit" cx={cx - lightRetro * k} {cy} r="4" />
      <circle class="dot" cx={cx + iscoPro * k} {cy} r="5" />
      <circle class="dot" cx={cx - iscoRetro * k} {cy} r="5" />
      <text class="signal halo" x={cx + iscoPro * k} y={cy + 22} text-anchor="middle"
        >{iscoPro.toFixed(2)}</text
      >
      <text class="signal halo" x={cx - iscoRetro * k} y={cy + 22} text-anchor="middle"
        >{iscoRetro.toFixed(2)}</text
      >
    {/if}
    <text class="halo" x={cx + EXTENT * k} y={cy - 10} text-anchor="end">with the spin →</text>
    <text class="halo" x={cx - EXTENT * k} y={cy - 10}>← against it</text>
    <text class="signal halo" x={cx - EXTENT * k} y={H - 8}>● last stable orbit</text>
    <text class="halo" x={cx + EXTENT * k} y={H - 8} text-anchor="end"
      >○ light's circular orbit</text
    >
  </svg>

  <div class="controls">
    <label class="slider">
      <span>Spin <b>χ = {chi.toFixed(2)}</b>{chi > 1 ? ' (past the limit)' : ''}</span>
      <input type="range" min="0" max="1.1" step="0.01" bind:value={chi} />
    </label>
  </div>
  <dl class="readouts">
    <div>
      <dt>horizon, GM/c²</dt>
      <dd class:bad={!horizons}>{horizons ? horizons.outer.toFixed(2) : 'none'}</dd>
    </div>
    <div>
      <dt>last stable orbit, with the spin</dt>
      <dd>{horizons ? iscoPro.toFixed(2) : '—'}</dd>
    </div>
    <div>
      <dt>light radiated on the way in</dt>
      <dd>{horizons ? pct(accretionEfficiency(chi)) : '—'}</dd>
    </div>
    <div>
      <dt>mass stored in the spin</dt>
      <dd>{horizons ? pct(extractable(chi)) : '—'}</dd>
    </div>
  </dl>
</div>

<style>
  .kerr-radii {
    width: 100%;
  }

  .fig text.halo {
    paint-order: stroke;
    stroke: var(--ground);
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  .axis-line {
    stroke: var(--rule);
    stroke-width: 1;
    stroke-dasharray: 2 3;
  }

  .equator {
    stroke: var(--rule);
    stroke-width: 1;
  }

  .ergo {
    fill: color-mix(in srgb, var(--noise) 22%, transparent);
    stroke: var(--noise);
    stroke-width: 1.2;
    stroke-dasharray: 5 3;
  }

  .hole {
    fill: var(--ink);
  }

  .inner {
    fill: none;
    stroke: var(--ground);
    stroke-width: 1;
    stroke-dasharray: 2 2;
  }

  .naked {
    fill: var(--bias);
  }

  .light-orbit {
    fill: var(--ground);
    stroke: var(--ink-soft);
    stroke-width: 1.5;
  }

  .controls {
    display: flex;
    margin-top: 0.75rem;
  }

  .slider {
    display: grid;
    flex: 1 1 14rem;
    gap: 0.25rem;
  }

  .readouts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
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
</style>
