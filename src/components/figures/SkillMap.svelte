<script lang="ts">
  import { onMount } from 'svelte';

  /**
   * What working in gravitational-wave data analysis is made of (after The Shape of Error,
   * Coda). Four branches, fifteen leaves; only two leaves, in gold, are specific to the
   * field. Choose a leaf to read what it is for and where this site uses it.
   */
  let { base }: { base: string } = $props();

  interface Leaf {
    id: string;
    name: string;
    gold?: boolean;
    why: string;
    /** [label, path relative to the site root or a #section] */
    links: [string, string][];
  }
  interface Branch {
    name: string;
    leaves: Leaf[];
  }

  const branches: Branch[] = [
    {
      name: 'Mathematics',
      leaves: [
        {
          id: 'fourier',
          name: 'Fourier analysis',
          why: 'The noise spectrum, whitening and the matched filter all happen frequency by frequency. It is the one piece of mathematics you use every single day.',
          links: [
            ['Hidden in the Noise', 'articles/hidden-in-the-noise/'],
            ['One argument, three costumes', '#fourier'],
          ],
        },
        {
          id: 'bayes',
          name: 'probability & Bayes',
          why: 'Every result is reported as a posterior: likelihood times prior. Knowing which is which is what lets you read a paper, or catch your own mistake.',
          links: [
            ['The Shape of Error', 'articles/the-shape-of-error/'],
            ['From Strain to Source', 'articles/from-strain-to-source/'],
          ],
        },
        {
          id: 'stochastic',
          name: 'stochastic processes',
          why: 'Detector noise is a random process. Stationarity, the assumption that its statistics hold still, is what makes different frequencies independent, and what fails first.',
          links: [['Whitening is a change of ruler', 'articles/hidden-in-the-noise/#m-whiten']],
        },
        {
          id: 'linear',
          name: 'linear algebra',
          why: 'A fit is a projection; an error bar comes from a matrix; a bias is a missing piece projected onto the directions the model can move.',
          links: [
            ['The Shape of Error', 'articles/the-shape-of-error/'],
            ['What the Wrong Model Knows', 'articles/what-the-wrong-model-knows/#m-bias'],
          ],
        },
      ],
    },
    {
      name: 'Computing',
      leaves: [
        {
          id: 'python',
          name: 'Python · numpy · scipy',
          why: "The field's analysis runs on Python over fast numerical libraries. Most of a working week is writing it, and reading somebody else's.",
          links: [],
        },
        {
          id: 'git',
          name: 'git, and reproducible habits',
          why: 'An answer you cannot regenerate from a commit and a pinned environment is an anecdote. Versions matter: this stack has real sensitivities.',
          links: [],
        },
        {
          id: 'clusters',
          name: 'clusters & job schedulers',
          why: 'A published parameter estimation runs for days; a search runs on thousands of cores. You will submit jobs, wait, and learn to read why one died.',
          links: [],
        },
        {
          id: 'packages',
          name: 'gwpy · PyCBC · Bilby',
          gold: true,
          why: "The field's own packages: gwpy for data and spectra, PyCBC for waveforms and filtering, Bilby for inference. Fast to learn once the ideas underneath are yours.",
          links: [['The libraries, step by step', '#the-libraries']],
        },
      ],
    },
    {
      name: 'Physics',
      leaves: [
        {
          id: 'gr',
          name: 'general relativity',
          why: 'Where the waves come from and what they are: ripples in the geometry of spacetime, predicted in 1916 and first heard in 2015.',
          links: [],
        },
        {
          id: 'compact',
          name: 'compact objects',
          why: 'Black holes and neutron stars: what can merge, what its masses and spins mean, and which answers physics forbids.',
          links: [['What the Wrong Model Knows', 'articles/what-the-wrong-model-knows/']],
        },
        {
          id: 'waveforms',
          name: 'waveform models',
          gold: true,
          why: 'The predicted signal for every set of source parameters: the template the search slides and the likelihood evaluates. The strongest assumption in any analysis.',
          links: [['Waveform models, in depth', '#waveform-models']],
        },
      ],
    },
    {
      name: 'The craft',
      leaves: [
        {
          id: 'injections',
          name: 'injections & controls',
          why: 'Feed the analysis a signal whose answer you chose, and see whether it comes back. The only test that is against the truth rather than against itself.',
          links: [['What the Wrong Model Knows', 'articles/what-the-wrong-model-knows/']],
        },
        {
          id: 'residuals',
          name: 'residual diagnostics',
          why: 'Subtract the model and look at what is left. A shape in the leftovers belongs to something the model does not contain.',
          links: [['The Shape of Error', 'articles/the-shape-of-error/']],
        },
        {
          id: 'distrust',
          name: 'distrusting a confident fit',
          why: 'An error bar measures the noise, not whether the model was right. The fits that look best are where this bites hardest.',
          links: [['The fit stopped complaining', 'articles/what-the-wrong-model-knows/']],
        },
      ],
    },
  ];

  const all = branches.flatMap((b) => b.leaves);
  let selected = $state('waveforms');
  let onlyField = $state(false);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });
  const leaf = $derived(all.find((l) => l.id === selected) ?? all[0]);
  const href = (path: string) => (path.startsWith('#') ? path : `${base}${path}`);
