<script lang="ts">
  import { onMount } from 'svelte';
  import type { Fit } from '~/lib/articles/wrong';

  /**
   * Watch the answer move (What the Wrong Model Knows): the same ring, fitted from a start
   * time the reader chooses, by a template with one tone or with both. Every fit is computed
   * at build time; the island only chooses which one to draw.
   */
  interface Point {
    start: number;
    one: Fit;
    two: Fit;
    curveOne: number[];
    curveTwo: number[];
  }
  let { t, data, points, truth }: { t: number[]; data: number[]; points: Point[]; truth: number } =
    $props();

  let index = $state(0);
  // Set once the island has hydrated, so tests act on a live figure.
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });
  let both = $state(false);
  const point = $derived(points[index]);
  const fit = $derived(both ? point.two : point.one);
  const curve = $derived(both ? point.curveTwo : point.curveOne);
  const every = $derived(Math.round(t.length / curve.length));

  let width = $state(640);
  const H = 420;
  const PAD = 14;
  const TOP = { y0: 34, y1: 170 };
  const BOT = { y0: 236, y1: 386 };
  const tMax = $derived(t[t.length - 1] * 1e3);
  const x = (ms: number) => PAD + (ms / tMax) * (width - 2 * PAD);
  const peak = $derived(Math.max(...data.map(Math.abs)));
  const mid = (TOP.y0 + TOP.y1) / 2;
  const y = (v: number) => mid - (v / peak) * ((TOP.y1 - TOP.y0) / 2);

  // The answer panel: start time across, answer up, 57..70.
  const sMax = $derived(points[points.length - 1].start * 1e3);
  const ax = (ms: number) => PAD + (ms / sMax) * (width - 2 * PAD);
  const A0 = 58;
  const A1 = 70;
  const ay = (v: number) =>
    BOT.y1 - ((Math.min(A1, Math.max(A0, v)) - A0) / (A1 - A0)) * (BOT.y1 - BOT.y0);

  const dataPath = $derived(
    data.map((v, i) => `${i ? 'L' : 'M'}${x(t[i] * 1e3).toFixed(1)},${y(v).toFixed(1)}`).join(''),
  );
  const curvePath = $derived.by(() => {
    let d = '';
    let pen = false;
    curve.forEach((v, j) => {
      if (!Number.isFinite(v)) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(t[j * every] * 1e3).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  });
  const startMs = $derived(point.start * 1e3);
  const offText = $derived(
    Math.abs(fit.off) < 2 ? 'within its error bars' : `off by ${Math.abs(fit.off).toFixed(1)}σ`,
  );
</script>

<div
  class="ring-lab"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-start={startMs.toFixed(2)}
  data-answer={fit.answer.toFixed(2)}
  data-off={Math.abs(fit.off).toFixed(1)}
  data-chi={fit.chi2dof.toFixed(2)}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`The ring and a ${both ? 'two-tone' : 'one-tone'} template fitted from ${startMs.toFixed(2)} milliseconds. It returns ${fit.answer.toFixed(2)} against a true value of ${truth}, ${offText}, with a goodness of fit of ${fit.chi2dof.toFixed(2)} per degree of freedom.`}
  >
    <text class="caps" x={PAD} y="16">the ring, and the fit from where you start it</text>
    <rect class="excluded" x={x(0)} y={TOP.y0} width={x(startMs) - x(0)} height={TOP.y1 - TOP.y0} />
    <path class="data-line" d={dataPath} />
    <path class="fit-line" d={curvePath} />
    <line class="start" x1={x(startMs)} x2={x(startMs)} y1={TOP.y0} y2={TOP.y1 + 8} />
    <text
      x={Math.min(Math.max(x(startMs), PAD + 50), width - PAD - 50)}
      y={TOP.y1 + 22}
      text-anchor="middle">start {startMs.toFixed(2)} ms</text
    >

    <text class="caps" x={PAD} y={BOT.y0 - 18}>the answer, for every start time</text>
    {#each [60, 65, 70] as v (v)}
      <line class="grid" x1={PAD} x2={width - PAD} y1={ay(v)} y2={ay(v)} />
      <text x={width - PAD} y={ay(v) - 4} text-anchor="end">{v}</text>
    {/each}
    <line class="truth" x1={PAD} x2={width - PAD} y1={ay(truth)} y2={ay(truth)} />
    <text class="ok" x={PAD} y={ay(truth) + 16}>the truth, {truth}, never changes</text>
    {#each points as p, i (i)}
      {@const f = both ? p.two : p.one}
      <line
        class="bar"
        x1={ax(p.start * 1e3)}
        x2={ax(p.start * 1e3)}
        y1={ay(f.answer - f.error)}
        y2={ay(f.answer + f.error)}
      />
      <circle
        class="answer"
        class:current={i === index}
        cx={ax(p.start * 1e3)}
        cy={ay(f.answer)}
        r={i === index ? 5 : 3}
      />
    {/each}
    <text x={width - PAD} y={H - 6} text-anchor="end">start of the fit (ms after the peak)</text>
  </svg>

  <div class="controls">
    <label class="slider">
      <span>Start the fit at <b>{startMs.toFixed(2)} ms</b></span>
      <input
        type="range"
        min="0"
        max={points.length - 1}
        step="1"
        bind:value={index}
        aria-valuetext={`${startMs.toFixed(2)} milliseconds`}
      />
    </label>
    <label class="toggle">
      <input type="checkbox" bind:checked={both} />
      Give the template the second tone
    </label>
  </div>
  <dl class="readouts">
    <div>
      <dt>answer</dt>
      <dd>{fit.answer.toFixed(2)} ± {fit.error.toFixed(2)}</dd>
    </div>
    <div>
      <dt>true answer</dt>
      <dd>{truth}</dd>
    </div>
    <div>
      <dt>distance from the truth</dt>
      <dd class:bad={Math.abs(fit.off) >= 3}>{offText}</dd>
    </div>
    <div>
      <dt>goodness of fit (χ²/dof)</dt>
      <dd>{fit.chi2dof.toFixed(2)}</dd>
    </div>
  </dl>
</div>

<style>
  .ring-lab {
    width: 100%;
  }

  .excluded {
    fill: var(--rule-soft);
    opacity: 0.7;
  }

  .data-line {
    fill: none;
    stroke: var(--ink-faint);
    stroke-width: 1;
  }

  .fit-line {
    fill: none;
    stroke: var(--model);
    stroke-width: 2;
    stroke-dasharray: 6 4;
  }

  .start {
    stroke: var(--ink);
    stroke-width: 1;
  }

  .truth {
    stroke: var(--ok);
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
  }

  .bar {
    stroke: var(--ink-faint);
    stroke-width: 1;
  }

  .answer {
    fill: var(--signal);
  }

  .answer.current {
    stroke: var(--ink);
    stroke-width: 1.5;
  }

  .slider {
    display: grid;
    flex: 1 1 16rem;
    gap: 0.25rem;
    font-size: var(--text-sm);
    color: var(--ink-soft);
  }

  .toggle {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    font-size: var(--text-sm);
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
