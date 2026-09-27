<script lang="ts">
  import { onMount } from 'svelte';
  import { PYODIDE_VERSION } from '~/lib/python/config';
  import { pythonWorker } from '~/lib/python';
  import { scientific } from '~/lib/format';
  import { spectrum, type SpectrumResult } from './skeleton-state';

  let result = $state<SpectrumResult | null>(spectrum.get());
  let status = $state<'idle' | 'loading' | 'done' | 'error'>('idle');
  let message = $state('');
  let agreement = $state<number | null>(null);
  let ranFor = $state('');

  onMount(() => spectrum.subscribe((value) => (result = value)));

  const key = $derived(
    result ? `${result.datasetId}/${result.channel}/${result.nperseg}/${result.average}` : '',
  );

  // The code shown is the code that runs; the live values come from the figure's settings.
  const parts = $derived.by(() => {
    const r = result;
    if (!r) return [];
    return [
      { text: 'import numpy as np\nfrom scipy import signal\n\n' },
      { text: "# The figure's samples, back in strain units. float64 matters: strain\n" },
      { text: '# power (~1e-46) is too small for float32 and would round to zero.\n' },
      { text: 'x = np.frombuffer(data.to_py(), dtype=np.float32).astype(np.float64) * ' },
      { live: String(r.scale) },
      { text: '\nfreqs, psd = signal.welch(x, fs=' },
      { live: String(r.sampleRate) },
      { text: ', nperseg=' },
      { live: String(r.nperseg) },
      { text: ', average="' },
      { live: r.average },
      { text: '")\npsd.tolist()' },
    ];
  });
  const code = $derived(parts.map((part) => part.text ?? part.live).join(''));

  async function run() {
    const r = result;
    if (!r) return;
    status = 'loading';
    agreement = null;
    try {
      const { value } = await pythonWorker().run(code, {
        packages: ['numpy', 'scipy'],
        globals: { data: r.stored },
      });
      const python = value as number[];
      let worst = 0;
      for (let k = 1; k < r.psd.length; k++) {
        if (r.psd[k] > 0) worst = Math.max(worst, Math.abs(python[k] - r.psd[k]) / r.psd[k]);
      }
      agreement = worst;
      ranFor = key;
      status = 'done';
    } catch (error) {
      status = 'error';
      message = error instanceof Error ? error.message : String(error);
    }
  }
</script>

<div class="code-panel" data-state={status} data-agreement={agreement ?? ''}>
  <!-- Focusable so keyboard users can scroll long lines (as Astro does for code blocks). -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <pre tabindex="0"><code
      >{#each parts as part, i (i)}{#if part.live !== undefined}<mark>{part.live}</mark
          >{:else}{part.text}{/if}{/each}</code
    ></pre>
  <div class="code-panel__actions">
    <button type="button" onclick={run} disabled={!result || status === 'loading'}>
      Run in Python
    </button>
    <p aria-live="polite">
      {#if status === 'loading'}
        Loading Python {PYODIDE_VERSION} with numpy and scipy in your browser (about 20 MB, once)…
      {:else if status === 'done' && agreement !== null}
        scipy and this page's TypeScript agree to {scientific(agreement)} (largest relative difference){ranFor !==
        key
          ? '. Settings changed since, run again to compare.'
          : '.'}
      {:else if status === 'error'}
        Python could not run: {message}
      {:else if !result}
        The code fills in once the figure above has computed its spectrum.
      {:else}
        Runs the code above on the figure's data and compares the result with the figure.
      {/if}
    </p>
  </div>
</div>

<style>
  .code-panel {
    margin: var(--space-2) 0;
  }

  pre {
    margin: 0;
    outline-offset: 2px;
    padding: var(--space-4);
    overflow-x: auto;
    border-radius: var(--radius-2);
    background: var(--surface-2);
    font-size: var(--text-sm);
    line-height: 1.5;
  }

  mark {
    padding: 0 2px;
    border-bottom: 2px solid var(--accent);
    border-radius: 2px;
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    color: inherit;
  }

  .code-panel__actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: baseline;
    margin-top: var(--space-2);
  }

  .code-panel__actions p {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--ink-2);
  }

  button {
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-1);
    background: var(--surface-1);
    color: var(--ink-1);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
  }

  button:disabled {
    cursor: default;
    opacity: 0.6;
  }
</style>