</script>

<div
  class="skill-map"
  data-hydrated={hydrated}
  data-selected={selected}
  data-only-field={onlyField}
>
  <p class="skill-map__centre">working in this field</p>
  <div class="skill-map__branches">
    {#each branches as branch (branch.name)}
      <section class="branch" aria-label={branch.name}>
        <h3>{branch.name}</h3>
        <ul>
          {#each branch.leaves as l (l.id)}
            <li>
              <button
                type="button"
                class="leaf"
                class:gold={l.gold}
                class:dim={onlyField && !l.gold}
                aria-pressed={selected === l.id}
                onclick={() => (selected = l.id)}
              >
                {l.name}
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>

  <div class="controls">
    <label class="toggle">
      <input type="checkbox" bind:checked={onlyField} />
      Show only what is specific to gravitational waves
    </label>
    <span class="readout">
      specific to this field <b>{all.filter((l) => l.gold).length} of {all.length}</b>
    </span>
  </div>

  <div class="detail" aria-live="polite">
    <p class="detail__name">
      {leaf.name}
      <span class="tag" class:gold={leaf.gold}>
        {leaf.gold ? 'specific to gravitational waves' : 'transfers to any field with noisy data'}
      </span>
    </p>
    <p>{leaf.why}</p>
    {#if leaf.links.length}
      <p class="detail__links">
        {#each leaf.links as [label, path], i (path)}
          {#if i}<span aria-hidden="true"> · </span>{/if}<a href={href(path)}>{label} →</a>
        {/each}
      </p>
    {/if}
  </div>
</div>

<style>
  .skill-map {
    width: 100%;
  }

  .skill-map__centre {
    width: fit-content;
    margin: 0 auto 1rem;
    padding: 0.45rem 1rem;
    border: 1px solid var(--rule);
    border-radius: 999px;
    background: var(--surface);
    font-family: var(--f-display);
    font-size: 1.3rem;
  }

  .skill-map__branches {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
    gap: 1rem;
  }

  .branch {
    padding: 0.9rem 1rem 1rem;
    border: 1px solid var(--rule-soft);
    border-radius: 12px;
    background: var(--surface);
  }

  .branch h3 {
    margin: 0 0 0.6rem;
    font-family: var(--f-body);
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  .branch ul {
    display: grid;
    gap: 0.45rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .leaf {
    width: 100%;
    padding: 0.45rem 0.7rem;
    border: 1px solid var(--rule);
    border-radius: 8px;
    background: var(--surface-2);
    font: inherit;
    font-size: 0.93rem;
    text-align: left;
    color: var(--ink);
    cursor: pointer;
    transition:
      opacity var(--dur-fast) var(--ease),
      border-color var(--dur-fast) var(--ease);
  }

  .leaf:hover {
    border-color: var(--ink-faint);
  }

  .leaf.gold {
    border-color: var(--signal);
    background: var(--signal-bg);
    font-weight: 600;
  }

  .leaf[aria-pressed='true'] {
    outline: 2px solid var(--ink);
    outline-offset: 1px;
  }

  .leaf.dim {
    opacity: 0.35;
  }

  .leaf:focus-visible {
    outline: 2px solid var(--signal);
    outline-offset: 2px;
  }

  .toggle {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    font-size: var(--text-sm);
  }

  .detail {
    margin-top: 0.9rem;
    padding: 1rem 1.2rem;
    border-left: 3px solid var(--signal);
    border-radius: 0 8px 8px 0;
    background: var(--surface);
  }

  .detail p {
    margin: 0 0 0.5rem;
  }

  .detail__name {
    font-weight: 700;
  }

  .tag {
    display: inline-block;
    margin-left: 0.5rem;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    background: var(--surface-2);
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--ink-soft);
  }

  .tag.gold {
    background: var(--signal-bg);
    color: var(--ink);
  }

  .detail__links {
    font-size: 0.93rem;
  }
</style>
