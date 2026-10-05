<script lang="ts" module>
  export interface Option {
    label: string;
    /** Leave unset on every option for a prediction with no right answer. */
    correct?: boolean;
    /** Shown once this option is chosen. */
    why?: string;
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * One question with one answer to choose, as native radio buttons so it works with the
   * keyboard and screen readers. Once chosen it says whether the answer was right (green,
   * agreement) and why, and shows `children`. State is exposed as data-* attributes.
   */
  let {
    question,
    options,
    name,
    onchoose,
    children,
  }: {
    question: string;
    options: Option[];
    /** Unique on the page: groups the radio buttons. */
    name: string;
    onchoose?: (index: number, correct: boolean | undefined) => void;
    children?: Snippet;
  } = $props();

  let chosen = $state<number | null>(null);
  const graded = $derived(options.some((o) => o.correct !== undefined));
  const picked = $derived(chosen === null ? null : options[chosen]);

  function choose(i: number) {
    chosen = i;
    onchoose?.(i, graded ? options[i].correct === true : undefined);
  }
</script>

<fieldset
  class="choice"
  data-chosen={chosen ?? ''}
  data-correct={picked && graded ? String(picked.correct === true) : ''}
>
  <legend>{question}</legend>
  <div class="choice__options">
    {#each options as option, i (i)}
      <label class:picked={chosen === i} class:right={chosen !== null && graded && option.correct}>
        <input type="radio" {name} value={i} checked={chosen === i} onchange={() => choose(i)} />
        <span>{option.label}</span>
      </label>
    {/each}
  </div>
  <div class="choice__after" aria-live="polite">
    {#if picked}
      {#if graded}
        <p class="choice__verdict" class:right={picked.correct}>
          {picked.correct ? 'Right.' : 'Not quite.'}
          {#if picked.why}{picked.why}{/if}
        </p>
      {:else if picked.why}
        <p class="choice__verdict">{picked.why}</p>
      {/if}
      {#if children}<div class="choice__reveal">{@render children()}</div>{/if}
    {/if}
  </div>
</fieldset>

<style>
  .choice {
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    margin-bottom: 0.7rem;
    padding: 0;
    font-weight: 600;
    color: var(--ink);
  }

  .choice__options {
    display: grid;
    gap: 0.45rem;
  }

  label {
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
    padding: 0.55rem 0.8rem;
    border: 1px solid var(--rule);
    border-radius: 8px;
    background: var(--surface);
    color: var(--ink);
    cursor: pointer;
  }

  label:hover {
    border-color: var(--ink-soft);
  }

  label.picked {
    border-color: var(--ink);
  }

  label.right {
    border-color: var(--ok);
    box-shadow: inset 3px 0 0 var(--ok);
  }

  input {
    accent-color: var(--ink);
  }

  .choice__verdict {
    margin: 0.8rem 0 0;
    color: var(--ink-soft);
  }

  .choice__verdict.right {
    padding-left: 0.7rem;
    border-left: 3px solid var(--ok);
  }

  .choice__reveal {
    margin-top: 0.8rem;
  }
</style>
