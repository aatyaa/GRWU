<script lang="ts">
  import { onMount } from 'svelte';

  // Proves that Svelte islands hydrate: the button only works once this runs in the browser.
  let hydrated = $state(false);
  let count = $state(0);

  onMount(() => {
    hydrated = true;
  });
</script>

<div class="island-check" data-hydrated={hydrated}>
  <p>Svelte island: <strong>{hydrated ? 'hydrated' : 'static HTML'}</strong></p>
  <button type="button" onclick={() => (count += 1)} disabled={!hydrated}>
    Clicked {count}
    {count === 1 ? 'time' : 'times'}
  </button>
</div>

<style>
  .island-check {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4);
    border: 1px dashed var(--rule);
    border-radius: var(--radius-2);
    background: var(--surface);
  }

  p {
    margin: 0;
  }

  button {
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--rule);
    border-radius: var(--radius-1);
    background: var(--surface-2);
    color: var(--ink);
    cursor: pointer;
  }

  button:disabled {
    cursor: progress;
  }
</style>
