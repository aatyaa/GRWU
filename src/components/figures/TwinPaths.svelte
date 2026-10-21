<script lang="ts">
  import { onMount } from 'svelte';
  import { dragger, stepKey } from '~/lib/figure/pointer';
  import { properTime } from '~/lib/physics/relativity';

  /**
   * The straightest path ages most (The Straightest Path). Two clocks leave the same event and
   * meet again ten years later. One stays put; the other travels out to a turning point the
   * reader drags, and back. The ticks mark each clock's own years: the traveller's are spread
   * further apart, and fewer of them fit between the same two events.
   */
  const T = 10;
  let turn = $state({ x: 3, ct: 5 });
  let width = $state(600);
  let svg: SVGSVGElement | undefined = $state();
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  // The turning point must stay inside both light cones, so that neither leg outruns light.
  function clamp(p: { x: number; ct: number }) {
    const ct = Math.min(T - 0.3, Math.max(0.3, p.ct));
    const reach = Math.min(ct, T - ct) - 0.05;
    return { x: Math.min(reach, Math.max(-reach, p.x)), ct };
  }

  const home = properTime([
    { x: 0, ct: 0 },
    { x: 0, ct: T },
  ]);
  const away = $derived(
    properTime([
      { x: 0, ct: 0 },
      { x: turn.x, ct: turn.ct },
      { x: 0, ct: T },
    ]),
  );

  const H = 380;
  const PAD = { t: 28, b: 46 };
  const unit = (H - PAD.t - PAD.b) / T;
  const x0 = $derived(Math.max(150, width / 2 - unit));
  const y0 = H - PAD.b;
  const px = (v: number) => x0 + v * unit;
  const py = (v: number) => y0 - v * unit;

  /** Points one proper year apart along a straight piece from a to b, after `done` years. */
  function ticks(a: { x: number; ct: number }, b: { x: number; ct: number }, done: number) {
    const dx = b.x - a.x;
    const dct = b.ct - a.ct;
    const tau = Math.sqrt(dct * dct - dx * dx);
    const out: { x: number; ct: number }[] = [];
    for (let k = Math.ceil(done); k - done <= tau + 1e-9; k++) {
      if (k === 0) continue;
      const u = (k - done) / tau;
      out.push({ x: a.x + u * dx, ct: a.ct + u * dct });
    }
    return out;
  }
  const leg1 = $derived(Math.sqrt(turn.ct ** 2 - turn.x ** 2));
  const awayTicks = $derived([
    ...ticks({ x: 0, ct: 0 }, turn, 0),
    ...ticks(turn, { x: 0, ct: T }, leg1),
  ]);
  const homeTicks = Array.from({ length: T - 1 }, (_, i) => ({ x: 0, ct: i + 1 }));

  const drag = dragger(
    () => svg,
    (p) => (turn = clamp({ x: (p.x - x0) / unit, ct: (y0 - p.y) / unit })),
  );
  function onKey(event: KeyboardEvent) {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const next = stepKey(event, turn.ct, { step: 0.1, min: 0.3, max: T - 0.3 });
      if (next !== null) turn = clamp({ x: turn.x, ct: next });
      return;
    }
    const next = stepKey(event, turn.x, { step: 0.1, min: -4.9, max: 4.9 });
    if (next !== null) turn = clamp({ x: next, ct: turn.ct });
  }
  const tick = (p: { x: number; ct: number }, len = 6) => {
    // A short mark across the worldline.
    return { x1: px(p.x) - len, x2: px(p.x) + len, y1: py(p.ct), y2: py(p.ct) };
  };
</script>

<div
  class="twin-paths"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-home={home.toFixed(1)}
  data-away={away.toFixed(2)}
  data-turn-x={turn.x.toFixed(1)}
