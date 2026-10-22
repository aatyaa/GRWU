<script lang="ts">
  import { onMount } from 'svelte';
  import { reducedMotion } from '~/lib/state';
  import { ringPoint, type Polarisation } from '~/lib/physics/waves';

  /**
   * A ring of free particles as a gravitational wave passes through the page (Only Ever
   * Forwards), in its two polarisations: plus stretches one way while squeezing the other, cross
   * does the same along the diagonals, 45° round. The stretch is exaggerated about 10²⁰ times.
   * The reader moves through one cycle of the wave, or plays it.
   */
  const H_SHOWN = 0.4;
  const N = 24;
  const POLS: { id: Polarisation; label: string }[] = [
    { id: 'plus', label: 'plus, h₊' },
    { id: 'cross', label: 'cross, h×' },
  ];

  let degrees = $state(0);
  let playing = $state(false);
  let reduce = $state(false);
  let width = $state(600);
  let hydrated = $state(false);
  let frame = 0;
  onMount(() => {
    hydrated = true;
    const unsubscribe = reducedMotion.subscribe((v) => {
      reduce = v;
      if (v) playing = false;
    });
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
    };
  });

  function toggle() {
    playing = !playing;
    if (!playing) return;
    let last = performance.now();
    const step = (now: number) => {
      if (!playing) return;
      // One cycle every three seconds.
      degrees = (degrees + ((now - last) / 3000) * 360) % 360;
      last = now;
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  }

  const phase = $derived((degrees * Math.PI) / 180);
  const H = $derived(Math.min(260, Math.max(200, width * 0.42)));
  const R = $derived(Math.min(H * 0.3, width * 0.16));
  const centres = $derived([width * 0.27, width * 0.73]);
  const points = (pol: Polarisation) =>
    Array.from({ length: N }, (_, i) => {
      const a = (2 * Math.PI * i) / N;
      return ringPoint(Math.cos(a), Math.sin(a), H_SHOWN, pol, phase);
    });
  // Width over height of the plus ring: above 1 it is stretched across the page.
  const plusRatio = $derived(
    (1 + (H_SHOWN / 2) * Math.cos(phase)) / (1 - (H_SHOWN / 2) * Math.cos(phase)),
  );
</script>

<div
  class="polarisation"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-phase={Math.round(degrees)}
  data-plus-ratio={plusRatio.toFixed(3)}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`Two rings of free particles at ${Math.round(degrees)} degrees through one cycle of a gravitational wave travelling into the page. In the plus polarisation the ring is ${plusRatio > 1.001 ? 'stretched across and squeezed top to bottom' : plusRatio < 0.999 ? 'squeezed across and stretched top to bottom' : 'round'}; in the cross polarisation the same happens along the diagonals.`}
  >
    <text class="caps" x="12" y="16">free particles, the wave going into the page</text>
    {#each POLS as pol, j (pol.id)}
      {@const cx = centres[j]}
      {@const cy = H / 2 + 6}
      <circle class="rest" {cx} {cy} r={R} />
      <line class="grid" x1={cx - R * 1.35} x2={cx + R * 1.35} y1={cy} y2={cy} />
      <line class="grid" x1={cx} x2={cx} y1={cy - R * 1.35} y2={cy + R * 1.35} />
      {#each points(pol.id) as p, i (i)}
        <circle class="particle" cx={cx + p.x * R} cy={cy - p.y * R} r="3.4" />
      {/each}
      <text class="ink" x={cx} y={H - 8} text-anchor="middle">{pol.label}</text>
    {/each}
  </svg>

  <div class="controls">
    <label class="slider">
      <span>Moment in the wave's cycle <b>{Math.round(degrees)}°</b></span>
      <input type="range" min="0" max="360" step="5" bind:value={degrees} />
    </label>
    {#if !reduce}
      <button type="button" class="play" onclick={toggle} aria-pressed={playing}
        >{playing ? 'Pause' : 'Play the wave'}</button
      >
    {/if}
  </div>
</div>

<style>
  .polarisation {
    width: 100%;
  }

  .rest {
    fill: none;
    stroke: var(--model);
    stroke-width: 1.2;
    stroke-dasharray: 4 4;
  }

  .particle {
    fill: var(--ink);
  }

  .slider {
    display: grid;
    flex: 1 1 14rem;
    gap: 0.25rem;
  }

  .play {
    padding: 0.4rem 0.9rem;
    border: 1px solid var(--rule);
    border-radius: 999px;
    background: var(--surface);
    font: inherit;
    color: var(--ink);
    cursor: pointer;
  }

  .play:hover,
  .play:focus-visible {
    border-color: var(--signal);
  }
</style>
