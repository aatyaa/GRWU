export type GpuBackend = 'webgpu' | 'webgl2' | 'none';

interface NavigatorWithGpu {
  gpu?: { requestAdapter(): Promise<unknown> };
}

/**
 * The best graphics backend this browser offers. WebGPU needs an actual adapter, not just
 * `navigator.gpu`: some browsers expose the API without a usable GPU.
 */
export async function detectGpu(): Promise<GpuBackend> {
  const gpu = (globalThis.navigator as NavigatorWithGpu | undefined)?.gpu;
  if (gpu) {
    try {
      if (await gpu.requestAdapter()) return 'webgpu';
    } catch {
      // Fall through to WebGL2.
    }
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    if (canvas.getContext('webgl2')) return 'webgl2';
  }
  return 'none';
}
