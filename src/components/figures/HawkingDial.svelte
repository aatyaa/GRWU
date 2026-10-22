<script lang="ts" module>
  const DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  function superscript(n: number): string {
    return String(n).replace(/\d/g, (d) => DIGITS[Number(d)]);
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import { scientific } from '~/lib/format';
  import { M_SUN_KG } from '~/lib/physics/blackhole';
  import {
    T_CMB,
    entropy,
    evaporationTime,
    hawkingTemperature,
    massAtTemperature,
  } from '~/lib/physics/horizon';
  import { JULIAN_YEAR } from '~/lib/physics/relativity';

  /**
   * Hawking temperature against mass (Only Ever Forwards), both on log scales: a straight line
   * falling as 1/M, against the 2.7 K of the microwave sky. Above the sky's temperature a hole
   * radiates more than it absorbs and evaporates; below it, which is every hole yet found, it
   * absorbs more and grows. The reader picks the mass.
   */
  const LOG_MIN = 8;
  const LOG_MAX = 41;
  const T_MIN = -19;
  const T_MAX = 16;
  // Labels alternate above and below the line so that neighbours do not collide.
  const MARKS = [
    { label: 'Moon', kg: 7.346e22, below: true },
    { label: 'Sun', kg: M_SUN_KG, below: false },
    { label: 'GW250114', kg: 62.7 * M_SUN_KG, below: true },
    { label: 'Sgr A*', kg: 4.3e6 * M_SUN_KG, below: false },
    { label: 'M87*', kg: 6.5e9 * M_SUN_KG, below: true },
  ];

  let logMass = $state(Math.round(Math.log10(M_SUN_KG) * 10) / 10);
  let width = $state(600);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  const kg = $derived(10 ** logMass);
  const temp = $derived(hawkingTemperature(kg));
  const hotter = $derived(temp > T_CMB);
  const crossover = massAtTemperature(T_CMB);

  const H = 300;
  const PAD = { l: 52, r: 18, t: 30, b: 44 };
  const x = $derived(
    (lg: number) => PAD.l + ((lg - LOG_MIN) / (LOG_MAX - LOG_MIN)) * (width - PAD.l - PAD.r),
  );
  const y = (lt: number) => PAD.t + ((T_MAX - lt) / (T_MAX - T_MIN)) * (H - PAD.t - PAD.b);
  const lt = (lg: number) => Math.log10(hawkingTemperature(10 ** lg));
  const sky = Math.log10(T_CMB);

  const years = (s: number) => s / JULIAN_YEAR;
  const fate = $derived(
    hotter
      ? `evaporates in ${scientific(years(evaporationTime(kg)), 0)} years`
      : 'absorbs more than it emits, and grows',
  );
  /** Solar masses, plainly between a thousandth and ten thousand, in powers of ten outside. */
  const sun = (k: number) => {
    const v = k / M_SUN_KG;
    return v >= 1e-3 && v < 1e4 ? String(Number(v.toPrecision(2))) : scientific(v, 1);
  };
</script>

<div
  class="hawking-dial"
  bind:clientWidth={width}
  data-hydrated={hydrated}
  data-logmass={logMass.toFixed(1)}
  data-temp={temp.toExponential(3)}
  data-fate={hotter ? 'evaporating' : 'growing'}
>
  <svg
    class="fig"
    viewBox="0 0 {width} {H}"
    {width}
    height={H}
    role="img"
    aria-label={`Hawking temperature against mass on logarithmic scales, a straight line falling as one over the mass, crossing the 2.7 kelvin of the microwave sky at ${scientific(crossover, 1)} kilograms, about the mass of the Moon. A hole of ${scientific(kg, 1)} kilograms is at ${scientific(temp, 1)} kelvin and ${fate}.`}
  >
    <text class="caps" x={PAD.l} y="16">temperature of a black hole, kelvin</text>
    <rect
      class="hot"
      x={PAD.l}
      y={PAD.t}
      width={x(Math.log10(crossover)) - PAD.l}
      height={H - PAD.t - PAD.b}
    />
    {#each [-15, -10, -5, 0, 5, 10, 15] as t (t)}
      <line class="grid" x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} />
      <text x={PAD.l - 6} y={y(t) + 4} text-anchor="end"
        >10{t < 0 ? '⁻' : ''}{superscript(Math.abs(t))}</text
      >
    {/each}
    <line class="sky" x1={PAD.l} x2={width - PAD.r} y1={y(sky)} y2={y(sky)} />
    <text class="signal halo" x={PAD.l + 6} y={y(sky) - 6}>the sky, 2.7 K</text>
    <line class="model" x1={x(LOG_MIN)} y1={y(lt(LOG_MIN))} x2={x(LOG_MAX)} y2={y(lt(LOG_MAX))} />
    <text class="halo" x={PAD.l + 6} y={H - PAD.b - 8}>hotter than the sky: evaporates</text>
    <text class="halo" x={width - PAD.r - 4} y={y(sky) + 18} text-anchor="end">colder: grows</text>
    {#each MARKS as m (m.label)}
      {@const lg = Math.log10(m.kg)}
      <circle class="mark" cx={x(lg)} cy={y(lt(lg))} r="3" />
      <text
        class="halo"
        x={x(lg) + (m.below ? -6 : 6)}
        y={y(lt(lg)) + (m.below ? 16 : -8)}
        text-anchor={m.below ? 'end' : 'start'}>{m.label}</text
      >
    {/each}
    <circle class="dot" cx={x(logMass)} cy={y(lt(logMass))} r="6" />
    <line class="axis" x1={PAD.l} x2={width - PAD.r} y1={H - PAD.b} y2={H - PAD.b} />
    {#each [10, 15, 20, 25, 30, 35, 40] as lg (lg)}
      <text x={x(lg)} y={H - PAD.b + 16} text-anchor="middle">10{superscript(lg)}</text>
    {/each}
    <text x={width - PAD.r} y={H - 6} text-anchor="end">mass, kg</text>
  </svg>

  <div class="controls">
    <label class="slider">
      <span>Mass of the hole <b>{scientific(kg, 1)} kg</b> ({sun(kg)} M☉)</span>
      <input type="range" min={LOG_MIN} max={LOG_MAX} step="0.1" bind:value={logMass} />
    </label>
  </div>
  <dl class="readouts">
    <div>
      <dt>temperature</dt>
      <dd>{scientific(temp, 1)} K</dd>
    </div>
    <div>
      <dt>entropy</dt>
      <dd>{scientific(entropy(kg), 1)} k<sub>B</sub></dd>
    </div>
    <div>
      <dt>in a 2.7 K sky, it</dt>
      <dd>{fate}</dd>
    </div>
  </dl>
</div>

<style>
  .hawking-dial {
    width: 100%;
  }

  .fig text.halo {
    paint-order: stroke;
    stroke: var(--ground);
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  .hot {
    fill: color-mix(in srgb, var(--noise) 10%, transparent);
  }

  .sky {
    stroke: var(--signal);
    stroke-width: 1.5;
  }

  .mark {
    fill: var(--surface);
    stroke: var(--ink-soft);
    stroke-width: 1.4;
  }

  .slider {
    display: grid;
    flex: 1 1 14rem;
    gap: 0.25rem;
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
