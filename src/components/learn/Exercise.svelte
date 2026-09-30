<script lang="ts">
  import { onDestroy, onMount, untrack, type Snippet } from 'svelte';
  import type { Exercise } from '~/lib/exercises/types';
  import type { CodeEditor } from '~/lib/python/editor';
  import type { RunResult } from '~/lib/python/core';

  /**
   * A coding exercise in the page (ADR 0010): real Python in the browser (Pyodide), a code
   * editor, a checker that explains what is still wrong, hints one at a time, the solution,
   * a line-by-line trace, friendly error messages, and progress kept on this device only.
   * Python loads on the first Run. State: data-phase, data-solved, data-hydrated.
   */
  let { exercise, title, children }: { exercise: Exercise; title: string; children?: Snippet } =
    $props();

  type Phase = 'idle' | 'loading' | 'running' | 'passed' | 'failed' | 'error' | 'ran' | 'stopped';
  let phase = $state<Phase>('idle');
  let hydrated = $state(false);
  let solved = $state(false);
  let result = $state<RunResult | null>(null);
  let friendly = $state<{ title: string; summary: string; why?: string; steps?: string[] } | null>(
    null,
  );
  let hintsShown = $state(0);
  let showSolution = $state(false);
  let attempts = $state(0);
  let host = $state<HTMLDivElement>();
  let editor: CodeEditor | undefined;
  let code = '';
  const key = `grwu:exercise:${untrack(() => exercise.id)}`;

  async function save() {
    try {
      const { set } = await import('idb-keyval');
      await set(key, { code, solved });
    } catch {
      /* private mode or storage blocked: progress is a convenience */
    }
  }

  onMount(async () => {
    code = exercise.starter;
    try {
      const { get } = await import('idb-keyval');
      const saved = (await get(key)) as { code?: string; solved?: boolean } | undefined;
      if (saved?.code) code = saved.code;
      solved = !!saved?.solved;
    } catch {
      /* no storage: start fresh */
    }
    const { createEditor } = await import('~/lib/python/editor');
    if (host) {
      editor = createEditor(host, code, {
        label: `Python code for: ${title}`,
        onChange: (c) => {
          code = c;
          void save();
        },
        onRun: () => void run(true),
      });
    }
    hydrated = true;
  });
  onDestroy(() => editor?.destroy());

  async function explain(
    error: string,
    source: string,
  ): Promise<{ title: string; summary: string; why?: string; steps?: string[] } | null> {
    try {
      const fem = await import('@raspberrypifoundation/python-friendly-error-messages');
      await fem.loadCopydeckFor('en');
      fem.registerAdapter('pyodide', fem.cpythonAdapter);
      const r = fem.friendlyExplain({
        error,
        code: source,
        runtime: 'pyodide',
        file: 'exercise.py',
      });
      return r ? { title: r.title, summary: r.summary, why: r.why, steps: r.steps } : null;
    } catch {
      return null;
    }
  }

  async function run(check: boolean, trace = false) {
    if (phase === 'loading' || phase === 'running') return;
    result = null;
    friendly = null;
    phase = 'loading';
    try {
      const { python } = await import('~/lib/python/runtime');
      const py = await python();
      phase = 'running';
      const r = await py.run({
        setup: exercise.setup,
        code,
        check: check ? exercise.check : undefined,
        trace,
      });
      if ((phase as Phase) === 'stopped') return;
      result = r;
      if (check) attempts += 1;
      if (r.error) {
        phase = 'error';
        friendly = await explain(r.error, code);
      } else if (r.passed === true) {
        phase = 'passed';
        solved = true;
        void save();
      } else if (r.passed === false) {
        phase = 'failed';
      } else {
        phase = 'ran';
      }
    } catch (e) {
      if ((phase as Phase) === 'stopped') return;
      phase = 'error';
      result = {
        stdout: '',
        error: `Python could not start: ${e instanceof Error ? e.message : String(e)}`,
        passed: null,
        message: null,
        trace: null,
        figures: [],
      };
    }
  }

  async function stop() {
    const { stopPython } = await import('~/lib/python/runtime');
    stopPython();
    phase = 'stopped';
  }

  function reset() {
    editor?.set(exercise.starter);
    code = exercise.starter;
    result = null;
    friendly = null;
    phase = 'idle';
    void save();
  }

  const busy = $derived(phase === 'loading' || phase === 'running');
  const messages: Record<Phase, string> = {
    idle: '',
    loading: 'Starting Python in your browser (the first time takes a few seconds)…',
    running: 'Running…',
    passed: 'Passed.',
    failed: 'Not yet.',
    error: 'Python stopped with an error.',
    ran: 'Ran.',
    stopped: 'Stopped. Python will restart on the next run.',
  };
  const status = $derived(
    phase === 'idle' && solved
      ? 'Solved on this device before. Try it again or change it.'
      : messages[phase],
  );
