<script lang="ts">
  import { onMount } from 'svelte';
  import { gpsToUtc, leapSecondsAt, utcToGps } from '~/lib/time/gps';

  /**
   * The archive's clock (Run It Yourself): convert between UTC and GPS time, the seconds since
   * 6 January 1980 that every gravitational-wave file is indexed by. GPS ignores the leap
   * seconds UTC inserts, so it runs ahead, by 18 seconds since 2017.
   */
  const EVENTS = [
    { name: 'GW150914', utc: '2015-09-14 09:50:45.4' },
    { name: 'GW170817', utc: '2017-08-17 12:41:04.4' },
    { name: 'GW190412', utc: '2019-04-12 05:30:44.2' },
    { name: 'GW190521', utc: '2019-05-21 03:02:29.4' },
  ];

  const parseUtc = (text: string): number | null => {
    const m = text
      .trim()
      .match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)(?:\s*UTC|Z)?$/i);
    if (!m) return null;
    const ms = Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00Z`) + Number(m[6]) * 1000;
    return Number.isFinite(ms) && ms >= Date.UTC(1980, 0, 6) ? ms : null;
  };
  const formatUtc = (ms: number) => {
    const iso = new Date(ms).toISOString();
    const frac = iso.slice(19, 23) === '.000' ? '' : iso.slice(19, 21);
    return `${iso.slice(0, 10)} ${iso.slice(11, 19)}${frac}`;
  };
  const formatGps = (gps: number) => (Number.isInteger(gps) ? String(gps) : gps.toFixed(1));

  let utcText = $state(EVENTS[0].utc);
  let gpsText = $state(formatGps(utcToGps(parseUtc(EVENTS[0].utc) ?? 0)));
  let utcMs = $state(parseUtc(EVENTS[0].utc) ?? 0);
  let problem = $state('');
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  const gps = $derived(utcToGps(utcMs));
  const leap = $derived(leapSecondsAt(utcMs));

  function fromUtc() {
    const ms = parseUtc(utcText);
    if (ms === null) {
      problem = 'Write a UTC time after 6 January 1980 as YYYY-MM-DD HH:MM:SS.';
      return;
    }
    problem = '';
    utcMs = ms;
    gpsText = formatGps(utcToGps(ms));
  }

  function fromGps() {
    const value = Number(gpsText);
    if (!gpsText.trim() || !Number.isFinite(value) || value < 0) {
      problem = 'Write a GPS time as a number of seconds, such as 1126259462.4.';
      return;
    }
    problem = '';
    utcMs = gpsToUtc(value);
    utcText = formatUtc(utcMs);
  }

  function pick(utc: string) {
    utcText = utc;
    fromUtc();
  }
</script>

<div class="gps-clock" data-hydrated={hydrated} data-gps={formatGps(gps)} data-leap={leap}>
  <div class="events" role="group" aria-label="Events">
    {#each EVENTS as event (event.name)}
      <button type="button" class:on={utcText === event.utc} onclick={() => pick(event.utc)}>
        {event.name}
      </button>
    {/each}
  </div>
  <div class="fields">
    <label>
      <span>UTC</span>
      <input bind:value={utcText} oninput={fromUtc} spellcheck="false" autocomplete="off" />
    </label>
    <label>
      <span>GPS time</span>
      <input
        bind:value={gpsText}
        oninput={fromGps}
        inputmode="decimal"
        spellcheck="false"
        autocomplete="off"
      />
    </label>
  </div>
  {#if problem}
    <p class="problem" role="alert">{problem}</p>
  {/if}
  <dl class="readouts">
    <div>
      <dt>GPS seconds</dt>
      <dd>{formatGps(gps)}</dd>
    </div>
    <div>
      <dt>GPS ahead of UTC by</dt>
      <dd>{leap} leap seconds</dd>
    </div>
    <div>
      <dt>Unix time, for comparison</dt>
      <dd>{formatGps(utcMs / 1000)}</dd>
    </div>
  </dl>
</div>

<style>
  .gps-clock {
    width: 100%;
    padding: var(--space-4);
    border: 1px solid var(--rule);
    border-radius: 10px;
    background: var(--surface);
  }

  .events {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: var(--space-4);
  }

  .events button {
    padding: 0.3rem 0.7rem;
    border: 1px solid var(--rule);
    border-radius: 999px;
    background: var(--ground);
    color: var(--ink);
    font: inherit;
    font-family: var(--f-mono);
    font-size: 0.8rem;
    cursor: pointer;
  }

  .events button.on {
    border-color: var(--signal);
    background: var(--signal-bg);
  }

  .fields {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: var(--space-3);
  }

  .fields label {
    display: grid;
    gap: 0.25rem;
    font-size: var(--text-sm);
    color: var(--ink-soft);
  }

  .fields input {
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--rule);
    border-radius: 6px;
    background: var(--ground);
    color: var(--ink);
    font-family: var(--f-mono);
    font-size: 0.9rem;
  }

  .problem {
    margin: var(--space-3) 0 0;
    color: var(--bias);
    font-size: var(--text-sm);
  }

  .readouts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.5rem 1rem;
    margin: var(--space-4) 0 0;
  }

  .readouts div {
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--rule-soft);
    border-radius: 8px;
    background: var(--ground);
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
