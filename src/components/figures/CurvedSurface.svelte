<script lang="ts">
  import { onMount } from 'svelte';
  import {
    distance,
    dot,
    cross,
    fromLatLon,
    poleLoop,
    transport,
    turn,
    type Vec3,
  } from '~/lib/physics/sphere';

  /**
   * Straight lines on a sphere (The Straightest Path), in two modes. `walkers`: two people on
   * the equator both walk due north, along the straightest lines the surface has, and meet at
   * the pole without either one turning: curvature as the tide. `arrow`: an arrow carried down
   * a meridian, along the equator and back up, never turned, comes home pointing elsewhere by
   * exactly the angle at the pole, which is the area the loop encloses.
   */
  let { mode = 'walkers' }: { mode?: 'walkers' | 'arrow' } = $props();

  const EARTH_KM = 6371;
  const deg = Math.PI / 180;
  // Each mode opens on its own starting picture; the mode itself never changes.
  const opening = () =>
    mode === 'arrow' ? { span: 90, progress: 1 } : { span: 40, progress: 0.6 };
  let spanDeg = $state(opening().span);
  let progress = $state(opening().progress);
  let width = $state(600);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  const span = $derived(spanDeg * deg);

  // An orthographic view from latitude 28°, longitude 50°.
  const view = fromLatLon(28 * deg, 50 * deg);
  const right = (() => {
    const r = cross([0, 0, 1], view);
    const n = Math.hypot(...r);
    return [r[0] / n, r[1] / n, r[2] / n] as Vec3;
  })();
  const up = cross(view, right);
  const R = $derived(Math.min(width * 0.4, 170));
  const H = $derived(2 * R + 44);
  const cx = $derived(width / 2);
  const cy = $derived(R + 26);
  const sx = (p: Vec3) => cx + R * dot(p, right);
  const sy = (p: Vec3) => cy - R * dot(p, up);
  const front = (p: Vec3) => dot(p, view) > -1e-9;

  /** A path on the sphere as SVG, broken where it passes behind. */
  function path(points: Vec3[]): string {
    let d = '';
    let pen = false;
    for (const p of points) {
      if (!front(p)) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${sx(p).toFixed(1)},${sy(p).toFixed(1)}`;
      pen = true;
    }
    return d;
  }
  const meridian = (lon: number, from = -90, to = 90) =>
    Array.from({ length: 61 }, (_, i) => fromLatLon((from + ((to - from) * i) / 60) * deg, lon));
  const parallel = (lat: number) =>
    Array.from({ length: 121 }, (_, i) => fromLatLon(lat * deg, i * 3 * deg));
  const graticule = $derived(
    [
      ...[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((l) => meridian(l * deg)),
      ...[-60, -30, 30, 60].map(parallel),
    ].map(path),
  );
  const equator = $derived(path(parallel(0)));

  /** An arrow at p along tangent v, drawn as a short arc on the sphere with a head. */
  function arrow(p: Vec3, v: Vec3, length = 0.32): string {
    const tip: Vec3 = [p[0] + v[0] * length, p[1] + v[1] * length, p[2] + v[2] * length];
    const n = Math.hypot(...tip);
    const t: Vec3 = [tip[0] / n, tip[1] / n, tip[2] / n];
    const x0 = sx(p);
    const y0 = sy(p);
    const x1 = sx(t);
    const y1 = sy(t);
    const a = Math.atan2(y1 - y0, x1 - x0);
    const h = 8;
    return `M${x0.toFixed(1)},${y0.toFixed(1)}L${x1.toFixed(1)},${y1.toFixed(1)}M${(x1 - h * Math.cos(a - 0.45)).toFixed(1)},${(y1 - h * Math.sin(a - 0.45)).toFixed(1)}L${x1.toFixed(1)},${y1.toFixed(1)}L${(x1 - h * Math.cos(a + 0.45)).toFixed(1)},${(y1 - h * Math.sin(a + 0.45)).toFixed(1)}`;
  }

  // Walkers: both start on the equator heading north and walk `progress` of the way to the pole.
  const walked = $derived(progress * 90 * deg);
  const walkerA = $derived(fromLatLon(walked, 0));
  const walkerB = $derived(fromLatLon(walked, span));
  const gap = $derived(distance(walkerA, walkerB) * EARTH_KM);
  const startGap = $derived(span * EARTH_KM);
  const north = (p: Vec3): Vec3 => {
    // At latitude φ the northward direction is d/dφ of the position.
    const lat = Math.asin(p[2]);
    const lon = Math.atan2(p[1], p[0]);
    return [-Math.sin(lat) * Math.cos(lon), -Math.sin(lat) * Math.sin(lon), Math.cos(lat)];
  };

  // Arrow: carried round the pole triangle; `progress` is how far round.
  const loop = $derived(poleLoop(span, 60));
  const pole: Vec3 = [0, 0, 1];
  const start: Vec3 = [1, 0, 0];
  const carried = $derived(transport(loop, start));
  const at = $derived(Math.round(progress * (loop.length - 1)));
  const done = $derived(at === loop.length - 1);
  const turned = $derived(turn(start, carried[loop.length - 1], pole) / deg);
  const trail = $derived(
    Array.from({ length: 13 }, (_, k) => Math.round((k * (loop.length - 1)) / 12)).filter(
      (i) => i < at,
    ),
  );
</script>

<div
  class="curved-surface"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-mode={mode}
  data-span={spanDeg}
  data-progress={progress.toFixed(2)}
  data-gap={Math.round(gap)}
  data-turned={done ? turned.toFixed(1) : ''}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={mode === 'walkers'
      ? `Two walkers start ${Math.round(startGap)} km apart on the equator of an Earth-sized sphere and both walk due north. After ${Math.round(walked * EARTH_KM)} km they are ${Math.round(gap)} km apart; at the pole they meet.`
      : done
        ? `An arrow carried round a loop from the pole to the equator, ${spanDeg}° along it and back, never turned, comes home pointing ${turned.toFixed(0)}° away from where it started.`
        : `An arrow is being carried round a loop from the pole to the equator and back, never turned.`}
  >
    <text class="caps" x="12" y="14">
      {mode === 'walkers'
        ? 'two walkers, both heading due north'
        : 'carry an arrow, never turning it'}
    </text>
    <circle class="globe" {cx} {cy} r={R} />
    {#each graticule as d, i (i)}
      <path class="grid" {d} />
    {/each}
    <path class="equator" d={equator} />

    {#if mode === 'walkers'}
      <path class="signal" d={path(meridian(0, 0, walked / deg))} />
      <path class="signal" d={path(meridian(span, 0, walked / deg))} />
      <path class="model" d={path(meridian(0, walked / deg, 90))} />
      <path class="model" d={path(meridian(span, walked / deg, 90))} />
      <path class="ink-arrow" d={arrow(fromLatLon(0, 0), north(fromLatLon(0, 0)), 0.22)} />
      <path class="ink-arrow" d={arrow(fromLatLon(0, span), north(fromLatLon(0, span)), 0.22)} />
      <circle class="dot" cx={sx(walkerA)} cy={sy(walkerA)} r="5" />
      <circle class="dot" cx={sx(walkerB)} cy={sy(walkerB)} r="5" />
      <text
        class="halo"
        x={sx(fromLatLon(0, span / 2))}
        y={sy(fromLatLon(0, span / 2)) + 34}
        text-anchor="middle">start: parallel</text
      >
      <circle class="dot ink" cx={sx(pole)} cy={sy(pole)} r="3" />
      <text class="ink halo" x={sx(pole) + 8} y={sy(pole) - 6}>pole</text>
    {:else}
      <path class="model" d={path(loop)} />
      <path class="signal" d={path(loop.slice(0, at + 1))} />
      {#each trail as i (i)}
        <path class="trail" d={arrow(loop[i], carried[i])} />
      {/each}
      {#if done}
        <path class="ghost" d={arrow(pole, start)} />
      {/if}
      <path class="carried" d={arrow(loop[at], carried[at])} />
      <circle class="dot" cx={sx(loop[at])} cy={sy(loop[at])} r="4" />
      <text class="ink halo" x={sx(pole) + 10} y={sy(pole) - 10}>start and finish</text>
      {#if done}
        <text class="signal halo" x={sx(pole) - 14} y={sy(pole) - 10} text-anchor="end"
          >turned {turned.toFixed(0)}°</text
        >
      {/if}
    {/if}
  </svg>

  <div class="controls">
    <label class="slider">
      <span
        >{mode === 'walkers' ? 'How far apart they start' : 'Angle at the pole'}
        <b>{spanDeg}°</b></span
      >
      <input type="range" min="10" max="120" step="5" bind:value={spanDeg} />
    </label>
    <label class="slider">
      <span
        >{mode === 'walkers' ? 'How far they have walked' : 'How far round'}
        <b>{Math.round(progress * 100)}%</b></span
      >
      <input type="range" min="0" max="1" step="0.01" bind:value={progress} />
    </label>
  </div>
  <dl class="readouts">
    {#if mode === 'walkers'}
      <div>
        <dt>apart at the start</dt>
        <dd>{Math.round(startGap).toLocaleString('en-GB')} km</dd>
      </div>
      <div>
        <dt>apart now</dt>
        <dd class="signal">{Math.round(gap).toLocaleString('en-GB')} km</dd>
      </div>
      <div>
        <dt>each has turned by</dt>
        <dd>0°</dd>
      </div>
    {:else}
      <div>
        <dt>times the arrow was turned</dt>
        <dd>never</dd>
      </div>
      <div>
        <dt>back home it points away by</dt>
        <dd class="signal">{done ? `${turned.toFixed(0)}°` : '…'}</dd>
      </div>
      <div>
        <dt>area enclosed ÷ R²</dt>
        <dd>{spanDeg}°</dd>
      </div>
    {/if}
  </dl>
</div>

<style>
  .curved-surface {
    width: 100%;
  }

  .fig text.halo {
    paint-order: stroke;
    stroke: var(--ground);
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  .globe {
    fill: color-mix(in srgb, var(--noise) 8%, var(--surface));
    stroke: var(--rule);
    stroke-width: 1;
  }

  .equator {
    stroke: var(--noise);
    stroke-width: 1.2;
    fill: none;
  }

  .ink-arrow,
  .ghost {
    stroke: var(--ink-soft);
    stroke-width: 1.6;
    fill: none;
  }

  .ghost {
    stroke-dasharray: 3 3;
  }

  .trail {
    stroke: var(--signal);
    stroke-width: 1.2;
    fill: none;
    opacity: 0.45;
  }

  .carried {
    stroke: var(--signal);
    stroke-width: 2.4;
    fill: none;
    stroke-linecap: round;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.5rem;
    margin-top: 0.75rem;
  }

  .slider {
    display: grid;
    flex: 1 1 12rem;
    gap: 0.25rem;
    font-size: var(--text-sm);
    color: var(--ink-soft);
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
