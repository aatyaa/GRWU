<script lang="ts">
  import { onMount } from 'svelte';
  import type { ChirpMassScan } from '~/lib/articles/route';
  import { chirpMassOf, newtonianChirp } from '~/lib/dsp/chirp';
  import { svgPoint } from '~/lib/figure/pointer';

  /**
   * What the data allows for the two masses (From Strain to Source). The matched-filter score
   * across chirp mass was computed at build time on the toy chirp; with a flat prior on the
   * two masses, the posterior is a narrow ridge of constant chirp mass. Drag the pair of
   * masses and compare its template with the best one.
   */
  let { scan }: { scan: ChirpMassScan } = $props();

  const M_MIN = 10;
  const M_MAX = 60;
  const CELL = 0.25;
  const N = Math.round((M_MAX - M_MIN) / CELL);

  const best = $derived(Math.max(...scan.snr));
  const bestMc = $derived(scan.mc[scan.snr.indexOf(best)]);
  const floor = $derived(Math.min(...scan.snr));
  /** Matched-filter score at any chirp mass, interpolated; the floor outside the scan. */
  const snrAt = (mc: number) => {
    const { mc: xs, snr: ys } = scan;
    if (mc <= xs[0] || mc >= xs[xs.length - 1]) return floor;
    let i = 1;
    while (xs[i] < mc) i++;
    const u = (mc - xs[i - 1]) / (xs[i] - xs[i - 1]);
    return ys[i - 1] * (1 - u) + ys[i] * u;
  };
  // ln L = ρ²/2, relative to the best.
  const logRel = (mc: number) => (snrAt(mc) ** 2 - best ** 2) / 2;

  // Posterior on the grid (flat prior, m2 ≤ m1), and its marginals.
  const grid = $derived.by(() => {
    const p = new Float64Array(N * N);
    const m1Marg = new Float64Array(N);
    const m2Marg = new Float64Array(N);
    let total = 0;
    for (let i = 0; i < N; i++) {
      const m1 = M_MIN + (i + 0.5) * CELL;
      for (let j = 0; j <= i; j++) {
        const m2 = M_MIN + (j + 0.5) * CELL;
        const v = Math.exp(logRel(chirpMassOf(m1, m2)));
        p[j * N + i] = v;
        m1Marg[i] += v;
        m2Marg[j] += v;
        total += v;
      }
    }
    // The chirp-mass posterior: every cell's weight, ordered by its chirp mass.
    const cells: [number, number][] = [];
    for (let i = 0; i < N; i++) {
      for (let j = 0; j <= i; j++) {
        const v = p[j * N + i];
        if (v > 0) cells.push([chirpMassOf(M_MIN + (i + 0.5) * CELL, M_MIN + (j + 0.5) * CELL), v]);
      }
    }
    cells.sort((a, b) => a[0] - b[0]);
    let c = 0;
    let mcLo = cells[0][0];
    let mcHi = cells[cells.length - 1][0];
    let seenLo = false;
    for (const [m, v] of cells) {
      c += v / total;
      if (!seenLo && c >= 0.05) {
        mcLo = m;
        seenLo = true;
      }
      if (c >= 0.95) {
        mcHi = m;
        break;
      }
    }
    return { p, m1Marg, m2Marg, total, mcRange: [mcLo, mcHi] };
  });

  const interval = (marg: Float64Array, total: number) => {
    let c = 0;
    let lo = M_MIN;
    let hi = M_MAX;
    let found = false;
    for (let i = 0; i < marg.length; i++) {
      c += marg[i] / total;
      if (!found && c >= 0.05) {
        lo = M_MIN + (i + 0.5) * CELL;
        found = true;
      }
      if (c >= 0.95) {
        hi = M_MIN + (i + 0.5) * CELL;
        break;
      }
    }
    return [lo, hi];
  };
  const m1Range = $derived(interval(grid.m1Marg, grid.total));
  const m2Range = $derived(interval(grid.m2Marg, grid.total));

  let m1 = $state(42);
  let m2 = $state(26);
  const mc = $derived(chirpMassOf(m1, m2));
  const rel = $derived(logRel(mc));

  let hydrated = $state(false);
  let heat = $state('');
  onMount(() => {
    hydrated = true;
    const canvas = document.createElement('canvas');
    canvas.width = N;
    canvas.height = N;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(N, N);
    const max = Math.max(...grid.p);
    const color = getComputedStyle(document.documentElement).getPropertyValue('--signal').trim();
    const rgb = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
    const [r, g, b] = rgb ? [1, 2, 3].map((k) => parseInt(rgb[k], 16)) : [229, 163, 67];
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const v = grid.p[j * N + i] / max;
        // Rows run top to bottom, so the heaviest m2 is at the top.
        const k = ((N - 1 - j) * N + i) * 4;
        img.data[k] = r;
        img.data[k + 1] = g;
        img.data[k + 2] = b;
        img.data[k + 3] = Math.round(255 * Math.min(1, v ** 0.5));
      }
    }
    ctx.putImageData(img, 0, 0);
    heat = canvas.toDataURL();
  });

  let width = $state(640);
  const side = $derived(Math.max(200, Math.min(width - 110, 400)));
  const X0 = 46;
  const Y0 = 64;
  const mx = (m: number) => X0 + ((m - M_MIN) / (M_MAX - M_MIN)) * side;
  const my = (m: number) => Y0 + side - ((m - M_MIN) / (M_MAX - M_MIN)) * side;
  const WAVE_Y = $derived(Y0 + side + 60);
  const H = $derived(WAVE_Y + 130);

  const marginalPath = (marg: Float64Array, horizontal: boolean) => {
    const max = Math.max(...marg);
    let d = '';
    for (let i = 0; i < marg.length; i++) {
      const m = M_MIN + (i + 0.5) * CELL;
      const h = (marg[i] / max) * 38;
      d += horizontal
        ? `${i ? 'L' : 'M'}${mx(m).toFixed(1)},${(Y0 - 8 - h).toFixed(1)}`
        : `${i ? 'L' : 'M'}${(X0 + side + 8 + h).toFixed(1)},${my(m).toFixed(1)}`;
    }
    return d;
  };

  // The last 0.3 s of the template at the chosen masses, against the best template.
  const WAVE_N = 1229;
  const FS = 4096;
  const wave = (chirpMass: number) =>
    newtonianChirp({
      sampleRate: FS,
      n: WAVE_N,
      mergerTime: WAVE_N / FS,
      chirpMass,
      fStart: 20,
      fEnd: 250,
      taperStart: 0,
    });
  const bestWave = $derived(wave(bestMc));
  const yourWave = $derived(wave(mc));
  const wavePeak = $derived(Math.max(...bestWave.map(Math.abs)));
  const wavePath = (h: Float64Array) => {
    let d = '';
    for (let i = 0; i < h.length; i += 2) {
      const x = X0 + (i / (h.length - 1)) * (width - X0 - 12);
      const y = WAVE_Y + 50 - (h[i] / wavePeak) * 40;
      d += `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    }
    return d;
  };

  let svg = $state<SVGSVGElement>();
  const toMass = (px: number, py: number) => {
    const a = M_MIN + ((px - X0) / side) * (M_MAX - M_MIN);
    const b = M_MIN + ((Y0 + side - py) / side) * (M_MAX - M_MIN);
    const clampM = (v: number) => Math.min(M_MAX, Math.max(M_MIN, v));
    m1 = clampM(a);
    m2 = Math.min(clampM(b), m1);
  };
  function drag(event: PointerEvent) {
    if (!svg || event.button !== 0) return;
    const target = event.currentTarget as Element;
    target.setPointerCapture(event.pointerId);
    event.preventDefault();
    const move = (e: PointerEvent) => {
      if (!svg) return;
      const p = svgPoint(svg, e);
      toMass(p.x, p.y);
    };
    move(event);
    const onMove = (e: Event) => move(e as PointerEvent);
    const up = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', up);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', up);
  }

  const relText = $derived(
    rel > -0.5
      ? 'as good as the best'
      : rel > -Math.log(1e6)
        ? `1 in ${Math.round(Math.exp(-rel)).toLocaleString('en')}`
        : `1 in 10^${Math.round(-rel / Math.LN10)}`,
  );
</script>

<div
  class="posterior"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-mc={mc.toFixed(2)}
  data-rel={rel.toFixed(1)}
>
  <svg
    bind:this={svg}
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="group"
    aria-label={`The posterior for the two masses: a narrow ridge where the chirp mass is about ${bestMc.toFixed(1)} solar masses. The heavier mass could be anywhere from ${m1Range[0].toFixed(0)} to ${m1Range[1].toFixed(0)} and the lighter from ${m2Range[0].toFixed(0)} to ${m2Range[1].toFixed(0)}. Your pair, ${m1.toFixed(1)} and ${m2.toFixed(1)}, has chirp mass ${mc.toFixed(2)}.`}
  >
    <text class="caps" x={X0} y="14">each mass on its own: broad</text>
    <path class="marginal" d={marginalPath(grid.m1Marg, true)} />
    <path class="marginal" d={marginalPath(grid.m2Marg, false)} />

    <rect class="plot" x={X0} y={Y0} width={side} height={side} />
    {#if heat}
      <image
        href={heat}
        x={X0}
        y={Y0}
        width={side}
        height={side}
        preserveAspectRatio="none"
        style="image-rendering: pixelated"
      />
    {/if}
    <line class="grid" x1={mx(M_MIN)} y1={my(M_MIN)} x2={mx(M_MAX)} y2={my(M_MAX)} />
    <text x={mx(52)} y={my(55)} text-anchor="middle">m₂ = m₁</text>
    {#each [10, 20, 30, 40, 50, 60] as m (m)}
      <text x={mx(m)} y={Y0 + side + 16} text-anchor="middle">{m}</text>
      <text x={X0 - 8} y={my(m)} dy="4" text-anchor="end">{m}</text>
    {/each}
    <text x={X0 + side} y={Y0 + side + 32} text-anchor="end">heavier mass m₁ (M☉)</text>
    <text x={X0 + 4} y={Y0 + 14}>lighter mass m₂ (M☉)</text>
    <text class="signal" x={mx(40)} y={my(14)}>the ridge: narrow</text>

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <rect class="hit" x={X0} y={Y0} width={side} height={side} onpointerdown={drag} />
    <circle class="handle" cx={mx(m1)} cy={my(m2)} r="7" />

    <text class="caps" x={X0} y={WAVE_Y}>the last 0.3 s of the template at your masses</text>
    <path class="best-wave" d={wavePath(bestWave)} />
    <path class="your-wave" d={wavePath(yourWave)} />
    <text x={width - 12} y={WAVE_Y + 118} text-anchor="end">
      solid: the best fit · dashed: your masses
    </text>
  </svg>

  <div class="controls">
    <label class="slider">
      <span>Heavier mass <b>{m1.toFixed(1)} M☉</b></span>
      <input
        type="range"
        min={M_MIN}
        max={M_MAX}
        step="0.1"
        value={m1}
        oninput={(e) => {
          m1 = Number(e.currentTarget.value);
          m2 = Math.min(m2, m1);
        }}
      />
    </label>
    <label class="slider">
      <span>Lighter mass <b>{m2.toFixed(1)} M☉</b></span>
      <input
        type="range"
        min={M_MIN}
        max={M_MAX}
        step="0.1"
        value={m2}
        oninput={(e) => (m2 = Math.min(Number(e.currentTarget.value), m1))}
      />
    </label>
  </div>
  <dl class="readouts">
    <div>
      <dt>chirp mass of your pair</dt>
      <dd>{mc.toFixed(2)} M☉</dd>
    </div>
    <div>
      <dt>how likely, against the best</dt>
      <dd class:bad={rel < -4.5}>{relText}</dd>
    </div>
    <div>
      <dt>chirp mass, 90% of the posterior</dt>
      <dd>{grid.mcRange[0].toFixed(2)}–{grid.mcRange[1].toFixed(2)} M☉ · narrow</dd>
    </div>
    <div>
      <dt>heavier mass, 90%</dt>
      <dd>{m1Range[0].toFixed(0)}–{m1Range[1].toFixed(0)} M☉ · broad</dd>
    </div>
  </dl>
</div>

<style>
  .posterior {
    width: 100%;
  }

  .plot {
    fill: var(--surface);
    stroke: var(--rule);
  }

  .marginal {
    fill: none;
    stroke: var(--signal);
    stroke-width: 1.5;
  }

  .hit {
    fill: transparent;
    cursor: crosshair;
    touch-action: none;
  }

  .handle {
    pointer-events: none;
  }

  .best-wave {
    fill: none;
    stroke: var(--signal);
    stroke-width: 1.6;
  }

  .your-wave {
    fill: none;
    stroke: var(--model);
    stroke-width: 1.6;
    stroke-dasharray: 5 4;
  }

  .slider {
    display: grid;
    flex: 1 1 12rem;
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

  .readouts dd.bad {
    color: var(--bias);
  }
</style>
