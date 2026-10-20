<script lang="ts">
  import { onMount } from 'svelte';
  import type { ChiSquareCase } from '~/lib/articles/candidate';

  /**
   * Does it look like a chirp? (A Peak Is Only a Candidate): the χ² test splits the template
   * into eight frequency bands that should each carry an eighth of the score. The chirp does
   * that; a glitch just as loud piles its score into one band. Everything is computed at
   * build time; the island only switches between the two cases.
   */
  let { edges, chirp, glitch }: { edges: number[]; chirp: ChiSquareCase; glitch: ChiSquareCase } =
    $props();

  let which = $state<'chirp' | 'glitch'>('chirp');
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });
  const c = $derived(which === 'chirp' ? chirp : glitch);
  const share = $derived(c.snr / c.bands.length);
  const perDof = $derived(c.chi2 / c.dof);
  const passes = $derived(perDof < 2);

  let width = $state(600);
  const H = 300;
  const PAD = { l: 40, r: 12, t: 30, b: 50 };
  // One vertical scale for both cases, so the glitch's tall band is seen against the chirp's.
  const all = $derived([...chirp.bands, ...glitch.bands]);
  const lo = $derived(Math.min(0, ...all) - 0.5);
  const hi = $derived(Math.max(...all) + 1);
  const y = (v: number) => PAD.t + ((hi - v) / (hi - lo)) * (H - PAD.t - PAD.b);
  const n = $derived(edges.length);
  const slot = $derived((width - PAD.l - PAD.r) / n);
  const bx = (i: number) => PAD.l + i * slot;
  // Narrow screens show where each band starts; wide ones show its whole range.
  const label = (i: number) =>
    i === n - 1
      ? `${Math.round(edges[i])}+`
      : slot < 64
        ? `${Math.round(edges[i])}`
        : `${Math.round(edges[i])}–${Math.round(edges[i + 1])}`;
  const ticks = $derived([0, 5, 10, 15].filter((v) => v <= hi));
</script>

<div
  class="chi-test"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-case={which}
  data-chi={perDof.toFixed(2)}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`The score of ${which === 'chirp' ? 'the chirp' : 'the glitch'}, ${c.snr.toFixed(1)}, divided among eight frequency bands that should each hold ${share.toFixed(1)}. ${passes ? 'Every band holds about its share' : `One band holds ${Math.max(...c.bands).toFixed(1)} and the others almost nothing`}: χ² per degree of freedom is ${perDof.toFixed(2)}.`}
  >
    <text class="caps" x={PAD.l} y="16">the score, band by band</text>
    {#each ticks as v (v)}
      <line class="grid" x1={PAD.l} x2={width - PAD.r} y1={y(v)} y2={y(v)} />
      <text x={PAD.l - 8} y={y(v)} dy="4" text-anchor="end">{v}</text>
    {/each}
    {#each c.bands as b, i (i)}
      <rect
        class="bar"
        class:over={b > 2 * share}
        x={bx(i) + slot * 0.18}
        width={slot * 0.64}
        y={Math.min(y(b), y(0))}
        height={Math.abs(y(b) - y(0))}
      />
      {#if b > 2 * share}
        <text class="bias" x={bx(i) + slot * 0.82} y={y(b) - 8} text-anchor="end"
          >too much in one band</text
        >
      {/if}
      <text x={bx(i) + slot / 2} y={H - PAD.b + 16} text-anchor="middle">{label(i)}</text>
    {/each}
    <line class="model" x1={PAD.l} x2={width - PAD.r} y1={y(share)} y2={y(share)} />
    <text class="share-label" x={PAD.l + 4} y={y(share) - 8}
      >a chirp would put {share.toFixed(1)} in each</text
    >
    <line class="axis" x1={PAD.l} x2={width - PAD.r} y1={y(0)} y2={y(0)} />
    <text x={width - PAD.r} y={H - 8} text-anchor="end"
      >{slot < 64 ? 'frequency band, from (Hz)' : 'frequency band (Hz)'}</text
    >
  </svg>

  <fieldset class="controls">
    <legend class="visually-hidden">What is in the data</legend>
    <label><input type="radio" bind:group={which} value="chirp" /> The chirp</label>
    <label><input type="radio" bind:group={which} value="glitch" /> A glitch just as loud</label>
  </fieldset>
  <dl class="readouts">
    <div>
      <dt>matched-filter score</dt>
      <dd>{c.snr.toFixed(1)}</dd>
    </div>
    <div>
      <dt>χ² per degree of freedom</dt>
      <dd class:bad={!passes}>{perDof.toFixed(2)}</dd>
    </div>
    <div>
      <dt>verdict</dt>
      <dd class:bad={!passes}>{passes ? 'shaped like a chirp' : 'not a chirp'}</dd>
    </div>
  </dl>
</div>

<style>
  .chi-test {
    width: 100%;
  }

  .bar {
    fill: var(--signal);
    opacity: 0.85;
  }

  /* A halo in the page colour keeps the label legible where a bar reaches it. */
  .fig text.share-label {
    paint-order: stroke;
    stroke: var(--ground);
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  .bar.over {
    fill: var(--bias);
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
