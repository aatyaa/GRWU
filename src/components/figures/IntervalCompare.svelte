<script lang="ts">
  import { bin } from 'd3-array';
  import { scaleLinear } from 'd3-scale';
  import { onMount } from 'svelte';
  import { equalTailed, hdi, quantile } from '~/lib/stats/intervals';
  import { mulberry32 } from '~/lib/stats/random';

  /**
   * How Sure Is Sure?: one posterior, as 4000 samples, summarised two ways. The equal-tailed
   * 90% interval cuts 5% off each side; the highest-density interval is the shortest range
   * holding 90%. For a symmetric posterior they agree; the more lopsided it is, the more they
   * differ. Samples are sums of k exponentials (a Gamma(k) posterior, skewness 2/√k), drawn
   * from a seeded generator; intervals from stats/intervals.ts, checked against numpy.
   */
  const SHAPES = [1, 2, 4, 16];
  const N = 4000;

  let shape = $state(2);
  let width = $state(640);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  const samples = $derived.by(() => {
    const u = mulberry32(2025);
    return Array.from({ length: N }, () => {
      let sum = 0;
      for (let i = 0; i < shape; i++) sum -= Math.log(1 - u());
      return sum / shape; // mean 1 for every shape
    });
  });
  const et = $derived(equalTailed(samples, 0.9));
  const hd = $derived(hdi(samples, 0.9));
  const med = $derived(quantile(samples, 0.5));

  const H = 250;
  const PAD = { l: 14, r: 14, t: 12, b: 86 };
  const x = $derived(
    scaleLinear()
      .domain([0, 3])
      .range([PAD.l, width - PAD.r]),
  );
  const bins = $derived(bin().domain([0, 3]).thresholds(60)(samples.filter((v) => v <= 3)));
  const top = $derived(Math.max(...bins.map((b) => b.length)));
  const y = $derived(
    scaleLinear()
      .domain([0, top])
      .range([H - PAD.b, PAD.t]),
  );
  const yET = H - PAD.b + 26;
  const yHD = H - PAD.b + 52;
  const f2 = (v: number) => v.toFixed(2);
</script>

<div
  class="intervals"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-shape={shape}
  data-et-width={f2(et[1] - et[0])}
  data-hdi-width={f2(hd[1] - hd[0])}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`A posterior of ${N} samples. Equal-tailed 90% interval ${f2(et[0])} to ${f2(et[1])}; highest-density 90% interval ${f2(hd[0])} to ${f2(hd[1])}.`}
  >
    {#each bins as b, i (i)}
      <rect
        class="bar"
        x={x(b.x0 ?? 0) + 0.5}
        y={y(b.length)}
        width={Math.max(0, x(b.x1 ?? 0) - x(b.x0 ?? 0) - 1)}
        height={y(0) - y(b.length)}
      />
    {/each}
    <line class="median" x1={x(med)} x2={x(med)} y1={PAD.t} y2={H - PAD.b} />
    <line class="axis" x1={PAD.l} x2={width - PAD.r} y1={H - PAD.b} y2={H - PAD.b} />

    <line class="et" x1={x(et[0])} x2={x(et[1])} y1={yET} y2={yET} />
    <text class="lab" x={x(et[0])} y={yET - 7}>equal-tailed: {f2(et[0])} to {f2(et[1])}</text>
    <line class="hd" x1={x(hd[0])} x2={x(hd[1])} y1={yHD} y2={yHD} />
    <text class="lab" x={x(hd[0])} y={yHD - 7}>highest density: {f2(hd[0])} to {f2(hd[1])}</text>
  </svg>

  <fieldset class="controls">
    <legend>How lopsided the posterior is</legend>
    {#each SHAPES as k (k)}
      <label>
        <input type="radio" name="interval-shape" value={k} bind:group={shape} />
        {k === 1 ? 'very' : k === 2 ? 'clearly' : k === 4 ? 'a little' : 'hardly'}
      </label>
    {/each}
  </fieldset>
  <p class="figure-note">
    Widths: equal-tailed <b>{f2(et[1] - et[0])}</b>, highest density <b>{f2(hd[1] - hd[0])}</b>. The
    dotted line is the median, {f2(med)}.
  </p>
</div>

<style>
  .intervals {
    width: 100%;
  }

  .bar {
    fill: var(--signal);
    opacity: 0.75;
  }

  .axis {
    stroke: var(--rule);
  }

  .median {
    stroke: var(--ink);
    stroke-dasharray: 2 3;
  }

  .et,
  .hd {
    stroke: var(--ink);
    stroke-width: 3;
    stroke-linecap: round;
  }

  .et {
    stroke-dasharray: 7 4;
  }

  .lab {
    font-size: 11px;
    fill: var(--ink-soft);
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1rem;
    margin: 0.5rem 0 0;
    padding: 0;
    border: 0;
    font-size: 0.9rem;
    color: var(--ink);
  }

  legend {
    float: left;
    margin-right: 0.5rem;
    color: var(--ink-soft);
  }

  .controls label {
    display: inline-flex;
    gap: 0.3rem;
    align-items: center;
  }

  input {
    accent-color: var(--ink);
  }

  .figure-note {
    margin: 0.5rem 0 0;
    font-size: 0.9rem;
    color: var(--ink-soft);
  }

  b {
    color: var(--ink);
  }
</style>
