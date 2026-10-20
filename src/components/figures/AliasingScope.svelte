<script lang="ts">
  import { scaleLinear } from 'd3-scale';
  import { onMount } from 'svelte';
  import { aliasFrequency } from '~/lib/dsp/sampling';

  /**
   * Every Signal Is a Chord: a tone, and the samples a recorder takes of it. Above half the
   * sampling rate the samples fit a slower tone just as well, and that false tone (the alias)
   * is all the record contains. aliasFrequency (lib/dsp/sampling.ts) is checked against where
   * numpy's FFT finds sampled tones.
   */
  let f = $state(12);
  let fs = $state(40);
  let width = $state(640);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  const T = 0.5;
  const H = 230;
  const PAD = { l: 14, r: 14, t: 14, b: 30 };
  const alias = $derived(aliasFrequency(f, fs));
  const aliased = $derived(Math.abs(alias - f) > 1e-9);
  const x = $derived(
    scaleLinear()
      .domain([0, T])
      .range([PAD.l, width - PAD.r]),
  );
  const y = scaleLinear()
    .domain([-1.2, 1.2])
    .range([H - PAD.b, PAD.t]);
  const curve = (freq: number) =>
    Array.from({ length: 1201 }, (_, i) => {
      const t = (i / 1200) * T;
      return `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(Math.cos(2 * Math.PI * freq * t)).toFixed(1)}`;
    }).join('');
  const truePath = $derived(curve(f));
  const aliasPath = $derived(curve(alias));
  const samples = $derived(
    Array.from({ length: Math.floor(T * fs) + 1 }, (_, n) => ({
      t: n / fs,
      v: Math.cos((2 * Math.PI * f * n) / fs),
    })),
  );
</script>

<div
  class="aliasing"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-alias={alias}
  data-aliased={aliased}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`A ${f} hertz tone sampled ${fs} times a second. ${aliased ? `The samples trace a ${alias} hertz tone instead.` : 'The samples follow the tone.'}`}
  >
    <line class="axis" x1={PAD.l} x2={width - PAD.r} y1={y(0)} y2={y(0)} />
    {#each [0, 0.1, 0.2, 0.3, 0.4, 0.5] as s (s)}
      <text
        class="tick"
        x={x(s)}
        y={H - 9}
        text-anchor={s === 0 ? 'start' : s === 0.5 ? 'end' : 'middle'}>{s} s</text
      >
    {/each}
    <path class="true" d={truePath} />
    {#if aliased}<path class="alias" d={aliasPath} />{/if}
    {#each samples as s, i (i)}
      <circle class="sample" cx={x(s.t)} cy={y(s.v)} r="3.5" />
    {/each}
  </svg>

  <ul class="key">
    <li><i class="k-true"></i>the real tone, {f} Hz</li>
    <li><i class="k-sample"></i>the samples, {fs} per second</li>
    {#if aliased}<li>
        <i class="k-alias"></i>what the samples say: a {alias} Hz tone (alias)
      </li>{/if}
  </ul>

  <div class="sliders">
    <label>
      <span>Frequency of the tone <b>{f} Hz</b></span>
      <input type="range" min="1" max="60" step="1" bind:value={f} />
    </label>
    <label>
      <span>Samples per second <b>{fs}</b> (safe up to {fs / 2} Hz)</span>
      <input type="range" min="10" max="100" step="2" bind:value={fs} />
    </label>
  </div>
</div>

<style>
  .aliasing {
    width: 100%;
  }

  .axis {
    stroke: var(--rule);
  }

  .tick {
    font-size: 11px;
    fill: var(--ink-soft);
  }

  .true {
    fill: none;
    stroke: var(--model);
    stroke-width: 1.3;
    stroke-dasharray: 5 4;
  }

  .alias {
    fill: none;
    stroke: var(--bias);
    stroke-width: 1.8;
  }

  .sample {
    fill: var(--signal);
    stroke: var(--surface);
    stroke-width: 1;
  }

  .key {
    display: flex;
    flex-wrap: wrap;
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

  .k-true {
    background: repeating-linear-gradient(90deg, var(--model) 0 5px, transparent 5px 8px);
  }

  .k-sample {
    width: 8px !important;
    height: 8px !important;
    border-radius: 50% !important;
    background: var(--signal);
  }

  .k-alias {
    background: var(--bias);
  }

  .sliders {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
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
</style>