>
  <svg
    bind:this={svg}
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="group"
    aria-label={`Two clocks part and meet again ten years later by the stay-at-home clock. The traveller turns round ${Math.abs(turn.x).toFixed(1)} light-years away and its own clock reads ${away.toFixed(1)} years at the reunion.`}
  >
    <text class="caps" x="12" y="14">two clocks, the same two events</text>
    <line class="axis" x1={px(-4)} x2={px(5)} y1={py(0)} y2={py(0)} />
    <text x={px(5)} y={py(0) + 34} text-anchor="end">x, light-years</text>
    {#each [-4, -2, 2, 4] as v (v)}
      <text x={px(v)} y={py(0) + 18} text-anchor="middle">{v}</text>
    {/each}
    <!-- The region the turning point may take: inside both light cones. -->
    <path
      class="cone"
      d="M{px(0)},{py(0)}L{px(T / 2)},{py(T / 2)}L{px(0)},{py(T)}L{px(-T / 2)},{py(T / 2)}Z"
    />
    <text class="halo" x={px(-2.2)} y={py(1.5)} text-anchor="end">light</text>

    <line class="home" x1={px(0)} x2={px(0)} y1={py(0)} y2={py(T)} />
    {#each homeTicks as p (p.ct)}
      <line class="home-tick" {...tick(p)} />
    {/each}
    <polyline class="signal" points="{px(0)},{py(0)} {px(turn.x)},{py(turn.ct)} {px(0)},{py(T)}" />
    {#each awayTicks as p, i (i)}
      <line class="away-tick" {...tick(p)} />
    {/each}
    <circle class="dot ink" cx={px(0)} cy={py(0)} r="5" />
    <circle class="dot ink" cx={px(0)} cy={py(T)} r="5" />
    <text class="ink halo" x={px(0) - 10} y={py(0) - 6} text-anchor="end">they part</text>
    <text class="ink halo" x={px(0) - 10} y={py(T) + 4} text-anchor="end">they meet</text>
    <text class="halo" x={px(0) - 10} y={py(T / 2)} text-anchor="end">stays put</text>
    <circle
      class="handle"
      cx={px(turn.x)}
      cy={py(turn.ct)}
      r="8"
      tabindex="0"
      role="slider"
      aria-label="Where the traveller turns round"
      aria-valuemin={-4.9}
      aria-valuemax={4.9}
      aria-valuenow={Number(turn.x.toFixed(1))}
      aria-valuetext={`${Math.abs(turn.x).toFixed(1)} light-years out, ${turn.ct.toFixed(1)} years after leaving`}
      onpointerdown={drag}
      onkeydown={onKey}
    />
    <text
      class="signal halo"
      x={px(turn.x) + (turn.x >= 0 ? 12 : -12)}
      y={py(turn.ct) + 4}
      text-anchor={turn.x >= 0 ? 'start' : 'end'}>turns round</text
    >
  </svg>

  <dl class="readouts">
    <div>
      <dt>the clock that stays put reads</dt>
      <dd>{home.toFixed(1)} years</dd>
    </div>
    <div>
      <dt>the traveller's clock reads</dt>
      <dd class="signal">{away.toFixed(1)} years</dd>
    </div>
    <div>
      <dt>the traveller is younger by</dt>
      <dd>{(home - away).toFixed(1)} years</dd>
    </div>
  </dl>
</div>

<style>
  .twin-paths {
    width: 100%;
  }

  .fig text.halo {
    paint-order: stroke;
    stroke: var(--ground);
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  .cone {
    fill: color-mix(in srgb, var(--noise) 10%, transparent);
    stroke: var(--rule);
    stroke-dasharray: 2 3;
  }

  .home {
    stroke: var(--ink-soft);
    stroke-width: 2;
  }

  .home-tick {
    stroke: var(--ink-soft);
    stroke-width: 1.5;
  }

  .away-tick {
    stroke: var(--signal);
    stroke-width: 1.5;
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

  .readouts dd.signal {
    color: var(--signal);
  }
</style>
