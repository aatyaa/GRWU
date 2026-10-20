<script lang="ts">
  import { fitLinear } from '~/lib/stats/estimators';
  import { gaussian, mulberry32 } from '~/lib/stats/random';

  // The data: a trend plus a slow wave plus noise. The model either knows about the wave or
  // does not; both fits "work", and only the residuals tell them apart.
  const W_WAVE = 1.4;
  const draw = gaussian(mulberry32(2015));
  const xs = Array.from({ length: 38 }, (_, i) => 0.3 + (i * 9.4) / 37);
  const ys = xs.map((x) => 0.9 + 0.32 * x + 0.55 * Math.sin(W_WAVE * x) + 0.18 * draw());

  let complete = $state(false);
  const basis = $derived(
    complete
      ? [
          () => 1,
          (x: number) => x,
          (x: number) => Math.sin(W_WAVE * x),
          (x: number) => Math.cos(W_WAVE * x),
        ]
      : [() => 1, (x: number) => x],
  );
  const theta = $derived(fitLinear(basis, xs, ys));
  const model = (x: number) => basis.reduce((sum, f, j) => sum + theta[j] * f(x), 0);
  const residuals = $derived(xs.map((x, i) => ys[i] - model(x)));
  const chi2dof = $derived(
    residuals.reduce((s, r) => s + (r / 0.18) ** 2, 0) / (xs.length - basis.length),
  );

  let width = $state(640);
  const PAD = 18;
  const TOP_H = 170;
  const RES_H = 96;
  const height = TOP_H + RES_H + 40;
  const px = (x: number) => PAD + (x / 10) * (width - 2 * PAD);
  const pyTop = (y: number) => TOP_H - 12 - ((y + 0.2) / 5) * (TOP_H - 30);
  const RES_MID = TOP_H + 26 + RES_H / 2;
  const pyRes = (r: number) => RES_MID - (r / 1.1) * (RES_H / 2);
  const modelPath = $derived.by(() => {
    let d = '';
    for (let i = 0; i <= 160; i++) {
      const x = (i / 160) * 10;
      d += `${i ? 'L' : 'M'}${px(x).toFixed(1)},${pyTop(model(x)).toFixed(1)}`;
    }
    return d;
  });
</script>

<div class="residuals" bind:clientWidth={width} data-complete={complete}>
  <svg
    class="fig"
    viewBox="0 0 {width} {height}"
    {width}
    {height}
    role="img"
    aria-label={complete
      ? 'The model includes the wave: the residuals scatter evenly about zero with no shape left.'
      : 'The model is a straight line: the residuals still trace a wave that the model does not contain.'}
  >
    <text x={PAD} y={14} class="caps">the fit</text>
    <path class="model" d={modelPath} />
    {#each xs as x, i (i)}
      <circle class="dot" cx={px(x)} cy={pyTop(ys[i])} r="3.5" />
    {/each}

    <text x={PAD} y={TOP_H + 16} class="caps" class:bias={!complete} class:ok={complete}>
      residuals · {complete ? 'no shape left' : 'a wave survives'}
    </text>
    <line class="axis" x1={PAD} x2={width - PAD} y1={RES_MID} y2={RES_MID} />
    {#each xs as x, i (i)}
      <line
        class="stem"
        class:bias={!complete}
        x1={px(x)}
        x2={px(x)}
        y1={RES_MID}
        y2={pyRes(residuals[i])}
      />
      <circle class="res-dot" class:bias={!complete} cx={px(x)} cy={pyRes(residuals[i])} r="2.6" />
    {/each}
  </svg>
  <div class="controls">
    <button
      type="button"
      class="btn"
      aria-pressed={complete}
      onclick={() => (complete = !complete)}
    >
      {complete ? 'Model includes the wave' : 'Give the model the wave'}
    </button>
    <span class="readout">χ² per degree of freedom <b>{chi2dof.toFixed(2)}</b></span>
  </div>
</div>

<style>
  .stem {
    stroke: var(--ink-faint);
    stroke-width: 1;
  }

  .stem.bias {
    stroke: var(--bias);
  }

  .res-dot {
    fill: var(--ink-faint);
  }

  .res-dot.bias {
    fill: var(--bias);
  }
</style>
