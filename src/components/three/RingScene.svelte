<script lang="ts">
  import { onMount } from 'svelte';
  import { Canvas } from '@threlte/core/webgpu';
  import { reducedMotion } from '~/lib/state';
  import RingParticles from './RingParticles.svelte';

  const uid = $props.id();
  let amplitude = $state(0.35);
  let polarization = $state<'plus' | 'cross'>('plus');
  let playing = $state(true);
  let backend = $state<'' | 'webgpu' | 'webgl2'>('');
  let color = $state('');
  let swatch: HTMLElement;

  onMount(() => {
    if (reducedMotion.get()) playing = false;
    // Three.js needs a concrete colour: read the theme token off a hidden swatch, and again
    // whenever the theme changes (the OS setting or the site's toggle).
    const read = () => (color = getComputedStyle(swatch).color);
    read();
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener('change', read);
    const toggle = new MutationObserver(read);
    toggle.observe(document.documentElement, { attributeFilter: ['data-theme'] });
    return () => {
      scheme.removeEventListener('change', read);
      toggle.disconnect();
    };
  });
</script>

<figure class="ring" data-backend={backend} data-color={color}>
  <span class="ring__swatch" bind:this={swatch} hidden></span>
  <div
    class="ring__canvas"
    role="img"
    aria-label="A ring of free-falling particles, stretched in one direction and squeezed in the other by a passing gravitational wave."
  >
    {#if color}
      <Canvas shadows={false} dpr={[1, 2]}>
        <RingParticles
          {amplitude}
          {polarization}
          {playing}
          {color}
          onready={(value) => (backend = value)}
        />
      </Canvas>
    {/if}
  </div>
  <figcaption>
    <div class="ring__controls">
      <button type="button" onclick={() => (playing = !playing)}>
        {playing ? 'Pause' : 'Play'}
      </button>
      <label>
        Strength
        <input type="range" min="0" max="0.6" step="0.05" bind:value={amplitude} />
      </label>
      <label>
        <input type="radio" name="{uid}-polarization" value="plus" bind:group={polarization} />
        plus (+)
      </label>
      <label>
        <input type="radio" name="{uid}-polarization" value="cross" bind:group={polarization} />
        cross (×)
      </label>
    </div>
    <p>
      Real waves change distances by about one part in 10²¹; here the effect is exaggerated about
      10²⁰ times. Rendered with {backend === 'webgpu' ? 'WebGPU' : backend ? 'WebGL 2' : '…'}.
    </p>
  </figcaption>
</figure>

<style>
  .ring {
    margin: var(--space-8) 0;
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-2);
    background: var(--surface-1);
  }

  .ring__canvas {
    height: 18rem;
  }

  .ring__swatch {
    color: var(--c-signal);
  }

  .ring__controls {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    align-items: center;
    font-size: var(--text-sm);
  }

  .ring__controls label {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  figcaption p {
    margin: var(--space-2) 0 0;
    font-size: var(--text-sm);
    color: var(--ink-2);
  }

  button {
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-1);
    background: var(--surface-2);
    color: var(--ink-1);
    font: inherit;
    cursor: pointer;
  }
</style>
