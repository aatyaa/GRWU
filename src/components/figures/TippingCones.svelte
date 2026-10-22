<script lang="ts">
  import { onMount } from 'svelte';
  import { dragger, stepKey } from '~/lib/figure/pointer';
  import { coneSlopes } from '~/lib/physics/blackhole';

  /**
   * Light cones that tip (Mass, Spin and Nothing Else). In coordinates that follow infalling
   * light (Eddington–Finkelstein), nothing happens to the metric at the horizon, but the light
   * cones tip towards the hole: outward light slows to a halt on the horizon and falls inward
   * below it. Drag the cone to any radius; its outward edge is (1 − r_s/r)/(1 + r_s/r).
   */
  const RADII = [0.35, 0.7, 1, 1.5, 2.2, 3];
  const MAX = 3.4;

  let r = $state(2.2);
  let width = $state(600);
  let svg: SVGSVGElement | undefined = $state();
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  const slopes = $derived(coneSlopes(r));
  const H = 260;
  const PAD = { l: 24, r: 24, t: 30, b: 46 };
  const x = $derived((v: number) => PAD.l + (v / MAX) * (width - PAD.l - PAD.r));
  const unit = $derived((width - PAD.l - PAD.r) / MAX);
  const BASE = 170;
  const LEN = $derived(Math.min(70, unit * 0.45));

  /** A cone at radius rr: two edges of length LEN pixels from its apex, and its fill. */
  function cone(rr: number) {
    const s = coneSlopes(rr);
    const edge = (slope: number) => {
      // Direction (dr, dt) = (slope, 1) in units where light at 45° has |dr| = |dt|.
      const n = Math.hypot(slope, 1);
      return { dx: (slope / n) * LEN * 0.9, dy: (-1 / n) * LEN * 0.9 };
    };
    const a = edge(s.inward);
    const b = edge(s.outward);
    const x0 = x(rr);
    return {
      x0,
      inner: { x: x0 + a.dx, y: BASE + a.dy },
      outer: { x: x0 + b.dx, y: BASE + b.dy },
      fill: `M${x0},${BASE}L${x0 + a.dx},${BASE + a.dy}L${x0 + b.dx},${BASE + b.dy}Z`,
    };
  }
  const here = $derived(cone(r));

  const drag = dragger(
    () => svg,
    (p) => (r = Math.min(MAX - 0.15, Math.max(0.2, (p.x - PAD.l) / unit))),
  );
  function onKey(event: KeyboardEvent) {
    const next = stepKey(event, r, { step: 0.05, min: 0.2, max: MAX - 0.15 });
    if (next !== null) r = next;
  }
  const direction = $derived(
    slopes.outward > 0.005 ? 'escaping' : slopes.outward < -0.005 ? 'falling in' : 'standing still',
  );
</script>

<div
  class="tipping-cones"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-r={r.toFixed(2)}
  data-outward={slopes.outward.toFixed(3)}
>
  <svg
    bind:this={svg}
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="group"
    aria-label={`Light cones at several distances from a black hole, in coordinates that follow infalling light. At ${r.toFixed(2)} Schwarzschild radii, light aimed straight out is ${direction}.`}
  >
    <text class="caps" x={PAD.l} y="16">where light can go, at each radius</text>
    <rect class="inside" x={x(0)} y={PAD.t} width={x(1) - x(0)} height={BASE + 18 - PAD.t} />
    <line class="horizon" x1={x(1)} x2={x(1)} y1={PAD.t} y2={BASE + 18} />
    <text class="ink halo" x={x(1) + 6} y={PAD.t + 12}>horizon</text>
    <text class="halo" x={x(0) + 6} y={PAD.t + 12}>inside</text>
    {#each RADII as rr (rr)}
      {@const c = cone(rr)}
      <path class="ghost" d={c.fill} />
    {/each}
    <path class="cone" d={here.fill} />
    <line class="edge" x1={here.x0} y1={BASE} x2={here.inner.x} y2={here.inner.y} />
    <line class="edge out" x1={here.x0} y1={BASE} x2={here.outer.x} y2={here.outer.y} />
    <text
      class="signal halo"
      x={here.outer.x + (slopes.outward >= 0 ? 6 : -6)}
      y={here.outer.y - 4}
      text-anchor={slopes.outward >= 0 ? 'start' : 'end'}>outward light</text
    >
    <line class="axis" x1={x(0)} x2={x(MAX)} y1={BASE + 18} y2={BASE + 18} />
    {#each [0, 1, 2, 3] as v (v)}
      <text x={x(v)} y={BASE + 34} text-anchor="middle">{v}</text>
    {/each}
    <text x={x(MAX)} y={H - 4} text-anchor="end">distance from the centre, Schwarzschild radii</text
    >
    <circle
      class="handle"
      cx={here.x0}
      cy={BASE}
      r="8"
      tabindex="0"
      role="slider"
      aria-label="Where the cone sits, in Schwarzschild radii"
      aria-valuemin={0.2}
      aria-valuemax={MAX - 0.15}
      aria-valuenow={Number(r.toFixed(2))}
      aria-valuetext={`${r.toFixed(2)} Schwarzschild radii: outward light is ${direction}`}
      onpointerdown={drag}
      onkeydown={onKey}
    />
  </svg>
  <dl class="readouts">
    <div>
      <dt>distance from the centre</dt>
      <dd>{r.toFixed(2)} rₛ</dd>
    </div>
    <div>
      <dt>outward light moves at</dt>
      <dd class:bad={slopes.outward < -0.005}>{slopes.outward.toFixed(2)} c</dd>
    </div>
    <div>
      <dt>so it is</dt>
      <dd>{direction}</dd>
    </div>
  </dl>
</div>

<style>
  .tipping-cones {
    width: 100%;
  }

  .fig text.halo {
    paint-order: stroke;
    stroke: var(--ground);
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  .inside {
    fill: color-mix(in srgb, var(--noise) 12%, transparent);
  }

  .horizon {
    stroke: var(--ink-soft);
    stroke-width: 1;
    stroke-dasharray: 2 3;
  }

  .ghost {
    fill: color-mix(in srgb, var(--noise) 22%, transparent);
    stroke: var(--noise);
    stroke-width: 1;
  }

  .cone {
    fill: var(--signal-bg);
    stroke: none;
  }

  .edge {
    stroke: var(--ink-soft);
    stroke-width: 1.5;
  }

  .edge.out {
    stroke: var(--signal);
    stroke-width: 2.4;
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
