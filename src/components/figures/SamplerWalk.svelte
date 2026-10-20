<script lang="ts">
  import { scaleLinear } from 'd3-scale';
  import { onMount } from 'svelte';
  import { effectiveSampleSize } from '~/lib/stats/autocorr';
  import { metropolis } from '~/lib/stats/mcmc';

  /**
   * How Sure Is Sure?: a random-walk Metropolis sampler (stats/mcmc.ts) exploring a posterior
   * whose two parameters are strongly correlated, as a ringdown's mass and spin are. The reader
   * sets the step size and the number of steps; the figure shows the path, the rejected
   * proposals, the acceptance rate and how many independent samples the walk is worth
   * (stats/autocorr.ts, checked against emcee). The walk is seeded, so it is the same each time.
   */
  const RHO = 0.9;
  const START = [-3.2, 2.6];
  const logDensity = ([a, b]: readonly number[]) =>
    -(a * a - 2 * RHO * a * b + b * b) / (2 * (1 - RHO * RHO));

  let stepSize = $state(0.4);
  let steps = $state(400);
  let width = $state(520);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  const walk = $derived(metropolis(logDensity, START, { steps, stepSize, seed: 11 }));
  const acceptance = $derived(walk.accepted.filter(Boolean).length / steps);
  const ess = $derived(steps >= 20 ? effectiveSampleSize(walk.points.map((p) => p[0])) : 0);

  const size = $derived(Math.min(width, 400));
  const s = $derived(
    scaleLinear()
      .domain([-4, 4])
      .range([16, size - 16]),
  );
  const sy = $derived(
    scaleLinear()
      .domain([-4, 4])
      .range([size - 16, 16]),
  );
  // Contours of the target: 1 and 2 standard deviations, through its Cholesky factor.
  const contour = (r: number) =>
    Array.from({ length: 121 }, (_, i) => {
      const t = (i / 120) * 2 * Math.PI;
      const u = r * Math.cos(t);
      const v = r * Math.sin(t);
      const a = u;
      const b = RHO * u + Math.sqrt(1 - RHO * RHO) * v;
      return `${i ? 'L' : 'M'}${s(a).toFixed(1)},${sy(b).toFixed(1)}`;
    }).join('');
  const path = $derived(
    walk.points
      .map((p, i) => `${i ? 'L' : 'M'}${s(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`)
      .join(''),
  );
  const rejected = $derived(walk.proposals.filter((_, i) => !walk.accepted[i]));
</script>

<div
  class="sampler"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-acceptance={acceptance.toFixed(2)}
  data-ess={Math.round(ess)}
>
  <svg
    class="fig"
    viewBox="0 0 {size} {size}"
    width={size}
    height={size}
    role="img"
    aria-label={`A Metropolis walk of ${steps} steps with step size ${stepSize}: ${Math.round(acceptance * 100)}% of proposals accepted, worth about ${Math.round(ess)} independent samples.`}
  >
    <path class="contour" d={contour(1)} />
    <path class="contour" d={contour(2)} />
    {#each rejected as p, i (i)}
      <circle class="rejected" cx={s(p[0])} cy={sy(p[1])} r="1.8" />
    {/each}
    <path class="path" d={path} />
    <circle class="start" cx={s(START[0])} cy={sy(START[1])} r="5" />
    <circle class="here" cx={s(walk.points[steps][0])} cy={sy(walk.points[steps][1])} r="5" />
  </svg>
  <ul class="key">
    <li><i class="k-contour"></i>the posterior (1σ and 2σ)</li>
    <li><i class="k-path"></i>the walk</li>
    <li><i class="k-rejected"></i>rejected proposals</li>
  </ul>
  <div class="sliders">
    <label>
      <span>Step size <b>{stepSize.toFixed(2)}</b></span>
      <input type="range" min="0.05" max="3" step="0.05" bind:value={stepSize} />
    </label>
    <label>
      <span>Number of steps <b>{steps}</b></span>
      <input type="range" min="20" max="3000" step="20" bind:value={steps} />
    </label>
  </div>
  <dl class="numbers">
    <div>
      <dt>proposals accepted</dt>
      <dd>{Math.round(acceptance * 100)}%</dd>
    </div>
    <div>
      <dt>samples drawn</dt>
      <dd>{steps}</dd>
    </div>
    <div>
      <dt>worth, independently</dt>
      <dd>about {Math.round(ess)}</dd>
    </div>
  </dl>
</div>

<style>
  .sampler {
    width: 100%;
  }

  svg {
    display: block;
    margin: 0 auto;
  }

  .contour {
    fill: none;
    stroke: var(--model);
    stroke-width: 1.3;
    stroke-dasharray: 5 4;
  }

  .rejected {
    fill: var(--bias);
    opacity: 0.45;
  }

  .path {
    fill: none;
    stroke: var(--signal);
    stroke-width: 1.1;
    stroke-opacity: 0.8;
  }

  .start {
    fill: var(--surface);
    stroke: var(--ink);
    stroke-width: 1.5;
  }

  .here {
    fill: var(--signal);
    stroke: var(--surface);
    stroke-width: 1.5;
  }

  .key {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.3rem 1.2rem;
    margin: 0.4rem 0 0;
    padding: 0;
    list-style: none;
    font-size: 0.85rem;
    color: var(--ink-soft);
  }

  .key li {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }

  .key i {
    display: block;
    width: 16px;
    height: 3px;
    border-radius: 2px;
  }

  .k-contour {
    background: repeating-linear-gradient(90deg, var(--model) 0 5px, transparent 5px 8px);
  }

  .k-path {
    background: var(--signal);
  }

  .k-rejected {
    width: 6px !important;
    height: 6px !important;
    border-radius: 50% !important;
    background: var(--bias);
  }

  .sliders {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: 0.6rem 1.2rem;
    margin-top: 0.7rem;
    font-size: 0.9rem;
    color: var(--ink-soft);
  }

  .sliders label {
    display: grid;
    gap: 0.25rem;
  }

  b {
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
    margin: 0.8rem 0 0;
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
