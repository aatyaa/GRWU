<script lang="ts">
  /**
   * Eight frequencies, a comparable miss in each, and very different noise (Hidden in the
   * Noise, after The Shape of Error Act IV). Summed as they are, the one noisy frequency
   * decides the total; divided by the noise first, every frequency gets a fair say.
   */
  const noise = [1.2, 0.9, 1.0, 6.0, 1.1, 0.8, 1.0, 1.3];
  const miss = [1.1, -0.8, 1.2, 7.5, -0.9, 0.7, -1.3, 1.0];
  const LOUD = 3;

  let divided = $state(false);
  const contributions = $derived(miss.map((m, i) => (divided ? (m / noise[i]) ** 2 : m * m)));
  const total = $derived(contributions.reduce((s, v) => s + v, 0));
  const share = $derived(contributions[LOUD] / total);

  let width = $state(560);
  const H = 276;
  const TOP = 26;
  const NOISE_H = 46;
  const BASE = H - 26;
  const CAPTION = TOP + NOISE_H + 26;
  const barsTop = CAPTION + 30;
  const slot = $derived((width - 20) / noise.length);
  const bx = (i: number) => 10 + i * slot + slot * 0.2;
  const bw = $derived(slot * 0.6);
  const maxNoise = Math.max(...noise);
  const scale = $derived((BASE - barsTop) / Math.max(...contributions));
</script>

<div class="noise-weights" bind:clientWidth={width} data-share={Math.round(share * 100)}>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={divided
      ? `Each squared miss divided by its own noise: the noisy frequency now contributes ${Math.round(share * 100)} per cent of the total, in line with the others.`
      : `Squared misses added as they are: the one noisy frequency contributes ${Math.round(share * 100)} per cent of the total.`}
  >
    <text class="caps" x="10" y="14">how noisy each frequency is</text>
    {#each noise as sigma, i (i)}
      <rect
        class="noise-bar"
        x={bx(i)}
        width={bw}
        y={TOP + NOISE_H - (sigma / maxNoise) * NOISE_H}
        height={(sigma / maxNoise) * NOISE_H}
      />
    {/each}

    <text class="caps" x="10" y={CAPTION}>
      {divided ? 'each squared miss, divided by its noise first' : 'each squared miss, as it is'}
    </text>
    {#each contributions as c, i (i)}
      <rect
        class="bar"
        class:loud={i === LOUD}
        x={bx(i)}
        width={bw}
        y={BASE - c * scale}
        height={c * scale}
      />
    {/each}
    <line class="axis" x1="10" x2={width - 10} y1={BASE} y2={BASE} />
    <text x={bx(LOUD) + bw / 2} y={BASE - contributions[LOUD] * scale - 8} text-anchor="middle">
      {Math.round(share * 100)}% of the total
    </text>
    <text x={width - 10} y={H - 6} text-anchor="end">frequency →</text>
  </svg>
  <div class="controls">
    <button type="button" class="btn" aria-pressed={divided} onclick={() => (divided = !divided)}>
      {divided ? 'Add them up as they are' : 'Divide each miss by its noise'}
    </button>
    <span class="readout">
      the noisy frequency's share <b>{Math.round(share * 100)}%</b>
    </span>
  </div>
</div>

<style>
  .noise-weights {
    width: 100%;
  }

  .noise-bar {
    fill: var(--noise);
    opacity: 0.55;
  }

  .bar {
    fill: var(--model);
    transition:
      y var(--dur) var(--ease),
      height var(--dur) var(--ease);
  }

  .bar.loud {
    fill: var(--bias);
  }
</style>
