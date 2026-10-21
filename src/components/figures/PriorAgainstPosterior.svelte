<script lang="ts">
  import { onMount } from 'svelte';
  import type { SampledParameter } from '~/lib/articles/yourself';

  /**
   * Plot the prior with the posterior (Run It Yourself): the samples a sampler returns, as a
   * histogram, against the flat prior they started from. Where the data spoke, the two part
   * company; where they did not, the posterior is the prior handed back.
   */
  let { chirpMass, phase }: { chirpMass: SampledParameter; phase: SampledParameter } = $props();

  let which = $state<'chirpMass' | 'phase'>('chirpMass');
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });
  const p = $derived(which === 'chirpMass' ? chirpMass : phase);
  const share = $derived((p.p95 - p.p5) / (p.hi - p.lo));
  const spoke = $derived(share < 0.6);

  let width = $state(600);
  const H = 260;
  const PAD = { l: 14, r: 14, t: 30, b: 44 };
  const x = (v: number) => PAD.l + ((v - p.lo) / (p.hi - p.lo)) * (width - PAD.l - PAD.r);
  const top = $derived(Math.max(...p.bins, 2 / p.bins.length));
  const y = (f: number) => H - PAD.b - (f / top) * (H - PAD.t - PAD.b);
  const step = $derived((p.hi - p.lo) / p.bins.length);
  const ticks = $derived(
    which === 'chirpMass'
      ? [27, 27.5, 28, 28.5, 29]
      : [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, 2 * Math.PI],
  );
  const tickLabel = (v: number) =>
    which === 'chirpMass'
      ? v.toFixed(1)
      : ['0', 'π/2', 'π', '3π/2', '2π'][Math.round(v / (Math.PI / 2))];
  const digits = $derived(which === 'chirpMass' ? 2 : 1);
</script>

<div
  class="prior-against"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-parameter={which}
  data-share={share.toFixed(3)}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`${p.samples} posterior samples of the ${p.name} against its flat prior. 90% of them lie between ${p.p5.toFixed(digits)} and ${p.p95.toFixed(digits)}, ${(100 * share).toFixed(0)}% of the prior's range: ${spoke ? 'the data narrowed it down' : 'the posterior is the prior, and the data said nothing'}.`}
  >
    <text class="caps" x={PAD.l} y="16">{p.name}: posterior samples against the prior</text>
    <rect
      class="interval"
      x={x(p.p5)}
      y={PAD.t}
      width={Math.max(1, x(p.p95) - x(p.p5))}
      height={H - PAD.t - PAD.b}
    />
    {#each p.bins as f, i (i)}
      {#if f > 0}
        <rect
          class="bar"
          x={x(p.lo + i * step) + 0.5}
          width={Math.max(1, x(p.lo + step) - x(p.lo) - 1)}
          y={y(f)}
          height={H - PAD.b - y(f)}
        />
      {/if}
    {/each}
    <line
      class="model"
      x1={x(p.lo)}
      x2={x(p.hi)}
      y1={y(1 / p.bins.length)}
      y2={y(1 / p.bins.length)}
    />
    <text x={x(p.hi)} y={y(1 / p.bins.length) - 6} text-anchor="end">the prior</text>
    <line class="axis" x1={PAD.l} x2={width - PAD.r} y1={H - PAD.b} y2={H - PAD.b} />
    {#each ticks as t (t)}
      <text x={x(t)} y={H - PAD.b + 16} text-anchor="middle">{tickLabel(t)}</text>
    {/each}
    <text x={width - PAD.r} y={H - 8} text-anchor="end">{p.name} ({p.unit})</text>
  </svg>

  <fieldset class="controls">
    <legend class="visually-hidden">Parameter</legend>
    <label><input type="radio" bind:group={which} value="chirpMass" /> Chirp mass</label>
    <label><input type="radio" bind:group={which} value="phase" /> Phase</label>
  </fieldset>
  <dl class="readouts">
    <div>
      <dt>median</dt>
      <dd>{p.median.toFixed(digits)}</dd>
    </div>
    <div>
      <dt>90% credible interval</dt>
      <dd>{p.p5.toFixed(digits)} to {p.p95.toFixed(digits)}</dd>
    </div>
    <div>
      <dt>what the data said</dt>
      <dd class:bad={!spoke}>
        {spoke
          ? `narrowed it to ${(100 * share).toFixed(0)}% of the prior`
          : 'nothing: posterior = prior'}
      </dd>
    </div>
  </dl>
</div>

<style>
  .prior-against {
    width: 100%;
  }

  .bar {
    fill: var(--signal);
    opacity: 0.8;
  }

  .interval {
    fill: var(--signal-bg);
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
    margin: 0.75rem 0 0;
    padding: 0;
    border: 0;
    font-size: var(--text-sm);
  }

  .controls label {
    display: flex;
    gap: 0.45rem;
    align-items: center;
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
