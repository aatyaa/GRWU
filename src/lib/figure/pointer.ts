/** Pointer and keyboard helpers shared by the draggable figures. */

/** The pointer position in the SVG's own user units. */
export function svgPoint(svg: SVGSVGElement, event: PointerEvent): { x: number; y: number } {
  const matrix = svg.getScreenCTM();
  if (!matrix) return { x: 0, y: 0 };
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return { x: point.x, y: point.y };
}

/**
 * Makes an element draggable: `onMove` receives SVG coordinates while the pointer is down.
 * Returns the handler to attach as onpointerdown.
 */
export function dragger(
  svg: () => SVGSVGElement | undefined,
  onMove: (p: { x: number; y: number }) => void,
  onEnd?: () => void,
): (event: PointerEvent) => void {
  return (event: PointerEvent) => {
    const root = svg();
    if (!root || event.button !== 0) return;
    const target = event.currentTarget as Element;
    target.setPointerCapture(event.pointerId);
    event.preventDefault();
    onMove(svgPoint(root, event));
    const move = (e: Event) => onMove(svgPoint(root, e as PointerEvent));
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      onEnd?.();
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };
}

/** Arrow-key stepping for a handle that behaves like a slider. Returns the new value or null. */
export function stepKey(
  event: KeyboardEvent,
  value: number,
  { step, min, max }: { step: number; min: number; max: number },
): number | null {
  const big = step * 10;
  const next = {
    ArrowUp: value + step,
    ArrowRight: value + step,
    ArrowDown: value - step,
    ArrowLeft: value - step,
    PageUp: value + big,
    PageDown: value - big,
    Home: min,
    End: max,
  }[event.key];
  if (next === undefined) return null;
  event.preventDefault();
  return Math.min(max, Math.max(min, next));
}

/** Animates a number from `from` to `to`; respects reduced motion by jumping. */
export function tween(
  from: number,
  to: number,
  onFrame: (value: number) => void,
  duration = 700,
): () => void {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    onFrame(to);
    return () => {};
  }
  const start = performance.now();
  let frame = requestAnimationFrame(function tick(now) {
    const u = Math.min(1, (now - start) / duration);
    const eased = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
    onFrame(from + (to - from) * eased);
    if (u < 1) frame = requestAnimationFrame(tick);
  });
  return () => cancelAnimationFrame(frame);
}
