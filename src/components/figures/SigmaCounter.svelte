<script lang="ts">
  import { scaleLinear } from 'd3-scale';
  import { onMount } from 'svelte';
  import { effectiveSampleSize } from '~/lib/stats/autocorr';
  import { gaussian, mulberry32 } from '~/lib/stats/random';

  /**
   * How Sure Is Sure?: the same 2000 numbers, read as independent or as what they are. Each
   * number remembers the one before it (an AR(1) chain with memory φ, unit spread). Counting
   * every number as independent gives an error bar on their mean of 1/√N; counting only the
   * effective number of independent samples (stats/autocorr.ts, checked against emcee) gives
   * the honest one. The ratio is how much a naive "nσ" overstates.
   */
  const N = 2000;
  let phi = $state(0.9);
  let width = $state(640);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  const chain = $derived.by(() => {
    const g = gaussian(mulberry32(42));
    const out = new Float64Array(N);
    const innovation = Math.sqrt(1 - phi * phi);
    out[0] = g();
    for (let i = 1; i < N; i++) out[i] = phi * out[i - 1] + innovation * g();
    return out;
  });
  const ess = $derived(effectiveSampleSize(chain));
  const naive = $derived(1 / Math.sqrt(N));
  const honest = $derived(1 / Math.sqrt(ess));
  const ratio = $derived(honest / naive);

  const H = 150;
  const x = $derived(
    scaleLinear()
      .domain([0, N])
      .range([10, width - 10]),
  );
  const y = scaleLinear()
    .domain([-3.5, 3.5])
    .range([H - 10, 10]);
  const path = $derived(
    Array.from(chain, (v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(''),
  );
</script>

<div
  class="sigma"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-ess={Math.round(ess)}
  data-ratio={ratio.toFixed(1)}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`${N} samples with memory ${phi.toFixed(2)}: worth about ${Math.round(ess)} independent ones.`}
  >
    <line class="axis" x1="10" x2={width - 10} y1={y(0)} y2={y(0)} />
    <path class="chain" d={path} />
  </svg>
  <label class="slider">
    <span>How much each sample remembers the one before: <b>{phi.toFixed(2)}</b></span>
    <input type="range" min="0" max="0.99" step="0.01" bind:value={phi} />
  </label>
  <dl class="numbers">
    <div>
      <dt>samples</dt>
      <dd>{N}</dd>
    </div>
    <div>
      <dt>worth, independently</dt>
      <dd>{Math.round(ess)}</dd>
    </div>
    <div>
      <dt>error bar if all counted</dt>
      <dd>±{naive.toFixed(3)}</dd>
    </div>
    <div>
      <dt>honest error bar</dt>
      <dd>±{honest.toFixed(3)}</dd>
    </div>
    <div>
      <dt>a naive count of sigmas is too large by</dt>
      <dd class:bad={ratio > 1.5}>× {ratio.toFixed(1)}</dd>
    </div>
  </dl>
</div>

<style>
  .sigma {
    width: 100%;
  }

  .axis {
    stroke: var(--rule);
  }

  .chain {
    fill: none;
    stroke: var(--signal);
    stroke-width: 0.8;
  }

  .slider {
    display: grid;
    gap: 0.25rem;
    margin-top: 0.6rem;
    font-size: 0.9rem;
    color: var(--ink-soft);
  }

  b {
    color: var(--ink);
  }

  input[type='range'] {
    width: 100%;
    accent-color: var(--ink);
  }

  .numbers {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.5rem 1.2rem;
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

  .numbers dd.bad {
    padding-left: 0.4rem;
    border-left: 3px solid var(--bias);
  }
</style>
