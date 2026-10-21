<script lang="ts">
  import { onMount } from 'svelte';
  import { dragger, stepKey } from '~/lib/figure/pointer';
  import { log } from '~/lib/figure/svg';
  import { C, DAY, GM_EARTH, R_EARTH, orbitClock } from '~/lib/physics/relativity';

  /**
   * Clocks in orbit (The Straightest Path). A clock in a circular orbit runs fast because it
   * sits higher in the Earth's well, and slow because it moves. Drag the orbit out from the
   * ground to the Moon: below one and a half Earth radii speed wins, above it height wins, and
   * at the GPS orbit the clocks gain 38 microseconds a day. Weak-field formulas, to first order.
   */
  const MARKS = [
    { name: 'ISS', r: 6_791e3 },
    { name: 'GPS', r: 26_561.75e3 },
    { name: 'geostationary', r: 42_164e3 },
    { name: 'Moon', r: 384_400e3 },
  ];
  const LO = 1;
  const HI = 70;
  const us = (fraction: number) => fraction * DAY * 1e6;

  let radius = $state(26_561.75e3 / R_EARTH);
  let width = $state(600);
  let svg: SVGSVGElement | undefined = $state();
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  const rate = $derived(orbitClock(GM_EARTH, radius * R_EARTH, R_EARTH));
  const H = 320;
  const PAD = { l: 44, r: 16, t: 28, b: 40 };
  const x = $derived(log(LO, HI, PAD.l, width - PAD.r));
  const y = (v: number) => PAD.t + ((60 - v) / 100) * (H - PAD.t - PAD.b);
  const grid = Array.from({ length: 161 }, (_, i) => LO * (HI / LO) ** (i / 160));
  const curve = (part: 'height' | 'speed' | 'net') =>
    grid
      .map((d, i) => {
        const v = us(orbitClock(GM_EARTH, d * R_EARTH, R_EARTH)[part]);
        return `${i ? 'L' : 'M'}${x(d).toFixed(1)},${y(v).toFixed(1)}`;
      })
      .join('');

  const drag = dragger(
    () => svg,
    (p) => {
      const d = LO * (HI / LO) ** ((p.x - PAD.l) / (width - PAD.l - PAD.r));
      radius = Math.min(HI, Math.max(LO, d));
    },
  );
  function onKey(event: KeyboardEvent) {
    const next = stepKey(event, Math.log10(radius), {
      step: 0.01,
      min: Math.log10(LO),
      max: Math.log10(HI),
    });
    if (next !== null) radius = 10 ** next;
  }
  const signed = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`;
  const altitude = $derived((radius - 1) * R_EARTH);
</script>

<div
  class="orbit-clocks"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-radius={radius.toFixed(2)}
  data-net={us(rate.net).toFixed(1)}
>
  <svg
    bind:this={svg}
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="group"
    aria-label={`A clock in a circular orbit ${Math.round(altitude / 1e3).toLocaleString('en-GB')} km up gains ${us(rate.height).toFixed(1)} microseconds a day from its height and loses ${Math.abs(us(rate.speed)).toFixed(1)} from its speed, a net ${signed(us(rate.net))} microseconds a day against a clock on the ground.`}
  >
    <text class="caps" x={PAD.l} y="14">microseconds a day, against the ground</text>
    {#each [-40, -20, 0, 20, 40, 60] as v (v)}
      <line class={v === 0 ? 'axis' : 'grid'} x1={PAD.l} x2={width - PAD.r} y1={y(v)} y2={y(v)} />
      <text x={PAD.l - 8} y={y(v) + 4} text-anchor="end">{v > 0 ? `+${v}` : v}</text>
    {/each}
    {#each MARKS as m (m.name)}
      <line class="mark" x1={x(m.r / R_EARTH)} x2={x(m.r / R_EARTH)} y1={PAD.t} y2={H - PAD.b} />
      <text
        x={x(m.r / R_EARTH) + (m.name === 'Moon' ? -4 : 4)}
        y={H - PAD.b - 6}
        text-anchor={m.name === 'Moon' ? 'end' : 'start'}>{m.name}</text
      >
    {/each}
    <path class="model" d={curve('height')} />
    <path class="model" d={curve('speed')} />
    <path class="net" d={curve('net')} />
    <text class="halo" x={x(1.15)} y={y(53)}>height: runs fast</text>
    <text class="halo" x={x(1.6)} y={y(-30)}>speed: runs slow</text>
    <text class="ink halo" x={x(12)} y={y(us(orbitClock(GM_EARTH, 12 * R_EARTH, R_EARTH).net)) + 18}
      >net</text
    >
    <circle class="dot ink" cx={x(1.5)} cy={y(0)} r="3" />
    <text class="halo" x={x(1.5) + 6} y={y(0) + 16}>even at 1.5</text>

    <line class="pick" x1={x(radius)} x2={x(radius)} y1={PAD.t} y2={H - PAD.b} />
    <circle
      class="handle"
      cx={x(radius)}
      cy={y(us(rate.net))}
      r="8"
      tabindex="0"
      role="slider"
      aria-label="Orbit radius, in Earth radii"
      aria-valuemin={LO}
      aria-valuemax={HI}
      aria-valuenow={Number(radius.toFixed(2))}
      aria-valuetext={`${radius.toFixed(2)} Earth radii, ${Math.round(altitude / 1e3)} km up`}
      onpointerdown={drag}
      onkeydown={onKey}
    />
    <line class="axis" x1={PAD.l} x2={width - PAD.r} y1={H - PAD.b} y2={H - PAD.b} />
    {#each [1, 2, 5, 10, 20, 50] as d (d)}
      <text x={x(d)} y={H - PAD.b + 16} text-anchor="middle">{d}</text>
    {/each}
    <text x={width - PAD.r} y={H - 6} text-anchor="end">orbit radius, Earth radii</text>
  </svg>

  <dl class="readouts">
    <div>
      <dt>from height</dt>
      <dd>{signed(us(rate.height))} μs</dd>
    </div>
    <div>
      <dt>from speed</dt>
      <dd>{signed(us(rate.speed))} μs</dd>
    </div>
    <div>
      <dt>net, each day</dt>
      <dd class="signal">{signed(us(rate.net))} μs</dd>
    </div>
    <div>
      <dt>if nobody corrected it</dt>
      <dd>{((Math.abs(rate.net) * DAY * C) / 1e3).toFixed(1)} km a day</dd>
    </div>
  </dl>
</div>

<style>
  .orbit-clocks {
    width: 100%;
  }

  .fig text.halo {
    paint-order: stroke;
    stroke: var(--ground);
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  .mark {
    stroke: var(--rule-soft);
    stroke-width: 1;
  }

  .net {
    fill: none;
    stroke: var(--ink);
    stroke-width: 2;
  }

  .pick {
    stroke: var(--signal);
    stroke-width: 1;
    stroke-dasharray: 2 3;
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

  .readouts dd.signal {
    color: var(--signal);
  }
</style>
