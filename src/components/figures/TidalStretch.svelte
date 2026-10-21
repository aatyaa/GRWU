<script lang="ts">
  import { onMount } from 'svelte';
  import { powerOfTen, scientific } from '~/lib/format';
  import { log } from '~/lib/figure/svg';
  import { disruptionRadius, tidalStretch } from '~/lib/physics/blackhole';
  import { C, GM_SUN, R_SUN } from '~/lib/physics/relativity';

  /**
   * Bigger holes are gentler (Mass, Spin and Nothing Else). The stretch across a 2-metre body
   * pointing at a hole, 2GM L / r³, against distance from the centre, with the horizon marked.
   * The stretch at the horizon falls as 1/M², so for a hole heavy enough you cross it without
   * noticing. The same arithmetic decides whether a Sun-like star is torn apart or swallowed.
   */
  const LENGTH = 2;
  const G0 = 9.81;
  let logMass = $state(1);
  let width = $state(600);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  const mass = $derived(10 ** logMass);
  const gm = $derived(mass * GM_SUN);
  const horizonKm = $derived((2 * gm) / (C * C) / 1e3);
  const tideAtHorizon = $derived(tidalStretch(gm, horizonKm * 1e3, LENGTH) / G0);
  // Where the stretch equals your weight: 2GM L / r³ = g.
  const oneG = $derived(Math.cbrt((2 * gm * LENGTH) / G0) / 1e3);
  const starKm = $derived(disruptionRadius(gm, GM_SUN, R_SUN) / 1e3);
  const torn = $derived(starKm > horizonKm);

  const H = 300;
  const PAD = { l: 50, r: 16, t: 30, b: 42 };
  const R = { lo: 1, hi: 1e11 };
  const Y = { lo: 1e-6, hi: 1e9 };
  const x = $derived(log(R.lo, R.hi, PAD.l, width - PAD.r));
  const y = log(Y.lo, Y.hi, H - PAD.b, PAD.t);
  const line = $derived(
    Array.from({ length: 121 }, (_, i) => {
      const rKm = R.lo * (R.hi / R.lo) ** (i / 120);
      const g = tidalStretch(gm, rKm * 1e3, LENGTH) / G0;
      return { rKm, g, outside: rKm >= horizonKm };
    }),
  );
  // Off the scale is left undrawn rather than flattened against the edge.
  const path = (outside: boolean) =>
    line
      .filter((p) => p.outside === outside || (!outside && p.rKm <= horizonKm * 1.05))
      .filter((p) => p.g >= Y.lo && p.g <= Y.hi)
      .map((p, i) => `${i ? 'L' : 'M'}${x(p.rKm).toFixed(1)},${y(p.g).toFixed(1)}`)
      .join('');
  const km = (v: number) =>
    v >= 1e6
      ? `${(v / 1e6).toPrecision(2)} million km`
      : `${Math.round(v).toLocaleString('en-GB')} km`;
  const gs = (v: number) =>
    v >= 1e4 || v < 0.01 ? `${scientific(v, 0)} g` : `${v.toPrecision(2)} g`;
  const suns = (m: number) => (m < 1e4 ? `${Math.round(m)}` : scientific(m, 1));
</script>

<div
  class="tidal-stretch"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-mass={logMass.toFixed(2)}
  data-tide={tideAtHorizon.toPrecision(2)}
  data-star={torn ? 'torn' : 'swallowed'}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`For a hole of ${suns(mass)} solar masses, the stretch across a 2-metre body at the horizon is ${gs(tideAtHorizon)}. A Sun-like star is ${torn ? `torn apart ${km(starKm)} out, outside the horizon` : 'swallowed whole: it would be torn apart only inside the horizon'}.`}
  >
    <text class="caps" x={PAD.l} y="14">the stretch across your body</text>
    {#each [1e-6, 1e-3, 1, 1e3, 1e6, 1e9] as v (v)}
      <line class="grid" x1={PAD.l} x2={width - PAD.r} y1={y(v)} y2={y(v)} />
      <text x={PAD.l - 8} y={y(v) + 4} text-anchor="end">{v === 1 ? '1 g' : powerOfTen(v)}</text>
    {/each}
    <rect
      class="inside"
      x={PAD.l}
      y={PAD.t}
      width={Math.max(0, Math.min(x(horizonKm), width - PAD.r) - PAD.l)}
      height={H - PAD.t - PAD.b}
    />
    <path class="model" d={path(false)} />
    <path class="tide" d={path(true)} />
    {#if horizonKm < R.hi}
      <line class="horizon" x1={x(horizonKm)} x2={x(horizonKm)} y1={PAD.t} y2={H - PAD.b} />
      <text class="ink halo" x={x(horizonKm) + 6} y={PAD.t + 12}>horizon</text>
    {/if}
    <line class="one-g" x1={PAD.l} x2={width - PAD.r} y1={y(1)} y2={y(1)} />
    <text class="signal halo" x={width - PAD.r} y={y(1) + 16} text-anchor="end"
      >a stretch equal to your weight</text
    >
    {#if oneG > R.lo && oneG < R.hi}
      <circle class="dot" cx={x(oneG)} cy={y(1)} r="5" />
    {/if}
    <line class="axis" x1={PAD.l} x2={width - PAD.r} y1={H - PAD.b} y2={H - PAD.b} />
    {#each [1, 1e3, 1e6, 1e9] as v (v)}
      <text x={x(v)} y={H - PAD.b + 16} text-anchor="middle"
        >{v === 1 ? '1 km' : powerOfTen(v)}</text
      >
    {/each}
    <text x={width - PAD.r} y={H - 6} text-anchor="end">distance from the centre</text>
  </svg>

  <div class="controls">
    <label class="slider">
      <span>Mass of the hole <b>{suns(mass)}</b> suns</span>
      <input type="range" min="0.45" max="10" step="0.05" bind:value={logMass} />
    </label>
  </div>
  <dl class="readouts">
    <div>
      <dt>stretch at the horizon</dt>
      <dd class:bad={tideAtHorizon > 1}>{gs(tideAtHorizon)}</dd>
    </div>
    <div>
      <dt>stretch reaches your weight at</dt>
      <dd>{km(oneG)}{oneG < horizonKm ? ', inside' : ''}</dd>
    </div>
    <div>
      <dt>a star like the Sun is</dt>
      <dd>{torn ? `torn apart at ${km(starKm)}` : 'swallowed whole'}</dd>
    </div>
  </dl>
</div>

<style>
  .tidal-stretch {
    width: 100%;
  }

  .fig text.halo {
    paint-order: stroke;
    stroke: var(--ground);
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  .inside {
    fill: color-mix(in srgb, var(--noise) 14%, transparent);
  }

  .horizon {
    stroke: var(--ink-soft);
    stroke-width: 1;
    stroke-dasharray: 2 3;
  }

  .tide {
    fill: none;
    stroke: var(--ink);
    stroke-width: 2;
  }

  .one-g {
    stroke: var(--signal);
    stroke-width: 1;
    stroke-dasharray: 4 3;
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
</style>
