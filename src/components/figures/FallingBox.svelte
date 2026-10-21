<script lang="ts">
  import { onMount } from 'svelte';
  import { tween } from '~/lib/figure/pointer';
  import { GM_EARTH, R_EARTH, fallFrom, infallRadius } from '~/lib/physics/relativity';

  /**
   * What free fall cannot hide (The Straightest Path). A box is released from rest one Earth
   * radius above the ground with a ring of balls floating inside it. Every ball falls straight
   * at the Earth's centre, so seen from inside the box the ring squeezes across and stretches
   * along the line to the centre: the tide. Each ball's fall is exact Newtonian radial infall.
   * The shape depends only on how long you watch; how far the balls move scales with the box.
   */
  const R0 = 2 * R_EARTH;
  const T_MAX = 1800;
  const N = 16;
  const SIZES = [1, 10, 100, 1e3, 1e4, 1e5, 1e6];

  let time = $state(0);
  let sizeIndex = $state(3);
  let width = $state(600);
  let hydrated = $state(false);
  let stop: (() => void) | undefined;
  onMount(() => {
    hydrated = true;
    return () => stop?.();
  });

  const size = $derived(SIZES[sizeIndex]);
  // Ball k starts on a circle of radius size/2 round the box centre, at angle 2πk/N; y points
  // up, away from the Earth.
  const start = $derived(
    Array.from({ length: N }, (_, k) => {
      const a = (2 * Math.PI * k) / N;
      return { x: (size / 2) * Math.cos(a), y: (size / 2) * Math.sin(a) };
    }),
  );
  const centre = $derived(infallRadius(R0, GM_EARTH, time));
  const balls = $derived(
    start.map((b) => {
      const p = fallFrom(b.x, R0 + b.y, GM_EARTH, time);
      return { x: p.x, y: p.y - centre };
    }),
  );
  // The pair at 0 and π (across) and at π/2 and 3π/2 (along the line to the centre).
  const across = $derived(balls[0].x - balls[N / 2].x);
  const along = $derived(balls[N / 4].y - balls[(3 * N) / 4].y);
  const closed = $derived(size - across);
  const opened = $derived(along - size);

  function length(m: number): string {
    const a = Math.abs(m);
    if (a < 1e-9) return '0';
    if (a < 1e-3) return `${(m * 1e6).toPrecision(2)} μm`;
    if (a < 1) return `${(m * 1e3).toPrecision(2)} mm`;
    if (a < 1e3) return `${m.toPrecision(3)} m`;
    return `${(m / 1e3).toPrecision(3)} km`;
  }
  const minutes = (s: number) =>
    `${Math.floor(s / 60)} min ${String(Math.floor(s % 60)).padStart(2, '0')} s`;

  function play() {
    stop?.();
    const from = time >= T_MAX ? 0 : time;
    stop = tween(from, T_MAX, (v) => (time = v), 4000 * (1 - from / T_MAX) + 300);
  }

  // Layout: two panels side by side, or stacked on a narrow screen.
  const stacked = $derived(width < 560);
  const P = $derived(stacked ? width : (width - 24) / 2);
  const H = $derived(stacked ? 2 * P * 0.82 + 40 : P * 0.92 + 20);
  const left = { x: 0, y: 24 };
  const right = $derived(stacked ? { x: 0, y: P * 0.82 + 52 } : { x: P + 24, y: 24 });
  const PH = $derived(stacked ? P * 0.82 - 24 : P * 0.92 - 24);

  // Outside: the Earth and the box, drawn to scale, with the box enlarged when it would vanish.
  const km = $derived((PH - 24) / (R0 + R_EARTH));
  const ox = $derived(left.x + P / 2);
  const oy = $derived(left.y + 12 + R0 * km);
  const boxDrawn = $derived(Math.max(size * km, 14));
  const enlarged = $derived(size * km < 14);

  // Inside: the ring in units of the box, so its shape is what the reader compares.
  const ix = $derived(right.x + P / 2);
  const iy = $derived(right.y + PH / 2);
  const ringScale = $derived((Math.min(P, PH) * 0.2) / (size / 2));
  const ring = $derived(balls.map((b) => ({ x: ix + b.x * ringScale, y: iy - b.y * ringScale })));
  const ringPath = $derived(
    ring.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('') + 'Z',
  );
</script>

