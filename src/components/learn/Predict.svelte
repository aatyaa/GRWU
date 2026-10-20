<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import Choice, { type Option } from './Choice.svelte';

  /**
   * Predict, then look: the reader commits to an answer before the article shows it. What
   * follows the choice (the figure's answer, the explanation) is `children`, hidden until then.
   */
  let {
    id,
    question,
    options,
    children,
  }: { id: string; question: string; options: Option[]; children?: Snippet } = $props();

  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });
</script>

<div class="predict" data-hydrated={hydrated}>
  <p class="predict__prompt">Before you read on, make a guess.</p>
  <Choice name={`predict-${id}`} {question} {options}>
    {#if children}{@render children()}{/if}
  </Choice>
</div>

<style>
  .predict {
    margin: var(--space-8) 0;
    padding: 1.2rem 1.4rem;
    border: 1px solid var(--rule-soft);
    border-left: 3px solid var(--signal);
    border-radius: var(--radius-2);
    background: var(--surface-2);
  }

  .predict__prompt {
    margin: 0 0 0.5rem;
    font-size: 0.9rem;
    color: var(--ink-soft);
  }
</style>
