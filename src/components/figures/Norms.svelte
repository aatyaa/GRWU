<script lang="ts">
  import { mean, median, midrange } from '~/lib/stats/estimators';
  import { dragger, stepKey } from '~/lib/figure/pointer';

  // Seven measurements that agree, and one that does not. Drag the odd one.
  const cluster = [-0.4, -0.25, -0.1, -0.05, -0.05, 0.1, 0.25];
  const MIN = -1;
  const MAX = 5;
  let outlier = $state(3.7);
  const values = $derived([...cluster, outlier]);

  const estimates = $derived([
    { id: 'mean', label: 'mean', cost: 'squares', value: mean(values) },
    { id: 'median', label: 'median', cost: 'distances', value: median(values) },
    { id: 'midrange', label: 'midrange', cost: 'the worst miss', value: midrange(values) },
  ]);

  let width = $state(640);
  const PAD = 22;
  const height = 196;
  const AXIS = 70;
  const px = (v: number) => PAD + ((v - MIN) / (MAX - MIN)) * (width - 2 * PAD);
  const fromPx = (x: number) => MIN + ((x - PAD) / (width - 2 * PAD)) * (MAX - MIN);

  let svg = $state<SVGSVGElement>();
  const drag = dragger(
    () => svg,
    (p) => (outlier = Math.min(MAX, Math.max(MIN, fromPx(p.x)))),
  );

  // Labels are stacked in rows so they never overlap, whatever the reader does.
  const rows = [118, 146, 174];
  const signed = (v: number) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
</script>

<div class="norms" bind:clientWidth={width} data-mean={estimates[0].value.toFixed(2)}>
  <svg
    bind:this={svg}
    class="fig"
    viewBox="0 0 {width} {height}"
    {width}
    {height}
    role="group"
    aria-label="Eight measurements on a line, one far from the others. Three markers show the mean, the median and the midrange."
  >
    <text x={PAD} y={20} class="caps">one sample · three “best” answers</text>
    <line class="axis" x1={PAD} x2={width - PAD} y1={AXIS} y2={AXIS} />
    {#each [-1, 0, 1, 2, 3, 4, 5] as tick (tick)}
      <line class="axis" x1={px(tick)} x2={px(tick)} y1={AXIS - 4} y2={AXIS + 4} />
      <text x={px(tick)} y={AXIS + 20} text-anchor="middle">{tick}</text>
    {/each}

    {#each estimates as estimate, i (estimate.id)}
      <line
        class="estimate {estimate.id}"
        x1={px(estimate.value)}
        x2={px(estimate.value)}
        y1={AXIS - 26}
        y2={rows[i] - 12}
      />
      <text
        class="estimate-label {estimate.id}"
        x={px(estimate.value)}
        y={rows[i]}
        text-anchor={estimate.value > (MIN + MAX) / 2 ? 'end' : 'start'}
        dx={estimate.value > (MIN + MAX) / 2 ? -6 : 6}
      >
        {estimate.label}
        {signed(estimate.value)} · minimises {estimate.cost}
      </text>
    {/each}

    {#each cluster as value, i (i)}
      <circle class="dot ink" cx={px(value)} cy={AXIS - 10 - (i % 2) * 8} r="4.5" />
    {/each}
    <circle
      class="handle"
      cx={px(outlier)}
      cy={AXIS - 10}
      r="8"
      tabindex="0"
      role="slider"
      aria-label="The measurement that disagrees"
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      aria-valuenow={Number(outlier.toFixed(2))}
      aria-valuetext={signed(outlier)}
      onpointerdown={drag}
      onkeydown={(e) => {
        const v = stepKey(e, outlier, { step: 0.05, min: MIN, max: MAX });
        if (v !== null) outlier = v;
      }}
    />
    <text x={px(outlier)} y={AXIS - 26} text-anchor="middle" class="signal">the outlier</text>
  </svg>
</div>

<style>
  .norms {
    width: 100%;
  }

  .estimate {
    stroke-width: 1.5;
  }

  .estimate.mean {
    stroke: var(--signal);
  }

  .estimate.median {
    stroke: var(--model);
  }

  .estimate.midrange {
    stroke: var(--noise);
    stroke-dasharray: 4 3;
  }

  .estimate-label.mean {
    fill: var(--signal);
  }

  .estimate-label.median {
    fill: var(--model);
  }

  .estimate-label.midrange {
    fill: var(--ink-faint);
  }
</style>