<div
  class="falling-box"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-time={Math.round(time)}
  data-size={size}
  data-squeeze={(closed / size).toFixed(3)}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`After ${minutes(time)} of free fall, the balls in a ${length(size)} box have moved: the two side by side have closed by ${length(closed)} and the two one above the other have opened by ${length(opened)}.`}
  >
    <text class="caps" x={left.x} y="14">seen from outside</text>
    <circle class="earth" cx={ox} cy={oy} r={R_EARTH * km} />
    <text x={ox} y={oy + R_EARTH * km * 0.55} text-anchor="middle">Earth</text>
    <line class="model" x1={ox - boxDrawn / 2} y1={oy - R0 * km} x2={ox} y2={oy} />
    <line class="model" x1={ox + boxDrawn / 2} y1={oy - R0 * km} x2={ox} y2={oy} />
    <rect
      class="start"
      x={ox - boxDrawn / 2}
      y={oy - R0 * km - boxDrawn / 2}
      width={boxDrawn}
      height={boxDrawn}
    />
    <rect
      class="box"
      x={ox - boxDrawn / 2}
      y={oy - centre * km - boxDrawn / 2}
      width={boxDrawn}
      height={boxDrawn}
    />
    <text class="ink halo" x={ox + boxDrawn / 2 + 8} y={oy - centre * km + 4}>
      the box{enlarged ? ' (enlarged)' : ''}
    </text>
    {#if (R0 - centre) * km > 18}
      <text class="halo" x={ox + boxDrawn / 2 + 8} y={oy - R0 * km + 4}>released here</text>
    {/if}

    <text class="caps" x={right.x} y={right.y - 10}>seen from inside the box</text>
    <rect
      class="frame"
      x={ix - Math.min(P, PH) * 0.42}
      y={iy - Math.min(P, PH) * 0.42}
      width={Math.min(P, PH) * 0.84}
      height={Math.min(P, PH) * 0.84}
      rx="4"
    />
    <circle class="model" cx={ix} cy={iy} r={Math.min(P, PH) * 0.2} />
    <path class="signal" d={ringPath} />
    {#each ring as p, i (i)}
      <circle class="dot" cx={p.x} cy={p.y} r="3.5" />
    {/each}
    <text class="halo" x={ix} y={iy + Math.min(P, PH) * 0.42 + 16} text-anchor="middle">
      towards the Earth ↓
    </text>
  </svg>

  <div class="controls">
    <label class="slider">
      <span>Time falling <b>{minutes(time)}</b></span>
      <input
        type="range"
        min="0"
        max={T_MAX}
        step="10"
        bind:value={time}
        oninput={() => stop?.()}
      />
    </label>
    <label class="slider">
      <span>Size of the box <b>{length(size)}</b></span>
      <input type="range" min="0" max={SIZES.length - 1} step="1" bind:value={sizeIndex} />
    </label>
    <button type="button" onclick={play}>Let it fall</button>
  </div>
  <dl class="readouts">
    <div>
      <dt>side by side: closed by</dt>
      <dd>{length(closed)}</dd>
    </div>
    <div>
      <dt>one above the other: opened by</dt>
      <dd>{length(opened)}</dd>
    </div>
    <div>
      <dt>the box has fallen</dt>
      <dd>{length(R0 - centre)}</dd>
    </div>
  </dl>
</div>

<style>
  .falling-box {
    width: 100%;
  }

  .fig text.halo {
    paint-order: stroke;
    stroke: var(--ground);
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  .earth {
    fill: color-mix(in srgb, var(--noise) 22%, var(--surface));
    stroke: var(--noise);
    stroke-width: 1;
  }

  .start {
    fill: none;
    stroke: var(--rule);
    stroke-dasharray: 3 3;
  }

  .box,
  .frame {
    fill: var(--surface);
    stroke: var(--ink-soft);
    stroke-width: 1.5;
  }

  .frame {
    fill: none;
    stroke: var(--rule);
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.5rem;
    align-items: end;
    margin-top: 0.75rem;
  }

  .slider {
    display: grid;
    flex: 1 1 12rem;
    gap: 0.25rem;
    font-size: var(--text-sm);
    color: var(--ink-soft);
  }

  button {
    padding: 0.4rem 0.9rem;
    border: 1px solid var(--signal);
    border-radius: 999px;
    background: var(--signal-bg);
    color: var(--ink);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
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
</style>
