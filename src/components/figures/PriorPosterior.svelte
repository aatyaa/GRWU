<script lang="ts">
  import { onMount } from 'svelte';

  /**
   * Likelihood is not posterior (Almost None of It Is About Gravitational Waves). The same
   * measurement under four priors, with one measurement's worth of data or ten.
   */
  const N = 400;
  const LO = 0;
  const HI = 10;
  const theta = Array.from({ length: N }, (_, i) => LO + ((i + 0.5) * (HI - LO)) / N);
  const MEASURED = 6.2;

  const priors = {
    flat: { label: 'Flat: no preference', at: () => 1 },
    hunch: { label: 'A hunch: near 4', at: (x: number) => Math.exp(-0.5 * ((x - 4) / 1) ** 2) },
    bound: { label: 'Physics: never above 7', at: (x: number) => (x <= 7 ? 1 : 0) },
    fixed: { label: 'Fixed at 4', at: (x: number) => (Math.abs(x - 4) < (HI - LO) / N ? 1 : 0) },
  } as const;
  type PriorId = keyof typeof priors;

  let prior = $state<PriorId>('flat');
  let more = $state(false);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  const sigma = $derived(more ? 1 / Math.sqrt(10) : 1);
  const like = $derived(theta.map((x) => Math.exp(-0.5 * ((x - MEASURED) / sigma) ** 2)));
  const pri = $derived(theta.map((x) => priors[prior].at(x)));
  const post = $derived.by(() => {
    const p = like.map((l, i) => l * pri[i]);
    const s = p.reduce((a, b) => a + b, 0) || 1;
    return p.map((v) => v / s);
  });
  const quantile = (q: number) => {
    let c = 0;
    for (let i = 0; i < N; i++) {
      c += post[i];
      if (c >= q) return theta[i];
    }
    return theta[N - 1];
  };
  const median = $derived(quantile(0.5));
  const lo = $derived(quantile(0.05));
  const hi = $derived(quantile(0.95));

  let width = $state(600);
  const H = 220;
  const PAD = 14;
  const BASE = 180;
  const x = (v: number) => PAD + ((v - LO) / (HI - LO)) * (width - 2 * PAD);
  const curve = (values: number[], top = 130) => {
    const max = Math.max(...values) || 1;
    return values
      .map(
        (v, i) =>
          `${i ? 'L' : 'M'}${x(theta[i]).toFixed(1)},${(BASE - (v / max) * top).toFixed(1)}`,
      )
      .join('');
  };
  const area = $derived(`${curve(post)}L${x(HI).toFixed(1)},${BASE}L${x(LO).toFixed(1)},${BASE}Z`);
</script>

<div
  class="prior-posterior"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-prior={prior}
  data-median={median.toFixed(2)}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`A measurement near ${MEASURED}. With the prior "${priors[prior].label}", the posterior's median is ${median.toFixed(2)} and 90% of it lies between ${lo.toFixed(2)} and ${hi.toFixed(2)}.`}
  >
    <path class="post" d={area} />
    <path class="prior" d={curve(pri, 110)} />
    <path class="like" d={curve(like)} />
    <line class="axis" x1={PAD} x2={width - PAD} y1={BASE} y2={BASE} />
    {#each [0, 2, 4, 6, 8, 10] as v (v)}
      <text x={x(v)} y={BASE + 18} text-anchor="middle">{v}</text>
    {/each}
    <text class="caps" x={PAD} y="16">likelihood · prior · posterior</text>
    <text class="like-label" x={x(MEASURED) + 8} y="42">likelihood: what the data say</text>
    <text x={width - PAD} y={H - 4} text-anchor="end">the parameter</text>
  </svg>
  <div class="controls">
    <fieldset class="choices">
      <legend>What you believed before</legend>
      {#each Object.entries(priors) as [id, p] (id)}
        <label><input type="radio" name="prior" value={id} bind:group={prior} /> {p.label}</label>
      {/each}
    </fieldset>
    <label class="toggle"><input type="checkbox" bind:checked={more} /> Ten times more data</label>
  </div>
  <dl class="readouts">
    <div>
      <dt>posterior median</dt>
      <dd>{median.toFixed(2)}</dd>
    </div>
    <div>
      <dt>90% of the posterior</dt>
      <dd>{lo.toFixed(2)} – {hi.toFixed(2)}</dd>
    </div>
    <div>
      <dt>what the data changed</dt>
      <dd>
        {prior === 'fixed'
          ? 'nothing: the answer was assumed'
          : 'the posterior moved toward the data'}
      </dd>
    </div>
  </dl>
</div>

<style>
  .prior-posterior {
    width: 100%;
  }

  .post {
    fill: var(--signal-bg);
    stroke: var(--signal);
    stroke-width: 2;
  }

  .prior {
    fill: none;
    stroke: var(--noise);
    stroke-width: 1.5;
    stroke-dasharray: 5 4;
  }

  .like {
    fill: none;
    stroke: var(--ink-soft);
    stroke-width: 1.5;
  }

  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1rem;
    margin: 0;
    padding: 0;
    border: 0;
    font-size: var(--text-sm);
  }

  .choices legend {
    width: 100%;
    margin-bottom: 0.3rem;
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
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
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
  }
</style>
