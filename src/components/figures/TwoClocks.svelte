<script lang="ts">
  import { onMount } from 'svelte';
  import { collapseAt, collapseAtTau, horizonCrossing } from '~/lib/physics/blackhole';
  import { C, GM_SUN } from '~/lib/physics/relativity';

  /**
   * One collapse, two clocks (Mass, Spin and Nothing Else). The surface of a pressureless star of
   * ten solar masses, released from rest at four Schwarzschild radii (Oppenheimer and Snyder):
   * on its own clock it crosses the horizon and reaches the centre in about a millisecond; on a
   * clock far away it creeps towards the horizon for ever. Move along the surface's own clock.
   */
  const R0 = 4;
  const UNIT_MS = ((2 * 10 * GM_SUN) / (C * C) / C) * 1e3; // r_s / c for ten suns, ms
  const CENTRE = (Math.PI / 2) * R0 ** 1.5;
  const CROSS = horizonCrossing(R0);
  const T_MAX = 3.2 / UNIT_MS; // the right edge, in r_s / c

  // The slider reads the surface's own clock in milliseconds.
  let ownMs = $state(Number((CROSS * 0.85 * UNIT_MS).toFixed(2)));
  const tau = $derived(ownMs / UNIT_MS);
  let width = $state(600);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  const now = $derived(collapseAtTau(tau, R0));
  const inside = $derived(now.r <= 1);

  // Both curves at once, by the cycloid angle: own clock to the centre, far clock to the edge.
  const own = Array.from({ length: 241 }, (_, i) => collapseAt((Math.PI * i) / 240, R0));
  const etaH = 2 * Math.atan(Math.sqrt(R0 - 1));
  // The far clock's time grows like −ln(η_h − η): crowd the samples towards the horizon.
  const far = Array.from({ length: 401 }, (_, i) =>
    collapseAt(etaH * (1 - Math.exp(-i / 20)), R0),
  ).filter((p) => p.t <= T_MAX);

  const H = 300;
  const PAD = { l: 44, r: 18, t: 30, b: 42 };
  const x = $derived((t: number) => PAD.l + (t / T_MAX) * (width - PAD.l - PAD.r));
  const y = (r: number) => H - PAD.b - (r / R0) * (H - PAD.t - PAD.b);
  const ownPath = $derived(
    own.map((p, i) => `${i ? 'L' : 'M'}${x(p.tau).toFixed(1)},${y(p.r).toFixed(1)}`).join(''),
  );
  const farPath = $derived(
    far.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.r).toFixed(1)}`).join(''),
  );
  const ms = (v: number) => `${(v * UNIT_MS).toFixed(2)} ms`;
</script>

<div
  class="two-clocks"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-tau={(tau * UNIT_MS).toFixed(2)}
  data-far={inside ? 'never' : (now.t * UNIT_MS).toFixed(2)}
  data-r={now.r.toFixed(2)}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={inside
      ? `After ${ms(tau)} on its own clock, the surface is inside the horizon at ${now.r.toFixed(2)} Schwarzschild radii. No clock far away ever sees this moment.`
      : `After ${ms(tau)} on its own clock, the surface is at ${now.r.toFixed(2)} Schwarzschild radii; a clock far away reads ${ms(now.t)} for the same moment.`}
  >
    <text class="caps" x={PAD.l} y="14">a collapsing star, on two clocks</text>
    {#each [1, 2, 3, 4] as r (r)}
      <line
        class={r === 1 ? 'horizon' : 'grid'}
        x1={PAD.l}
        x2={width - PAD.r}
        y1={y(r)}
        y2={y(r)}
      />
      <text x={PAD.l - 8} y={y(r) + 4} text-anchor="end">{r}</text>
    {/each}
    <text class="ink halo" x={PAD.l + 6} y={y(1) - 6}>horizon</text>
    <text x={PAD.l - 8} y={PAD.t - 12} text-anchor="end">rₛ</text>
    <path class="model" d={farPath} />
    <path class="own" d={ownPath} />
    <text class="halo" x={width - PAD.r} y={y(1) + 18} text-anchor="end"
      >a clock far away: never arrives</text
    >
    <text class="ink halo" x={x(CENTRE) - 8} y={y(0.3)} text-anchor="end">its own clock</text>
    <line class="pick" x1={x(tau)} x2={x(tau)} y1={PAD.t} y2={H - PAD.b} />
    <circle class="dot ink" cx={x(tau)} cy={y(now.r)} r="5" />
    {#if !inside}
      <line class="link" x1={x(tau)} x2={x(now.t)} y1={y(now.r)} y2={y(now.r)} />
      <circle class="dot" cx={x(now.t)} cy={y(now.r)} r="5" />
    {/if}
    <line class="axis" x1={PAD.l} x2={width - PAD.r} y1={H - PAD.b} y2={H - PAD.b} />
    {#each [0, 1, 2, 3] as t (t)}
      <text x={x(t / UNIT_MS)} y={H - PAD.b + 16} text-anchor="middle">{t}</text>
    {/each}
    <text x={width - PAD.r} y={H - 6} text-anchor="end">time, milliseconds</text>
  </svg>

  <div class="controls">
    <label class="slider">
      <span>On the surface's own clock <b>{ms(tau)}</b></span>
      <input
        type="range"
        min="0"
        max={Math.floor(CENTRE * UNIT_MS * 1000) / 1000}
        step="0.005"
        bind:value={ownMs}
      />
    </label>
  </div>
  <dl class="readouts">
    <div>
      <dt>the surface is at</dt>
      <dd>{now.r.toFixed(2)} rₛ</dd>
    </div>
    <div>
      <dt>its own clock reads</dt>
      <dd>{ms(tau)}</dd>
    </div>
    <div>
      <dt>a clock far away reads</dt>
      <dd class:bad={inside}>{inside ? 'never sees it' : ms(now.t)}</dd>
    </div>
  </dl>
</div>

<style>
  .two-clocks {
    width: 100%;
  }

  .fig text.halo {
    paint-order: stroke;
    stroke: var(--ground);
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  .horizon {
    stroke: var(--ink-soft);
    stroke-width: 1;
    stroke-dasharray: 2 3;
  }

  .own {
    fill: none;
    stroke: var(--ink);
    stroke-width: 2;
  }

  .pick {
    stroke: var(--signal);
    stroke-width: 1;
    stroke-dasharray: 2 3;
  }

  .link {
    stroke: var(--signal);
    stroke-width: 1;
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
