<script lang="ts">
  import { dragger, stepKey } from '~/lib/figure/pointer';

  // Four measurements, each scored by how likely its miss is under the bell curve. The deck's
  // example: three good points and one poor one.
  const R = 3;
  let misses = $state([0.35, 0.55, 0.29, 2.37]);
  const scores = $derived(misses.map((r) => Math.exp(-(r * r) / 2)));
  const product = $derived(scores.reduce((a, b) => a * b, 1));
  const sumSquares = $derived(misses.reduce((a, r) => a + r * r, 0));
  const worst = $derived(scores.indexOf(Math.min(...scores)));

  let width = $state(640);
  const GAP = 14;
  const columns = $derived(width < 520 ? 2 : 4);
  const panelW = $derived((width - GAP * (columns - 1)) / columns);
  const PANEL_H = 118;
  const height = $derived(Math.ceil(4 / columns) * (PANEL_H + GAP));

  const origin = (i: number) => ({
    x: (i % columns) * (panelW + GAP),
    y: Math.floor(i / columns) * (PANEL_H + GAP),
  });
  const px = (r: number) => ((r + R) / (2 * R)) * (panelW - 16) + 8;
  const py = (p: number) => PANEL_H - 26 - p * (PANEL_H - 50);
  const bell = $derived.by(() => {
    let d = '';
    for (let i = 0; i <= 60; i++) {
      const r = -R + (2 * R * i) / 60;
      d += `${i ? 'L' : 'M'}${px(r).toFixed(1)},${py(Math.exp(-(r * r) / 2)).toFixed(1)}`;
    }
    return d;
  });

  let svg = $state<SVGSVGElement>();
  const drags = [0, 1, 2, 3].map((i) =>
    dragger(
      () => svg,
      (p) => {
        const r = ((p.x - origin(i).x - 8) / (panelW - 16)) * 2 * R - R;
        misses[i] = Math.min(R, Math.max(-R, r));
      },
    ),
  );
</script>

<div class="likelihood" bind:clientWidth={width} data-product={product.toFixed(3)}>
  <svg
    bind:this={svg}
    class="fig"
    viewBox="0 0 {width} {height}"
    {width}
    {height}
    role="group"
    aria-label="Four bell curves, one per measurement, each with its miss marked. Their product is the likelihood."
  >
    {#each misses as r, i (i)}
      {@const o = origin(i)}
      <g transform="translate({o.x},{o.y})">
        <rect class="panel" width={panelW} height={PANEL_H} rx="4" />
        <path class="noise" d={bell} />
        <line class="axis" x1={8} x2={panelW - 8} y1={py(0)} y2={py(0)} />
        <line class="drop" x1={px(r)} x2={px(r)} y1={py(0)} y2={py(scores[i])} />
        <text x={10} y={16} class="caps">point {i + 1}</text>
        <text
          x={panelW - 10}
          y={16}
          text-anchor="end"
          class:bias={i === worst && scores[i] < 0.3}
          class="ink">{scores[i].toFixed(2)}</text
        >
        <circle
          class="handle"
          cx={px(r)}
          cy={py(scores[i])}
          r="7"
          tabindex="0"
          role="slider"
          aria-label="Miss of point {i + 1}"
          aria-valuemin={-R}
          aria-valuemax={R}
          aria-valuenow={Number(r.toFixed(2))}
          aria-valuetext="miss {r.toFixed(2)}, likelihood {scores[i].toFixed(2)}"
          onpointerdown={drags[i]}
          onkeydown={(e) => {
            const v = stepKey(e, r, { step: 0.05, min: -R, max: R });
            if (v !== null) misses[i] = v;
          }}
        />
        <text x={panelW / 2} y={PANEL_H - 8} text-anchor="middle">miss r = {r.toFixed(2)}</text>
      </g>
    {/each}
  </svg>

  <p class="product" aria-live="polite">
    {#each scores as score, i (i)}
      <span class:weak={i === worst && score < 0.3}>{score.toFixed(2)}</span>
      {i < 3 ? ' × ' : ''}
    {/each}
    <span class="equals">=</span>
    <b>{product.toFixed(3)}</b>
  </p>
  <p class="identity">
    and <span class="mono">e<sup>−Σr²/2</sup></span> with Σr² = {sumSquares.toFixed(2)} is
    <b>{Math.exp(-sumSquares / 2).toFixed(3)}</b>: the same number, always.
  </p>
</div>

<style>
  .panel {
    fill: var(--surface);
    stroke: var(--rule-soft);
  }

  .drop {
    stroke: var(--signal);
    stroke-dasharray: 3 3;
  }

  .product {
    margin: 1rem 0 0.2rem;
    font-family: var(--f-display);
    font-size: clamp(1.5rem, 3.4vw, 2.1rem);
    line-height: 1.2;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }

  .product .weak {
    color: var(--bias);
  }

  .product .equals {
    color: var(--ink-faint);
    padding: 0 0.2em;
  }

  .product b {
    font-weight: 400;
    color: var(--signal);
  }

  .identity {
    margin: 0;
    font-family: var(--f-mono);
    font-size: 0.72rem;
    color: var(--ink-faint);
  }

  .identity b {
    font-weight: 500;
    color: var(--ink);
  }
</style>
