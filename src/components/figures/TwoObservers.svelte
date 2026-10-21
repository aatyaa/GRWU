<script lang="ts">
  import { onMount } from 'svelte';
  import { dragger, stepKey } from '~/lib/figure/pointer';
  import { boost, interval } from '~/lib/physics/relativity';

  /**
   * One quantity survives disagreement (The Straightest Path). Two events, 3 light-years and
   * 5 years apart for observer A. Observer B, moving at βc, writes different separations for
   * the same pair, yet everyone's numbers for the second event lie on one hyperbola: the
   * interval −c²Δt² + Δx² is the same for all. Drag the event, or set B's speed.
   */
  const DX = 3;
  const CDT = 5;
  const S2 = interval(DX, CDT); // −16
  const TAU = Math.sqrt(-S2);
  const ETA0 = Math.atanh(DX / CDT);

  let beta = $state(0);
  let width = $state(600);
  let svg: SVGSVGElement | undefined = $state();
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  const seen = $derived(boost(DX, CDT, beta));

  const H = $derived(Math.min(400, Math.max(300, width * 0.62)));
  const PAD = { l: 34, r: 16, t: 26, b: 44 };
  const X = { lo: -6, hi: 6 };
  const T = { lo: 0, hi: 9 };
  const unit = $derived(
    Math.min((width - PAD.l - PAD.r) / (X.hi - X.lo), (H - PAD.t - PAD.b) / (T.hi - T.lo)),
  );
  const x0 = $derived(PAD.l + (width - PAD.l - PAD.r) / 2);
  const y0 = $derived(H - PAD.b);
  const px = (v: number) => x0 + v * unit;
  const py = (v: number) => y0 - v * unit;
  const hyperbola = $derived(
    Array.from({ length: 121 }, (_, i) => {
      const x = X.lo + ((X.hi - X.lo) * i) / 120;
      const ct = Math.sqrt(TAU * TAU + x * x);
      return `${i ? 'L' : 'M'}${px(x).toFixed(1)},${py(Math.min(ct, T.hi)).toFixed(1)}`;
    }).join(''),
  );

  // Dragging the event along the hyperbola sets B's speed: in B's frame the event sits at
  // rapidity ETA0 − ηB, so x' = τ sinh(ETA0 − ηB).
  const setFromX = (x: number) => {
    const eta = ETA0 - Math.asinh(x / TAU);
    beta = Math.max(-0.9, Math.min(0.9, Math.tanh(eta)));
  };
  const drag = dragger(
    () => svg,
    (p) => setFromX((p.x - x0) / unit),
  );
  function onKey(event: KeyboardEvent) {
    const next = stepKey(event, -beta, { step: 0.02, min: -0.9, max: 0.9 });
    if (next !== null) beta = -next;
  }
  const fmt = (v: number) => (Math.abs(v) < 0.005 ? '0.00' : v.toFixed(2));
  /** A number with a proper minus sign, for display. */
  const minus = (v: number, digits = 0) => v.toFixed(digits).replace('-', '−');
</script>

<div
  class="two-observers"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-beta={beta.toFixed(2)}
  data-dx={fmt(seen.dx)}
  data-cdt={fmt(seen.cdt)}
  data-interval={interval(seen.dx, seen.cdt).toFixed(2)}