</script>

<section
  class="exercise"
  aria-labelledby={`ex-${exercise.id}`}
  data-state={phase}
  data-solved={solved}
  data-hydrated={hydrated}
>
  <header>
    <h3 id={`ex-${exercise.id}`}>{title}</h3>
    {#if solved}<span class="exercise__done">Solved</span>{/if}
  </header>
  {#if children}<div class="exercise__task">{@render children()}</div>{/if}

  <div class="exercise__editor">
    {#if !hydrated}<pre><code>{exercise.starter}</code></pre>{/if}
    <div bind:this={host}></div>
  </div>

  <div class="exercise__actions">
    <button class="rd-primary" type="button" onclick={() => run(true)} disabled={!hydrated || busy}>
      Check
    </button>
    <button type="button" onclick={() => run(false)} disabled={!hydrated || busy}>Run</button>
    <button type="button" onclick={() => run(false, true)} disabled={!hydrated || busy}>
      Step through
    </button>
    {#if busy}
      <button type="button" class="exercise__stop" onclick={stop}>Stop</button>
    {/if}
    <button type="button" onclick={reset} disabled={!hydrated || busy}>Reset</button>
    <span class="exercise__keys">Ctrl/⌘ + Enter to check · Esc then Tab leaves the editor</span>
  </div>

  <div class="exercise__out" aria-live="polite">
    {#if status}<p class="exercise__status" data-kind={phase}>{status}</p>{/if}
    {#if result?.message}
      <p class="exercise__verdict" class:ok={result.passed}>{result.message}</p>
    {/if}
    {#if friendly}
      <div class="exercise__friendly">
        <p><b>{friendly.title}</b> {friendly.summary}</p>
        {#if friendly.why}<p>{friendly.why}</p>{/if}
        {#if friendly.steps?.length}
          <ul>
            {#each friendly.steps as step (step)}<li>{step}</li>{/each}
          </ul>
        {/if}
      </div>
    {/if}
    {#if result?.error}
      <details open={!friendly}>
        <summary>Python's own message</summary>
        <pre class="exercise__error">{result.error}</pre>
      </details>
    {/if}
    {#if result?.stdout}
      <p class="exercise__label">Output</p>
      <pre class="exercise__stdout">{result.stdout}</pre>
    {/if}
    {#if result?.trace}
      <p class="exercise__label">Line by line</p>
      <pre class="exercise__stdout">{result.trace}</pre>
    {/if}
    {#each result?.figures ?? [] as png, i (i)}
      <img src={`data:image/png;base64,${png}`} alt={`Figure ${i + 1} drawn by your code`} />
    {/each}
  </div>

  <div class="exercise__help">
    {#each exercise.hints.slice(0, hintsShown) as hint, i (i)}
      <p class="exercise__hint"><b>Hint {i + 1}.</b> {hint}</p>
    {/each}
    {#if hintsShown < exercise.hints.length}
      <button type="button" onclick={() => (hintsShown += 1)} disabled={!hydrated}>
        {hintsShown ? 'Another hint' : 'Show a hint'}
      </button>
    {/if}
    {#if attempts > 0 || solved}
      <button
        type="button"
        onclick={() => (showSolution = !showSolution)}
        aria-expanded={showSolution}
      >
        {showSolution ? 'Hide the solution' : 'Show the solution'}
      </button>
    {/if}
    {#if showSolution}
      <pre class="exercise__solution"><code>{exercise.solution}</code></pre>
    {/if}
  </div>
</section>

<style>
  .exercise {
    margin: var(--space-8) 0;
    padding: 1.2rem 1.3rem 1.3rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius-2);
    background: var(--surface);
    box-shadow: var(--shadow);
  }

  header {
    display: flex;
    gap: 0.8rem;
    align-items: baseline;
    justify-content: space-between;
  }

  h3 {
    margin: 0 0 0.4rem;
    font-size: 1.3rem;
  }

  .exercise__done {
    padding: 0.1rem 0.6rem;
    border: 1px solid var(--ok);
    border-radius: 999px;
    font-size: 0.8rem;
    color: var(--ink);
  }

  .exercise__task :global(p) {
    margin: 0 0 0.8rem;
    color: var(--ink-soft);
  }

  .exercise__editor {
    overflow: hidden;
    border: 1px solid var(--rule);
    border-radius: 8px;
  }

  .exercise__editor pre {
    margin: 0;
    padding: 0.6rem 0.9rem;
    background: var(--surface);
    font-size: 0.92rem;
  }

  .exercise__actions,
  .exercise__help {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin-top: 0.8rem;
  }

  button {
    padding: 0.45rem 0.95rem;
    border: 1px solid var(--rule);
    border-radius: 999px;
    background: var(--surface);
    font: inherit;
    font-size: 0.9rem;
    color: var(--ink);
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    border-color: var(--ink);
  }

  button:disabled {
    opacity: 0.55;
    cursor: default;
  }

  .rd-primary {
    border-color: var(--signal);
    background: var(--signal-bg);
    font-weight: 600;
  }

  .exercise__stop {
    border-color: var(--bias);
  }

  .exercise__keys {
    font-size: 0.8rem;
    color: var(--ink-soft);
  }

  .exercise__out {
    margin-top: 0.6rem;
  }

  .exercise__status {
    margin: 0.4rem 0;
    font-size: 0.9rem;
    color: var(--ink-soft);
  }

  .exercise__verdict {
    margin: 0.4rem 0;
    padding: 0.5rem 0.8rem;
    border-left: 3px solid var(--rule);
    color: var(--ink);
  }

  .exercise__verdict.ok {
    border-left-color: var(--ok);
  }

  .exercise__friendly {
    margin: 0.4rem 0;
    padding: 0.6rem 0.9rem;
    border: 1px solid var(--bias);
    border-radius: 8px;
    background: var(--bias-bg);
    color: var(--ink);
  }

  .exercise__friendly :global(*) {
    color: var(--ink);
  }

  .exercise__label {
    margin: 0.7rem 0 0.2rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--ink);
  }

  pre {
    margin: 0.3rem 0;
    padding: 0.6rem 0.8rem;
    border-radius: 6px;
    background: var(--surface-2);
    font-family: var(--f-mono);
    font-size: 0.85rem;
    color: var(--ink);
    /* Long lines wrap, as in the editor: nothing scrolls sideways on a phone. */
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  summary {
    cursor: pointer;
    font-size: 0.88rem;
    color: var(--ink-soft);
  }

  .exercise__hint {
    flex-basis: 100%;
    margin: 0;
    color: var(--ink-soft);
  }

  .exercise__solution {
    flex-basis: 100%;
  }

  img {
    display: block;
    max-width: 100%;
    margin-top: 0.6rem;
    border-radius: 6px;
    background: #fff;
  }
</style>
