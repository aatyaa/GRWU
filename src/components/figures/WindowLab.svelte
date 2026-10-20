<script lang="ts">
  import { scaleLinear } from 'd3-scale';
  import { onMount } from 'svelte';
  import { rfft } from '~/lib/dsp/fft';
  import { hann, tukey } from '~/lib/dsp/window';

  /**
   * Every Signal Is a Chord: cutting a stretch out of a tone smears its spectrum (leakage) unless
   * the tone fits the stretch exactly. A window tapers the ends and trades a wider peak for far
   * less smear. Windows from lib/dsp/window.ts and the FFT from lib/dsp/fft.ts, both checked
   * against scipy/numpy. The spectrum is in decibels below its peak.
   */
  const N = 64;
  const FLOOR = -80;
  type Kind = 'rectangle' | 'hann' | 'tukey';
  const KINDS: { id: Kind; label: string }[] = [
    { id: 'rectangle', label: 'No window (cut straight)' },
    { id: 'tukey', label: 'Tukey (tapered ends)' },
    { id: 'hann', label: 'Hann (fully tapered)' },
  ];

  let kind = $state<Kind>('rectangle');
  let onBin = $state(false);
  let width = $state(640);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  const cycles = $derived(onBin ? 10 : 10.5);
  const win = $derived(
    kind === 'hann' ? hann(N) : kind === 'tukey' ? tukey(N, 0.5) : new Float64Array(N).fill(1),
  );
  const db = $derived.by(() => {
    const x = Float64Array.from(
      { length: N },
      (_, n) => win[n] * Math.cos((2 * Math.PI * cycles * n) / N),
    );
    const { re, im } = rfft(x);
    const mag = Array.from(re, (r, k) => Math.hypot(r, im[k]));
    const peak = Math.max(...mag);
    return mag.map((m) => Math.max(FLOOR, 20 * Math.log10(m / peak || 1e-12)));
  });
  /** Smear far from the tone: the loudest bin six or more bins away, in dB. */
  const leak = $derived(Math.max(...db.filter((_, k) => Math.abs(k - cycles) >= 6)));

  const H = 230;
  const PAD = { l: 56, r: 14, t: 12, b: 30 };
  const x = $derived(
    scaleLinear()
      .domain([0, N / 2])
      .range([PAD.l, width - PAD.r]),
  );
  const y = scaleLinear()
    .domain([FLOOR, 0])
    .range([H - PAD.b, PAD.t]);
</script>

<div
  class="window-lab"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-window={kind}
  data-leak={leak.toFixed(0)}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`Spectrum of a tone of ${cycles} cycles in the stretch, ${kind} window: away from the tone the smear is ${leak.toFixed(0)} decibels below the peak.`}
  >
    {#each [0, -20, -40, -60, -80] as d (d)}
      <line class="grid" x1={PAD.l} x2={width - PAD.r} y1={y(d)} y2={y(d)} />
      <text class="tick" x={PAD.l - 6} y={y(d) + 4} text-anchor="end">{d} dB</text>
    {/each}
    {#each db as d, k (k)}
      <line
        class="bar"
        class:far={Math.abs(k - cycles) >= 6}
        x1={x(k)}
        x2={x(k)}
        y1={y(FLOOR)}
        y2={y(d)}
      />
    {/each}
    <text class="tick" x={width - PAD.r} y={H - 9} text-anchor="end">frequency bin →</text>
  </svg>

  <div class="controls" role="radiogroup" aria-label="Window">
    {#each KINDS as k (k.id)}
      <label
        ><input type="radio" name="window-kind" value={k.id} bind:group={kind} /> {k.label}</label
      >
    {/each}
    <label class="bin"
      ><input type="checkbox" bind:checked={onBin} /> Let the tone fit the stretch exactly</label
    >
  </div>
  <p class="figure-note">
    Smear far from the tone: <b>{leak <= FLOOR ? `below ${FLOOR}` : leak.toFixed(0)} dB</b> below the
    peak.
  </p>
</div>

<style>
  .window-lab {
    width: 100%;
  }

  .grid {
    stroke: var(--rule-soft);
  }

  .tick {
    font-size: 11px;
    fill: var(--ink-soft);
  }

  .bar {
    stroke: var(--signal);
    stroke-width: 5;
  }

  .bar.far {
    stroke: var(--bias);
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.2rem;
    margin-top: 0.6rem;
    font-size: 0.9rem;
    color: var(--ink);
  }

  .controls label {
    display: inline-flex;
    gap: 0.35rem;
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
