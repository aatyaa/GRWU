<script lang="ts">
  import { onMount } from 'svelte';

  /**
   * How often does noise do this? (A Peak Is Only a Candidate): two detectors' noise, one slid
   * against the other by half-second steps so that no real signal can line up, and every
   * accidental coincidence that remains. The reader chooses whether the candidate's own
   * triggers stay in the slid data, where they pair with noise.
   */
  interface Background {
    counts: number[];
    total: number;
    loudest: number;
    louder: number;
  }
  let {
    lo,
    step,
    exclusive,
    inclusive,
    candidate,
    hours,
    slides,
  }: {
    lo: number;
    step: number;
    exclusive: Background;
    inclusive: Background;
    candidate: number;
    hours: number;
    slides: number;
  } = $props();

  let keep = $state(false);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });
  const bg = $derived(keep ? inclusive : exclusive);

  let width = $state(600);
  const H = 290;
  const PAD = { l: 44, r: 14, t: 30, b: 44 };
  const hiX = $derived(lo + step * exclusive.counts.length);
  const x = (v: number) => PAD.l + ((v - lo) / (hiX - lo)) * (width - PAD.l - PAD.r);
  const yMax = $derived(
    10 ** Math.ceil(Math.log10(Math.max(...exclusive.counts, ...inclusive.counts))),
  );
  // Log counts; an empty bin draws nothing.
  const y = (c: number) =>
    PAD.t + (1 - Math.log10(c / 0.7) / Math.log10(yMax / 0.7)) * (H - PAD.t - PAD.b);
  const ticks = $derived([1, 10, 100, 1000].filter((t) => t <= yMax));
  const xticks = [4, 6, 8, 10, 12, 14, 16];
</script>

<div
  class="time-slides"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-mode={keep ? 'inclusive' : 'exclusive'}
  data-louder={bg.louder}
  data-loudest={bg.loudest.toFixed(2)}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`A histogram of ${bg.total} accidental coincidences from ${slides} time slides, by combined score. The loudest reaches ${bg.loudest.toFixed(1)}. The candidate scores ${candidate.toFixed(1)}, and ${bg.louder === 0 ? 'nothing in the background is as loud' : `${bg.louder} background events are as loud`}.`}
  >
    <text class="caps" x={PAD.l} y="16">accidents, by combined score · log count</text>
    {#each ticks as t (t)}
      <line class="grid" x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} />
      <text x={PAD.l - 8} y={y(t)} dy="4" text-anchor="end">{t}</text>
    {/each}
    {#each bg.counts as c, i (i)}
      {#if c > 0}
        <rect
          class="bar"
          x={x(lo + i * step) + 0.5}
          width={Math.max(1, x(lo + step) - x(lo) - 1)}
          y={y(c)}
          height={H - PAD.b - y(c)}
        />
      {/if}
    {/each}
    <line class="cand" x1={x(candidate)} x2={x(candidate)} y1={PAD.t} y2={H - PAD.b} />
    <text class="signal" x={x(candidate) - 6} y={PAD.t + 12} text-anchor="end"
      >the candidate, {candidate.toFixed(1)}</text
    >
    <line class="axis" x1={PAD.l} x2={width - PAD.r} y1={H - PAD.b} y2={H - PAD.b} />
    {#each xticks as v (v)}
      <text x={x(v)} y={H - PAD.b + 16} text-anchor="middle">{v}</text>
    {/each}
    <text x={width - PAD.r} y={H - 6} text-anchor="end">combined score of both detectors</text>
  </svg>

  <label class="toggle">
    <input type="checkbox" bind:checked={keep} />
    Leave the candidate's own triggers in the slid data
  </label>
  <dl class="readouts">
    <div>
      <dt>noise searched</dt>
      <dd>{slides} slides · {hours.toFixed(1)} h</dd>
    </div>
    <div>
      <dt>accidents found</dt>
      <dd>{bg.total}</dd>
    </div>
    <div>
      <dt>the loudest accident</dt>
      <dd>{bg.loudest.toFixed(1)}</dd>
    </div>
    <div>
      <dt>as loud as the candidate</dt>
      <dd>{bg.louder}</dd>
    </div>
  </dl>
</div>

<style>
  .time-slides {
    width: 100%;
  }

  .bar {
    fill: var(--noise);
    opacity: 0.75;
  }

  .cand {
    stroke: var(--signal);
    stroke-width: 2;
  }

  .toggle {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-top: 0.75rem;
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
</style>
