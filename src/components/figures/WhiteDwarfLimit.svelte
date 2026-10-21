<script lang="ts">
  import { onMount } from 'svelte';
  import { dragger, stepKey } from '~/lib/figure/pointer';
  import { chandrasekharMass, whiteDwarf } from '~/lib/physics/blackhole';

  /**
   * Chandrasekhar's limit (Mass, Spin and Nothing Else). Every cold white dwarf, from
   * hydrostatic equilibrium with a fully degenerate, relativistic electron gas (μ_e = 2): the
   * heavier the star, the smaller it is, and the curve reaches zero size at a finite mass. Drag
   * the mass; past the limit no equilibrium exists.
   */
  const curve = Array.from({ length: 48 }, (_, i) => whiteDwarf(0.08 * (4000 / 0.08) ** (i / 47)));
  const LIMIT = chandrasekharMass();
  const EARTH_KM = 6371;
  const M_MAX = 1.6;
  const R_MAX = 20_000;

  let mass = $state(0.6);
  let width = $state(600);
  let svg: SVGSVGElement | undefined = $state();
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  /** Radius at a given mass, interpolated along the computed curve; null past the limit. */
  function radiusAt(m: number): number | null {
    if (m < curve[0].mass) return curve[0].radius;
    for (let i = 1; i < curve.length; i++) {
      if (curve[i].mass >= m) {
        const a = curve[i - 1];
        const b = curve[i];
        return a.radius + ((m - a.mass) / (b.mass - a.mass)) * (b.radius - a.radius);
      }
    }
    return m < LIMIT ? curve.at(-1)!.radius * ((LIMIT - m) / (LIMIT - curve.at(-1)!.mass)) : null;
  }
  const radius = $derived(radiusAt(mass));

  const H = 320;
  const PAD = { l: 58, r: 18, t: 30, b: 42 };
  const x = $derived((m: number) => PAD.l + (m / M_MAX) * (width - PAD.l - PAD.r));
  const y = (r: number) => H - PAD.b - (Math.min(r, R_MAX) / R_MAX) * (H - PAD.t - PAD.b);
  const path = $derived(
    [...curve, { mass: LIMIT, radius: 0 }]
      .filter((p) => p.radius <= R_MAX)
      .map((p, i) => `${i ? 'L' : 'M'}${x(p.mass).toFixed(1)},${y(p.radius).toFixed(1)}`)
      .join(''),
  );

  const drag = dragger(
    () => svg,
    (p) =>
      (mass = Math.min(
        M_MAX - 0.02,
        Math.max(0.2, ((p.x - PAD.l) / (width - PAD.l - PAD.r)) * M_MAX),
      )),
  );
  function onKey(event: KeyboardEvent) {
    const next = stepKey(event, mass, { step: 0.01, min: 0.2, max: M_MAX - 0.02 });
    if (next !== null) mass = next;
  }
</script>

<div
  class="white-dwarf"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-mass={mass.toFixed(2)}
  data-radius={radius === null ? 'none' : Math.round(radius)}
>
  <svg
    bind:this={svg}
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="group"
    aria-label={radius === null
      ? `A white dwarf of ${mass.toFixed(2)} solar masses cannot exist: past ${LIMIT.toFixed(2)} solar masses no pressure of electrons holds the star up.`
      : `A white dwarf of ${mass.toFixed(2)} solar masses has a radius of about ${Math.round(radius).toLocaleString('en-GB')} km. Heavier white dwarfs are smaller, and the curve reaches zero size at ${LIMIT.toFixed(2)} solar masses.`}
  >
    <text class="caps" x={PAD.l} y="14">white dwarfs: heavier is smaller</text>
    <rect
      class="beyond"
      x={x(LIMIT)}
      y={PAD.t}
      width={x(M_MAX) - x(LIMIT)}
      height={H - PAD.t - PAD.b}
    />
    {#each [5000, 10_000, 15_000, 20_000] as r (r)}
      <line class="grid" x1={PAD.l} x2={width - PAD.r} y1={y(r)} y2={y(r)} />
      <text x={PAD.l - 8} y={y(r) + 4} text-anchor="end">{(r / 1000).toFixed(0)}k</text>
    {/each}
    <text x={PAD.l - 8} y={PAD.t - 12} text-anchor="end">km</text>
    <line class="earth" x1={PAD.l} x2={x(LIMIT)} y1={y(EARTH_KM)} y2={y(EARTH_KM)} />
    <text class="halo" x={PAD.l + 6} y={y(EARTH_KM) - 6}>the Earth's radius</text>
    <path class="curve" d={path} />
    <line class="limit" x1={x(LIMIT)} x2={x(LIMIT)} y1={PAD.t} y2={H - PAD.b} />
    <text class="ink halo" x={x(LIMIT) - 6} y={PAD.t + 12} text-anchor="end"
      >the limit, {LIMIT.toFixed(2)}</text
    >
    <text class="halo" x={x(LIMIT) - 6} y={PAD.t + 28} text-anchor="end"
      >past it, nothing holds</text
    >
    <line class="axis" x1={PAD.l} x2={width - PAD.r} y1={H - PAD.b} y2={H - PAD.b} />
    {#each [0, 0.5, 1, 1.5] as m (m)}
      <text x={x(m)} y={H - PAD.b + 16} text-anchor="middle">{m}</text>
    {/each}
    <text x={width - PAD.r} y={H - 6} text-anchor="end">mass, solar masses</text>
    <line class="pick" x1={x(mass)} x2={x(mass)} y1={PAD.t} y2={H - PAD.b} />
    <circle
      class="handle"
      cx={x(mass)}
      cy={radius === null ? H - PAD.b : y(radius)}
      r="8"
      tabindex="0"
      role="slider"
      aria-label="Mass of the white dwarf, in solar masses"
      aria-valuemin={0.2}
      aria-valuemax={M_MAX - 0.02}
      aria-valuenow={Number(mass.toFixed(2))}
      aria-valuetext={radius === null
        ? `${mass.toFixed(2)} solar masses: no white dwarf`
        : `${mass.toFixed(2)} solar masses, radius ${Math.round(radius)} km`}
      onpointerdown={drag}
      onkeydown={onKey}
    />
  </svg>
  <dl class="readouts">
    <div>
      <dt>mass</dt>
      <dd>{mass.toFixed(2)} M☉</dd>
    </div>
    <div>
      <dt>radius</dt>
      <dd class:bad={radius === null}>
        {radius === null ? 'none' : `${Math.round(radius).toLocaleString('en-GB')} km`}
      </dd>
    </div>
    <div>
      <dt>compared with the Earth</dt>
      <dd>{radius === null ? 'it collapses' : `${(radius / EARTH_KM).toFixed(2)} ×`}</dd>
    </div>
  </dl>
</div>

<style>
  .white-dwarf {
    width: 100%;
  }

  .fig text.halo {
    paint-order: stroke;
    stroke: var(--ground);
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  .beyond {
    fill: color-mix(in srgb, var(--noise) 14%, transparent);
  }

  .earth {
    stroke: var(--noise);
    stroke-width: 1;
    stroke-dasharray: 4 3;
  }

  .curve {
    fill: none;
    stroke: var(--ink);
    stroke-width: 2;
  }

  .limit {
    stroke: var(--ink-soft);
    stroke-width: 1;
    stroke-dasharray: 2 3;
  }

  .pick {
    stroke: var(--signal);
    stroke-width: 1;
    stroke-dasharray: 2 3;
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
