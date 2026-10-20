<script lang="ts">
  import { onMount } from 'svelte';
  import { T, useTask, useThrelte } from '@threlte/core/webgpu';

  interface Props {
    /** Peak strain, exaggerated for visibility (real strain is ~1e-21). */
    amplitude: number;
    polarization: 'plus' | 'cross';
    playing: boolean;
    color: string;
    onready?: (backend: 'webgpu' | 'webgl2') => void;
  }

  let { amplitude, polarization, playing, color, onready }: Props = $props();

  const { renderer } = useThrelte();
  const COUNT = 24;
  const ring = Array.from({ length: COUNT }, (_, i) => {
    const angle = (2 * Math.PI * i) / COUNT;
    return [Math.cos(angle), Math.sin(angle)] as const;
  });

  let phase = $state(0);

  onMount(() => {
    const backend = renderer.backend as { isWebGPUBackend?: boolean };
    onready?.(backend.isWebGPUBackend ? 'webgpu' : 'webgl2');
  });

  // Half a cycle per second of screen time: the wave itself is far faster. While paused the
  // task stops, and with nothing to redraw the canvas stops rendering too.
  useTask(
    (delta) => {
      phase = (phase + delta * 2 * Math.PI * 0.5) % (2 * Math.PI);
    },
    { running: () => playing },
  );

  // Free particles in the plane of the ring, for a wave travelling towards the viewer.
  const positions = $derived.by(() => {
    const h = amplitude * Math.cos(phase);
    return ring.map(([x, y]) =>
      polarization === 'plus'
        ? ([x * (1 + h / 2), y * (1 - h / 2)] as const)
        : ([x + (h / 2) * y, y + (h / 2) * x] as const),
    );
  });
</script>

<T.PerspectiveCamera makeDefault position={[0, 0, 4]} fov={45} />
{#each positions as [x, y], i (i)}
  <T.Mesh position={[x, y, 0]}>
    <T.SphereGeometry args={[0.07, 20, 14]} />
    <T.MeshBasicMaterial {color} />
  </T.Mesh>
{/each}
