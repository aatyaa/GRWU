<script lang="ts">
  import { scaleLinear } from 'd3-scale';
  import { onMount } from 'svelte';
  import {
    CENTRE,
    medians as mediansOf,
    SEEDS,
    SIZES,
    spreadOf,
    WIDTH,
  } from '~/lib/figure/seed-spread';

  /**
   * From Data File to Claim: which digits of a sampled number are real. A made-up posterior
   * for a ring's frequency (lib/figure/seed-spread.ts: a bell centred on 250 Hz, 6 Hz wide) is
   * drawn N times with each of 20 seeds, and the median of each draw is marked. The digits that
   * change from seed to seed are Monte Carlo jitter; they are shown in red. Seeded, so the
   * figure is the same each visit, and the article's text quotes the same numbers.
   */
  let n = $state(1000);
  let width = $state(640);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  const medians = $derived(mediansOf(n));
  const spread = $derived(spreadOf(medians));
  // A digit is real if its place value is larger than twice the seed-to-seed spread.
  const shown = $derived(medians[0].toFixed(4));
  const split = $derived.by(() => {
    let stable = '';
    let place = 100;
    for (const ch of shown) {
      if (ch === '.') {
        stable += ch;
        continue;
      }
      if (place <= 2 * spread) break;
      stable += ch;
      place /= 10;
    }
    if (stable.endsWith('.')) stable = stable.slice(0, -1);
    return { stable, jitter: shown.slice(stable.length) };
  });

  const H = 120;
  const PAD = { l: 16, r: 16 };
  const x = $derived(
    scaleLinear()
      .domain([CENTRE - 2.5, CENTRE + 2.5])
      .range([PAD.l, width - PAD.r]),
  );
  const ticks = [-2, -1, 0, 1, 2].map((d) => CENTRE + d);
  const clampX = (v: number) => Math.min(CENTRE + 2.5, Math.max(CENTRE - 2.5, v));
</script>

<div
  class="seed-spread"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-n={n}
  data-spread={spread.toPrecision(2)}
  data-stable={split.stable}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`The median of ${n.toLocaleString('en-US')} samples, drawn with ${SEEDS} different seeds: the medians spread by about ±${spread.toPrecision(2)} Hz around 250 Hz.`}
  >
    <line class="axis" x1={PAD.l} x2={width - PAD.r} y1={H - 34} y2={H - 34} />
    {#each ticks as v (v)}
      <line class="axis" x1={x(v)} x2={x(v)} y1={H - 34} y2={H - 29} />
      <text x={x(v)} y={H - 14} text-anchor="middle">{v} Hz</text>
    {/each}
    <line class="truth" x1={x(CENTRE)} x2={x(CENTRE)} y1={10} y2={H - 34} />
    {#each medians as m, i (i)}
      <circle class="dot" cx={x(clampX(m))} cy={H - 46 - (i % 5) * 12} r="4" />
    {/each}
  </svg>

  <fieldset class="sizes">
    <legend>Samples drawn</legend>
    {#each SIZES as size (size)}
      <label>
        <input type="radio" name="seed-spread-n" value={size} bind:group={n} />
        {size.toLocaleString('en-US')}
      </label>
    {/each}
  </fieldset>

  <dl class="numbers" aria-live="polite">
    <div>
      <dt>median, first seed</dt>
      <dd>
        <span>{split.stable}</span><span class="jitter">{split.jitter}</span> Hz
      </dd>
    </div>
    <div>
      <dt>spread of the {SEEDS} medians</dt>
      <dd>±{spread.toPrecision(2)} Hz</dd>
    </div>
    <div>
      <dt>width of the posterior</dt>
      <dd>±{WIDTH} Hz</dd>
    </div>
  </dl>
  <p class="figure-note">
    Digits in <span class="jitter">red</span> change when the seed changes. The green line is the median
    of the posterior itself.
  </p>
</div>

<style>
  .seed-spread {
    width: 100%;
  }

  .truth {
    stroke: var(--ok);
    stroke-width: 1.6;
  }

  .sizes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1rem;
    margin: 0.5rem 0 0;
    padding: 0;
    border: 0;
    font-size: 0.9rem;
    color: var(--ink);
  }

  .sizes legend {
    float: left;
    margin-right: 0.5rem;
    color: var(--ink-soft);
  }

  .sizes label {
    display: inline-flex;
    gap: 0.3rem;
    align-items: center;
  }

  input {
    accent-color: var(--ink);
  }

  .numbers {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
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

  .jitter {
    color: var(--bias);
  }

  .figure-note {
    margin: 0.5rem 0 0;
    font-size: 0.9rem;
    color: var(--ink-soft);
  }
</style>
