<script lang="ts">
  import { onMount } from 'svelte';
  import { scientific } from '~/lib/format';
  import {
    ARCSEC,
    GM_SUN,
    MERCURY,
    R_SUN,
    advancePerCentury,
    orbitAdvance,
    schwarzschildOrbit,
    schwarzschildRadius,
  } from '~/lib/physics/relativity';

  /**
   * An orbit that does not close (The Straightest Path). Mercury's orbit with its real
   * eccentricity, moved closer and closer to a mass of the Sun's: the orbit equation of a
   * Schwarzschild geodesic, stepped exactly, with no exaggeration. At Mercury's distance the
   * ellipse creeps by 43″ a century; a few tens of Schwarzschild radii out, it is a rosette.
   */
  const RS = schwarzschildRadius(GM_SUN);
  const P_MERCURY = (MERCURY.a * (1 - MERCURY.e ** 2)) / RS;
  const P_CLOSE = 12;
  const E = MERCURY.e;
  const TURNS = 6;

  // The slider runs from Mercury's orbit (0) to 12 Schwarzschild radii (1), evenly in log p.
  let closer = $state(0.965);
  let width = $state(600);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  const p = $derived(P_MERCURY * (P_CLOSE / P_MERCURY) ** closer);
  const shift = $derived(orbitAdvance(p, E));
  const firstOrder = $derived((3 * Math.PI) / p);
  const orbit = $derived(schwarzschildOrbit(p, E, TURNS, 360));
  const insideSun = $derived((p / (1 + E)) * RS < R_SUN);

  const H = $derived(Math.min(420, Math.max(300, width * 0.62)));
  const cx = $derived(width / 2);
  const cy = $derived(H / 2 + 8);
  const scale = $derived((H / 2 - 24) / Math.max(...orbit.r));
  const path = $derived(
    Array.from(orbit.r, (r, i) => {
      const f = orbit.phi[i];
      return `${i ? 'L' : 'M'}${(cx + r * scale * Math.cos(f)).toFixed(1)},${(cy - r * scale * Math.sin(f)).toFixed(1)}`;
    }).join(''),
  );
  // Perihelia: one per orbit, each `shift` further round than the last.
  const perihelia = $derived(
    Array.from({ length: TURNS }, (_, k) => {
      const f = k * (2 * Math.PI + shift);
      const r = p / (1 + E);
      return { x: cx + r * scale * Math.cos(f), y: cy - r * scale * Math.sin(f) };
    }).filter((_, k) => k * (2 * Math.PI + shift) <= 2 * Math.PI * TURNS),
  );

  function angle(rad: number): string {
    const d = rad / (Math.PI / 180);
    if (d >= 0.1) return `${d.toFixed(d >= 10 ? 0 : 1)}°`;
    const s = rad / ARCSEC;
    if (s >= 1) return `${s.toFixed(s >= 100 ? 0 : 1)}″`;
    return `${s.toPrecision(2)}″`;
  }
  const size = (v: number) => (v < 1e4 ? v.toFixed(0) : scientific(v, 1));
</script>

<div
  class="mercury-orbit"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-p={p.toPrecision(3)}
  data-shift={(shift / (Math.PI / 180)).toPrecision(3)}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`An orbit with Mercury's eccentricity, ${size(p)} Schwarzschild radii across its semi-latus rectum, traced for six turns. Its closest point moves round by ${angle(shift)} each orbit.`}
  >
    <text class="caps" x="12" y="14">six orbits, traced exactly</text>
    <path class="orbit" d={path} />
    {#each perihelia as q, i (i)}
      <line class="spoke" x1={cx} y1={cy} x2={q.x} y2={q.y} />
      <circle class="dot" cx={q.x} cy={q.y} r="4" />
    {/each}
    <circle class="mass" {cx} {cy} r="6" />
    <text class="ink halo" x={cx} y={cy + 22} text-anchor="middle">
      {insideSun ? 'one solar mass' : 'the Sun'}
    </text>
    {#if perihelia.length > 1}
      <text
        class="signal halo"
        x={perihelia[1].x + (perihelia[1].x > cx ? -12 : 12)}
        y={perihelia[1].y + (perihelia[1].y > cy ? -12 : 20)}
        text-anchor={perihelia[1].x > cx ? 'end' : 'start'}>closest point, a turn later</text
      >
    {/if}
  </svg>

  <div class="controls">
    <label class="slider">
      <span
        >Move the orbit in: <b>{size(p)}</b> Schwarzschild radii{closer < 0.005
          ? ' (Mercury)'
          : ''}</span
      >
      <input type="range" min="0" max="1" step="0.005" bind:value={closer} />
    </label>
  </div>
  <dl class="readouts">
    <div>
      <dt>closest point moves, per orbit</dt>
      <dd class="signal">{angle(shift)}</dd>
    </div>
    <div>
      <dt>first-order formula, 6πGM / c²p</dt>
      <dd>{angle(firstOrder)}</dd>
    </div>
    <div>
      <dt>Mercury, per century</dt>
      <dd>{advancePerCentury(GM_SUN, MERCURY).toFixed(0)}″</dd>
    </div>
  </dl>
</div>

<style>
  .mercury-orbit {
    width: 100%;
  }

  .fig text.halo {
    paint-order: stroke;
    stroke: var(--ground);
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  .orbit {
    fill: none;
    stroke: var(--signal);
    stroke-width: 1.4;
    opacity: 0.85;
  }

  .spoke {
    stroke: var(--rule);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }

  .mass {
    fill: var(--ink);
  }

  .slider {
    display: grid;
    flex: 1 1 14rem;
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
