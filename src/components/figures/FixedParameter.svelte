<script lang="ts">
  import { onMount } from 'svelte';
  import { gaussian, mulberry32, type Uniform } from '~/lib/stats/random';
  import { normalPdf } from '~/lib/stats/estimators';

  /**
   * Fixing a parameter is an infinitely strong prior (Run It Yourself). A made-up posterior in
   * which mass ratio and effective spin trade against each other, as they do in real events.
   * Letting the spin vary gives the honest answer for the mass ratio; fixing it gives the slice
   * through the cloud at that spin: narrower, and wherever the slice happens to fall.
   */
  const Q = { mean: 0.72, sd: 0.1 };
  const S = { mean: 0.12, sd: 0.12 };
  const RHO = -0.8;

  const uniform: Uniform = mulberry32(2019);
  const draw = gaussian(uniform);
  const samples = Array.from({ length: 900 }, () => {
    const a = draw();
    const b = draw();
    return { q: Q.mean + Q.sd * a, s: S.mean + S.sd * (RHO * a + Math.sqrt(1 - RHO * RHO) * b) };
  }).filter((p) => p.q > 0.3 && p.q <= 1 && p.s > -0.35 && p.s < 0.6);

  let fixed = $state(true);
  let spin = $state(0);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  // The slice of a two-dimensional Gaussian at a fixed spin is another Gaussian.
  const slice = $derived({
    mean: Q.mean + RHO * (Q.sd / S.sd) * (spin - S.mean),
    sd: Q.sd * Math.sqrt(1 - RHO * RHO),
  });
  const shown = $derived(fixed ? slice : Q);
  const shift = $derived((slice.mean - Q.mean) / Q.sd);

  let width = $state(600);
  const H = 360;
  const PAD = { l: 44, r: 14 };
  const TOP = { y0: 34, y1: 210 };
  const BOT = { y0: 236, y1: 316 };
  const x = (q: number) => PAD.l + ((q - 0.3) / 0.7) * (width - PAD.l - PAD.r);
  const sy = (s: number) => TOP.y1 - ((s + 0.35) / 0.95) * (TOP.y1 - TOP.y0);
  const peak = normalPdf(0, 0, Q.sd * Math.sqrt(1 - RHO * RHO));
  const dy = (p: number) => BOT.y1 - (p / peak) * (BOT.y1 - BOT.y0);
  const grid = Array.from({ length: 141 }, (_, i) => 0.3 + (0.7 * i) / 140);
  const curve = (m: number, sd: number) =>
    grid
      .map((q, i) => `${i ? 'L' : 'M'}${x(q).toFixed(1)},${dy(normalPdf(q, m, sd)).toFixed(1)}`)
      .join('');
  const interval = (g: { mean: number; sd: number }) =>
    `${(g.mean - 1.645 * g.sd).toFixed(2)} to ${(g.mean + 1.645 * g.sd).toFixed(2)}`;
</script>

<div
  class="fixed-parameter"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-fixed={fixed}
  data-spin={spin.toFixed(2)}
  data-shift={shift.toFixed(2)}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={fixed
      ? `With the spin fixed at ${spin.toFixed(2)}, the mass ratio comes out between ${interval(slice)}, narrower than the honest ${interval(Q)} and shifted by ${Math.abs(shift).toFixed(1)} of its width.`
      : `With the spin free, the mass ratio comes out between ${interval(Q)}.`}
  >
    <text class="caps" x={PAD.l} y="16">posterior: mass ratio against spin</text>
    {#each samples as p, i (i)}
      <circle class="sample" cx={x(p.q)} cy={sy(p.s)} r="1.8" />
    {/each}
    {#if fixed}
      <line class="slice" x1={PAD.l} x2={width - PAD.r} y1={sy(spin)} y2={sy(spin)} />
      <text class="bias halo" x={width - PAD.r} y={sy(spin) - 6} text-anchor="end"
        >spin fixed at {spin.toFixed(2)}</text
      >
    {/if}
    {#each [-0.2, 0, 0.2, 0.4] as s (s)}
      <text x={PAD.l - 8} y={sy(s)} dy="4" text-anchor="end">{s.toFixed(1)}</text>
    {/each}
    <text x={PAD.l - 8} y={TOP.y0 - 6} text-anchor="end">spin</text>

    <path class="signal" d={curve(Q.mean, Q.sd)} />
    {#if fixed}
      <path class="fixed" d={curve(slice.mean, slice.sd)} />
    {/if}
    <text
      class="signal halo"
      x={x(Q.mean - 1.5 * Q.sd)}
      y={dy(normalPdf(Q.mean - 1.5 * Q.sd, Q.mean, Q.sd)) - 6}>spin free</text
    >
    <line class="axis" x1={PAD.l} x2={width - PAD.r} y1={BOT.y1} y2={BOT.y1} />
    {#each [0.4, 0.6, 0.8, 1] as q (q)}
      <text x={x(q)} y={BOT.y1 + 16} text-anchor="middle">{q.toFixed(1)}</text>
    {/each}
    <text x={width - PAD.r} y={H - 8} text-anchor="end">mass ratio</text>
  </svg>

  <div class="controls">
    <label class="toggle">
      <input type="checkbox" bind:checked={fixed} />
      Fix the spin, as the tutorial does
    </label>
    <label class="slider">
      <span>Fix it at <b>{spin.toFixed(2)}</b></span>
      <input type="range" min="-0.3" max="0.45" step="0.01" bind:value={spin} disabled={!fixed} />
    </label>
  </div>
  <dl class="readouts">
    <div>
      <dt>mass ratio, spin free (90%)</dt>
      <dd>{interval(Q)}</dd>
    </div>
    <div>
      <dt>mass ratio, as reported (90%)</dt>
      <dd class:bad={fixed}>{interval(shown)}</dd>
    </div>
    <div>
      <dt>moved by</dt>
      <dd class:bad={fixed && Math.abs(shift) >= 0.5}>
        {fixed ? `${Math.abs(shift).toFixed(1)} widths` : 'nothing'}
      </dd>
    </div>
  </dl>
</div>

<style>
  .fixed-parameter {
    width: 100%;
  }

  /* A halo in the page colour keeps a label legible where the cloud or a curve crosses it. */
  .fig text.halo {
    paint-order: stroke;
    stroke: var(--ground);
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  .sample {
    fill: var(--signal);
    opacity: 0.35;
  }

  .slice {
    stroke: var(--bias);
    stroke-width: 2;
    stroke-dasharray: 6 4;
  }

  .fixed {
    fill: none;
    stroke: var(--bias);
    stroke-width: 2;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.5rem;
    align-items: center;
    margin-top: 0.75rem;
  }

  .toggle {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    font-size: var(--text-sm);
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

  .readouts dd.bad {
    color: var(--bias);
  }
</style>
