<script lang="ts">
  import { onMount } from 'svelte';
  import { fitLine } from '~/lib/stats/estimators';
  import { dragger, stepKey } from '~/lib/figure/pointer';

  /**
   * The two ways the articles are read, shown in miniature on the home page: text that drives
   * a figure as it scrolls past, and a point the reader drags.
   */
  let { kind }: { kind: 'scroll' | 'drag' } = $props();

  // Set once the island has hydrated, so tests act on a live figure.
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  const W = 300;
  const H = 130;
  const xs = [30, 70, 110, 150, 190, 230, 270];
  const base = [96, 88, 92, 70, 66, 50, 44];

  // Scroll: each step fills the little text window; the one in view drives the figure.
  const steps = ['Seven measurements.', 'A line through them.', 'Each miss, drawn as a square.'];
  let step = $state(0);
  let scroller = $state<HTMLElement>();
  function onScroll() {
    if (!scroller) return;
    step = Math.min(steps.length - 1, Math.round(scroller.scrollTop / scroller.clientHeight));
  }

  // Drag: one point near the end moves (a point at the mean x would only shift the line, not
  // tilt it); the least-squares line follows it.
  const MOVABLE = 5;
  let y = $state(24);
  const ys = $derived(base.map((v, i) => (i === MOVABLE ? y : v)));
  const line = $derived(fitLine(xs, ys));
  const at = (x: number) => line.intercept + line.slope * x;
  let svg = $state<SVGSVGElement>();
  const drag = dragger(
    () => svg,
    (p) => (y = Math.min(H - 10, Math.max(10, p.y))),
  );
  const shown = $derived(kind === 'drag' ? ys : base);
  const fixed = fitLine(xs, base);
  const fixedAt = (x: number) => fixed.intercept + fixed.slope * x;
</script>

<div
  class="demo {kind}"
  data-hydrated={hydrated}
  data-step={kind === 'scroll' ? step : undefined}
  data-slope={kind === 'drag' ? line.slope.toFixed(3) : undefined}
>
  <svg
    bind:this={svg}
    class="fig"
    viewBox="0 0 {W} {H}"
    role={kind === 'drag' ? 'group' : 'img'}
    aria-label={kind === 'drag'
      ? 'Seven points and the line that fits them best. One point can be moved; the line follows it.'
      : 'Seven points; as the text scrolls, a line and then the squares of its misses appear.'}
  >
    {#if kind === 'scroll'}
      <line
        class="model demo-line"
        class:on={step >= 1}
        x1="10"
        x2={W - 10}
        y1={fixedAt(10)}
        y2={fixedAt(W - 10)}
      />
      {#each xs as x, i (i)}
        {@const miss = Math.abs(base[i] - fixedAt(x))}
        <rect
          class="demo-square"
          class:on={step >= 2}
          {x}
          y={Math.min(base[i], fixedAt(x))}
          width={miss}
          height={miss}
        />
      {/each}
    {:else}
      <line class="signal demo-line on" x1="10" x2={W - 10} y1={at(10)} y2={at(W - 10)} />
    {/if}
    {#each xs as x, i (i)}
      {#if kind === 'drag' && i === MOVABLE}
        <circle
          class="handle"
          cx={x}
          cy={y}
          r="8"
          tabindex="0"
          role="slider"
          aria-label="The movable point"
          aria-valuemin={10}
          aria-valuemax={H - 10}
          aria-valuenow={Math.round(H - y)}
          onpointerdown={drag}
          onkeydown={(e) => {
            const v = stepKey(e, H - y, { step: 4, min: 10, max: H - 10 });
            if (v !== null) y = H - v;
          }}
        />
      {:else}
        <circle class="dot ink" cx={x} cy={shown[i]} r="4" />
      {/if}
    {/each}
  </svg>

  {#if kind === 'scroll'}
    <!-- A scrollable region must be focusable so it can be scrolled from the keyboard. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="demo-steps"
      bind:this={scroller}
      onscroll={onScroll}
      tabindex="0"
      role="region"
      aria-label="Scroll this text to drive the figure"
    >
      {#each steps as text, i (i)}
        <p class:active={i === step}><b>{i + 1}.</b> {text}</p>
      {/each}
    </div>
  {:else}
    <p class="demo-note">Drag the ringed point, or focus it and use the arrow keys.</p>
  {/if}
</div>

<style>
  .demo svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .demo-line {
    opacity: 0;
    transition: opacity var(--dur) var(--ease);
  }

  .demo-line.on {
    opacity: 1;
  }

  .demo-square {
    fill: var(--signal-bg);
    stroke: var(--signal);
    stroke-width: 1;
    opacity: 0;
    transition: opacity var(--dur) var(--ease);
  }

  .demo-square.on {
    opacity: 1;
  }

  .demo-steps {
    height: 3.2rem;
    margin-top: 0.6rem;
    overflow-y: auto;
    scroll-snap-type: y mandatory;
    border-top: 1px solid var(--rule-soft);
    border-bottom: 1px solid var(--rule-soft);
  }

  .demo-steps p {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    height: 100%;
    margin: 0;
    scroll-snap-align: start;
    font-size: 0.92rem;
    color: var(--ink-faint);
  }

  .demo-steps p.active {
    color: var(--ink);
  }

  .demo-steps:focus-visible {
    outline: 2px solid var(--signal);
    outline-offset: 2px;
  }

  .demo-note {
    margin: 0.6rem 0 0;
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
</style>
