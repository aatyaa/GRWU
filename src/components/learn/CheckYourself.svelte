<script lang="ts">
  import { onMount } from 'svelte';
  import Choice, { type Option } from './Choice.svelte';

  /**
   * Three or so questions at the end of an article, each answered and explained on the spot.
   * Nothing is stored or sent. The tally is exposed as data-right and data-answered.
   */
  let { id, questions }: { id: string; questions: { question: string; options: Option[] }[] } =
    $props();

  let results = $state<(boolean | undefined)[]>([]);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  const answered = $derived(results.filter((r) => r !== undefined).length);
  const right = $derived(results.filter((r) => r === true).length);
</script>

<section
  class="check"
  aria-labelledby={`check-${id}`}
  data-hydrated={hydrated}
  data-answered={answered}
  data-right={right}
>
  <h2 id={`check-${id}`}>Check yourself</h2>
  <ol>
    {#each questions as q, i (i)}
      <li>
        <Choice
          name={`check-${id}-${i}`}
          question={`${i + 1}. ${q.question}`}
          options={q.options}
          onchoose={(_, correct) => (results[i] = correct)}
        />
      </li>
    {/each}
  </ol>
  <p class="check__tally" aria-live="polite">
    {#if answered === questions.length}
      {right} of {questions.length} right.
      {right === questions.length
        ? 'You are ready for what comes next.'
        : 'Read the explanation under each, then carry on.'}
    {:else}
      {answered} of {questions.length} answered.
    {/if}
  </p>
</section>

<style>
  .check {
    margin: var(--space-12) 0 var(--space-8);
    padding-top: var(--space-6);
    border-top: 1px solid var(--rule);
  }

  h2 {
    margin: 0 0 var(--space-4);
  }

  ol {
    display: grid;
    gap: var(--space-6);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .check__tally {
    margin: var(--space-6) 0 0;
    color: var(--ink-soft);
  }
</style>
