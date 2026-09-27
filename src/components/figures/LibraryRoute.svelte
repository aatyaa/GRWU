<script lang="ts">
  import { onMount } from 'svelte';

  /**
   * The route from the archive to a posterior, and which library does each step (Almost None
   * of It Is About Gravitational Waves). Code is transcribed from the GW Open Data Workshop
   * tutorials by way of the handbook From Strain to Source (stack pinned August 2026); it is
   * shown to be read, not run.
   */
  let { base }: { base: string } = $props();

  type Lib = 'gwosc' | 'gwpy' | 'PyCBC' | 'Bilby';
  interface Step {
    id: string;
    name: string;
    lib: Lib;
    does: string;
    code: string;
    trap: string;
    idea?: [string, string];
  }

  const steps: Step[] = [
    {
      id: 'find',
      name: 'Find the data',
      lib: 'gwosc',
      does: 'A thin client over the public archive: which events exist, when they arrived, and which match a physical filter. Everything is indexed by GPS time, seconds since 6 January 1980.',
      code: `from gwosc.datasets import event_gps, query_events

event_gps("GW170817")        # 1187008882.43
# every event with a component below 3 solar masses
query_events(select=["mass-1-source <= 3.0"])`,
      trap: 'GPS time has no leap seconds. You will convert to it constantly; let the library do it.',
    },
    {
      id: 'fetch',
      name: 'Fetch it and look',
      lib: 'gwpy',
      does: 'Downloads calibrated strain as a TimeSeries with plotting and spectral methods attached. The first plot worth making is the amplitude spectral density, not the trace.',
      code: `from gwpy.timeseries import TimeSeries

gps = event_gps("GW190412")
data = TimeSeries.fetch_open_data(
    "L1", int(gps) - 5, int(gps) + 5, cache=True)
asd = data.asd(fftlength=4, method="median")`,
      trap: 'cache=True, or you re-download a 4096-second file every run. method="median", so one glitch cannot redefine the spectrum.',
      idea: ['The noise spectrum', 'articles/hidden-in-the-noise/'],
    },
    {
      id: 'see',
      name: 'See a transient',
      lib: 'gwpy',
      does: 'A Q-transform: a time–frequency map with windows that adapt to frequency, which is exactly the shape of a chirp. It is how every press image of a merger is made.',
      code: `hq = hdata.q_transform(frange=(30, 500))
plot = hq.plot()
plot.gca().set_yscale("log")`,
      trap: 'A bright arc is a picture, not a detection. Nothing here has established significance.',
    },
    {
      id: 'condition',
      name: 'Condition the data',
      lib: 'PyCBC',
      does: 'High-pass away the seismic wall, resample to what the signal needs, and crop the edges where the filter was still filling up.',
      code: `from pycbc.catalog import Merger
from pycbc.filter import resample_to_delta_t, highpass

strain = Merger("GW150914").strain("H1")
strain = highpass(strain, 15.0)
strain = resample_to_delta_t(strain, 1.0 / 2048)
conditioned = strain.crop(2, 2)`,
      trap: 'Skip the crop and you will find a magnificent signal that is entirely your own high-pass filter.',
    },
    {
      id: 'psd',
      name: 'Measure the noise',
      lib: 'PyCBC',
      does: 'Estimates the noise spectrum, matches its resolution to the data, and bounds how long 1/PSD acts as a filter. This is whitening, in code.',
      code: `from pycbc.psd import interpolate, inverse_spectrum_truncation

psd = conditioned.psd(4)
psd = interpolate(psd, conditioned.delta_f)
psd = inverse_spectrum_truncation(
    psd, int(4 * conditioned.sample_rate),
    low_frequency_cutoff=15)`,
      trap: 'Without the truncation, 1/PSD can smear one glitch across the whole stretch of data.',
      idea: ['Whitening is a change of ruler', 'articles/hidden-in-the-noise/#m-whiten'],
    },
    {
      id: 'template',
      name: 'Build the template',
      lib: 'PyCBC',
      does: 'Asks LALSuite, the C library underneath, for a waveform model: the approximant names which one. The template must share the data’s length and sample rate.',
      code: `from pycbc.waveform import get_td_waveform

hp, hc = get_td_waveform(approximant="SEOBNRv4_opt",
    mass1=36, mass2=36,
    delta_t=conditioned.delta_t, f_lower=20)
hp.resize(len(conditioned))
template = hp.cyclic_time_shift(hp.start_time)`,
      trap: 'The approximant is not a detail. It is the strongest assumption in the analysis.',
      idea: ['Waveform models', '#waveform-models'],
    },
    {
      id: 'search',
      name: 'Slide it along',
      lib: 'PyCBC',
      does: 'The matched filter, in one call. On GW150914 in Hanford it peaks at SNR 19.6 at the moment of the event.',
      code: `from pycbc.filter import matched_filter

snr = matched_filter(template, conditioned,
    psd=psd, low_frequency_cutoff=20)
snr = snr.crop(4 + 4, 4)
peak = abs(snr).numpy().argmax()`,
      trap: 'A peak is a candidate. A χ² test, a second detector and time slides make it a detection.',
      idea: ['The matched filter', 'articles/hidden-in-the-noise/'],
    },
    {
      id: 'measure',
      name: 'Measure the source',
      lib: 'Bilby',
      does: 'Sets up priors, a waveform generator and a likelihood, then hands them to a sampler (dynesty) that returns a posterior over every parameter at once.',
      code: `result = bilby.run_sampler(
    likelihood, prior, sampler="dynesty",
    nlive=250, dlogz=1.)   # demonstration settings
result.plot_corner(prior=True)`,
      trap: 'Fixing a parameter is an infinitely strong prior. And nlive=250 is for a tutorial: a published run uses far more and takes days.',
      idea: ['Found, then measured', 'articles/from-strain-to-source/'],
    },
  ];

  let selected = $state('template');
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });
  const step = $derived(steps.find((s) => s.id === selected) ?? steps[0]);
  const href = (path: string) => (path.startsWith('#') ? path : `${base}${path}`);