>
  <svg
    bind:this={svg}
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="group"
    aria-label={`For an observer moving at ${beta.toFixed(2)} c, the second event is ${fmt(seen.dx)} light-years away and ${fmt(seen.cdt)} years later. The interval, Δx² − c²Δt², is ${interval(seen.dx, seen.cdt).toFixed(2)} for every observer.`}
  >
    <text class="caps" x={PAD.l} y="14">two events, as one observer writes them</text>
    <line class="axis" x1={px(X.lo)} x2={px(X.hi)} y1={py(0)} y2={py(0)} />
    <line class="axis" x1={px(0)} x2={px(0)} y1={py(0)} y2={py(T.hi)} />
    <text x={px(X.hi)} y={py(0) + 34} text-anchor="end">x, light-years</text>
    <text x={px(0) + 6} y={py(T.hi) + 10}>ct, years</text>
    {#each [-4, -2, 2, 4] as v (v)}
      <text x={px(v)} y={py(0) + 18} text-anchor="middle">{v}</text>
    {/each}
    {#each [2, 6] as v (v)}
      <text x={px(0) - 6} y={py(v) + 4} text-anchor="end">{v}</text>
    {/each}
    <line class="light" x1={px(0)} y1={py(0)} x2={px(T.hi)} y2={py(T.hi)} />
    <line class="light" x1={px(0)} y1={py(0)} x2={px(-T.hi)} y2={py(T.hi)} />
    <text class="halo" x={px(-3.6)} y={py(3.2)} text-anchor="end">light</text>

    <path class="model" d={hyperbola} />
    <text class="halo" x={px(-3.4)} y={py(8.2)} text-anchor="middle">
      Δx² − c²Δt² = {minus(S2)}
    </text>

    <line class="guide" x1={px(seen.dx)} x2={px(seen.dx)} y1={py(0)} y2={py(seen.cdt)} />
    <line class="guide" x1={px(0)} x2={px(seen.dx)} y1={py(seen.cdt)} y2={py(seen.cdt)} />
    <line class="worldline" x1={px(0)} y1={py(0)} x2={px(seen.dx)} y2={py(seen.cdt)} />
    <circle class="dot ink" cx={px(0)} cy={py(0)} r="5" />
    <text class="ink halo" x={px(0) + 8} y={py(0) - 8}>first event</text>
    <circle
      class="handle"
      cx={px(seen.dx)}
      cy={py(seen.cdt)}
      r="8"
      tabindex="0"
      role="slider"
      aria-label="The second event, as observer B sees it; moving it changes B's speed"
      aria-valuemin={-0.9}
      aria-valuemax={0.9}
      aria-valuenow={Number(beta.toFixed(2))}
      aria-valuetext={`observer B at ${beta.toFixed(2)} c`}
      onpointerdown={drag}
      onkeydown={onKey}
    />
    <text
      class="signal halo"
      x={px(seen.dx) + (seen.dx > 3 ? -12 : 12)}
      y={py(seen.cdt) - 10}
      text-anchor={seen.dx > 3 ? 'end' : 'start'}>second event</text
    >
  </svg>

  <div class="controls">
    <label class="slider">
      <span
        >Observer B's speed <b>{beta.toFixed(2)} c</b>{Math.abs(beta) < 0.005
          ? ' (this is A)'
          : ''}</span
      >
      <input type="range" min="-0.9" max="0.9" step="0.01" bind:value={beta} />
    </label>
  </div>
  <dl class="readouts">
    <div>
      <dt>distance between them</dt>
      <dd>{fmt(seen.dx)} light-years</dd>
    </div>
    <div>
      <dt>time between them</dt>
      <dd>{fmt(seen.cdt)} years</dd>
    </div>
    <div>
      <dt>Δx² − c²Δt²</dt>
      <dd class="same">{minus(interval(seen.dx, seen.cdt), 2)}, always</dd>
    </div>
  </dl>
</div>

<style>
  .two-observers {
    width: 100%;
  }

  .fig text.halo {
    paint-order: stroke;
    stroke: var(--ground);
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  .light {
    stroke: var(--rule);
    stroke-width: 1;
    stroke-dasharray: 2 3;
  }

  .guide {
    stroke: var(--ink-faint);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }

  .worldline {
    stroke: var(--signal);
    stroke-width: 2;
  }

  .slider {
    display: grid;
    flex: 1 1 14rem;
    gap: 0.25rem;
    font-size: var(--text-sm);
    color: var(--ink-soft);
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

  .readouts dd.same {
    color: var(--ok);
  }
</style>
