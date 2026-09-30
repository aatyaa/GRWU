<script lang="ts">
  import { scaleLinear } from 'd3-scale';
  import { onMount } from 'svelte';
  import { displacement, ringOf } from '~/lib/physics/oscillator';

  /**
   * A Bell That Weighs Itself: a mass on a spring with friction, released from rest. The reader
   * sets the mass, the stiffness and the friction; the figure draws the motion, its fading
   * envelope, and reads off the two numbers that describe any ring: its frequency and its
   * damping time. Computed by physics/oscillator.ts, checked against scipy's ODE solver.
   */
  let mass = $state(1);
  let stiffness = $state(60);
  let damping = $state(0.6);
  let width = $state(640);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  const T = 6;
  const H = 240;
  const PAD = { l: 34, r: 14, t: 14, b: 30 };
  const osc = $derived({ mass, stiffness, damping });
  const ring = $derived(ringOf(osc));
  const x = $derived(
    scaleLinear()
      .domain([0, T])
      .range([PAD.l, width - PAD.r]),
  );
  const y = scaleLinear()
    .domain([-1.1, 1.1])
    .range([H - PAD.b, PAD.t]);
  const N = 600;
  const path = $derived(
    Array.from({ length: N + 1 }, (_, i) => {
      const t = (i / N) * T;
      return `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(displacement(osc, 1, 0, t)).toFixed(1)}`;
    }).join(''),
  );
  const envelope = (sign: number) =>
    Array.from({ length: 121 }, (_, i) => {
      const t = (i / 120) * T;
      return `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(sign * Math.exp(-t / ring.tau)).toFixed(1)}`;
    }).join('');
  const f2 = (v: number) => v.toFixed(2);
</script>

<div
  class="spring-lab"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-frequency={f2(ring.frequency)}
  data-tau={f2(ring.tau)}
  data-q={f2(ring.quality)}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`A mass on a spring released from rest: it oscillates ${f2(ring.frequency)} times a second and its swing shrinks by a factor e every ${f2(ring.tau)} seconds.`}
  >
    <line class="axis" x1={PAD.l} x2={width - PAD.r} y1={y(0)} y2={y(0)} />
    {#each [0, 1, 2, 3, 4, 5, 6] as s (s)}
      <text
        class="tick"
        x={x(s)}
        y={H - 10}
        text-anchor={s === 0 ? 'start' : s === 6 ? 'end' : 'middle'}>{s} s</text
      >
    {/each}
    <path class="envelope" d={envelope(1)} />
    <path class="envelope" d={envelope(-1)} />
    {#if ring.tau <= T}
      <line class="tau" x1={x(ring.tau)} x2={x(ring.tau)} y1={PAD.t} y2={H - PAD.b} />
      <text class="note" x={x(ring.tau) + 5} y={PAD.t + 12}>τ: the swing is down to 1/e</text>
    {/if}
    <path class="motion" d={path} />
  </svg>

  <div class="sliders">
    <label>
      <span>Mass <b>{mass.toFixed(1)} kg</b></span>
      <input type="range" min="0.2" max="3" step="0.1" bind:value={mass} />
    </label>
    <label>
      <span>Stiffness of the spring <b>{stiffness} N/m</b></span>
      <input type="range" min="5" max="200" step="5" bind:value={stiffness} />
    </label>
    <label>
      <span>Friction <b>{damping.toFixed(2)} kg/s</b></span>
      <input type="range" min="0.05" max="1.5" step="0.05" bind:value={damping} />
    </label>
  </div>
  <dl class="numbers">
    <div>
      <dt>frequency f</dt>
      <dd>{f2(ring.frequency)} Hz</dd>
    </div>
    <div>
      <dt>damping time τ</dt>
      <dd>{f2(ring.tau)} s</dd>
    </div>
    <div>
      <dt>quality Q = π f τ</dt>
      <dd>{ring.quality.toFixed(1)}</dd>
    </div>
  </dl>
</div>

<style>
  .spring-lab {
    width: 100%;
  }

  .axis {
    stroke: var(--rule);
  }

  .tick,
  .note {
    font-size: 11px;
    fill: var(--ink-soft);
  }

  .motion {
    fill: none;
    stroke: var(--model);
    stroke-width: 1.8;
  }

  .envelope {
    fill: none;
    stroke: var(--ink-soft);
    stroke-width: 1.2;
    stroke-dasharray: 5 4;
  }

  .tau {
    stroke: var(--ink-soft);
    stroke-dasharray: 2 3;
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
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.6rem;
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
</style>