</script>

<div class="library-route" data-hydrated={hydrated} data-selected={selected} data-lib={step.lib}>
  <ol class="route">
    {#each steps as s, i (s.id)}
      <li>
        <button
          type="button"
          class="stop"
          data-lib={s.lib}
          aria-pressed={selected === s.id}
          onclick={() => (selected = s.id)}
        >
          <span class="stop__n">{i + 1}</span>
          <span class="stop__name">{s.name}</span>
          <span class="stop__lib">{s.lib}</span>
        </button>
      </li>
    {/each}
  </ol>

  <div class="panel" aria-live="polite">
    <p class="panel__head"><span class="lib" data-lib={step.lib}>{step.lib}</span> {step.name}</p>
    <p>{step.does}</p>
    <!-- Focusable so a long line can be scrolled from the keyboard on a narrow screen. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <pre class="code" tabindex="0" aria-label={`Code: ${step.name}`}><code>{step.code}</code></pre>
    <p class="trap"><b>The trap.</b> {step.trap}</p>
    {#if step.idea}
      <p class="idea">The idea underneath: <a href={href(step.idea[1])}>{step.idea[0]} →</a></p>
    {/if}
  </div>
</div>

<style>
  .library-route {
    display: grid;
    grid-template-columns: minmax(0, 15rem) minmax(0, 1fr);
    gap: 1.2rem;
    width: 100%;
  }

  @media (max-width: 720px) {
    .library-route {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .route {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .stop {
    display: grid;
    grid-template-columns: 1.6rem 1fr auto;
    gap: 0.5rem;
    align-items: center;
    width: 100%;
    padding: 0.5rem 0.6rem;
    border: 1px solid var(--rule-soft);
    border-radius: 8px;
    background: var(--surface);
    font: inherit;
    font-size: 0.9rem;
    text-align: left;
    color: var(--ink);
    cursor: pointer;
  }

  .stop[aria-pressed='true'] {
    border-color: var(--signal);
    background: var(--signal-bg);
  }

  .stop:focus-visible {
    outline: 2px solid var(--signal);
    outline-offset: 2px;
  }

  .stop__n {
    display: grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    border: 1px solid var(--rule);
    border-radius: 50%;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .stop__lib {
    font-size: 0.75rem;
    color: var(--ink-soft);
  }

  .panel {
    min-width: 0;
    padding: 1rem 1.2rem;
    border: 1px solid var(--rule-soft);
    border-radius: 12px;
    background: var(--surface);
  }

  .panel p {
    margin: 0 0 0.7rem;
  }

  .panel__head {
    font-weight: 700;
  }

  .lib {
    display: inline-block;
    margin-right: 0.4rem;
    padding: 0.1rem 0.55rem;
    border-radius: 999px;
    background: var(--signal-bg);
    font-size: 0.8rem;
  }

  .code {
    overflow-x: auto;
    margin: 0 0 0.8rem;
    padding: 0.8rem 1rem;
    border-radius: 8px;
    background: var(--surface-2);
    font-family: var(--f-mono);
    font-size: 0.8rem;
    line-height: 1.55;
  }

  .trap {
    padding-left: 0.8rem;
    border-left: 3px solid var(--bias);
    font-size: 0.93rem;
  }

  .idea {
    font-size: 0.93rem;
  }
</style>
