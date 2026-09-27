/**
 * <grwu-depth-dial>: a radio group (intuition / math / code) bound to the persisted `depth`
 * store. The chosen depth opens every <details data-layer> at or above it, so a reader who
 * wants the maths gets it everywhere, and the choice is remembered.
 */
import { DEPTHS, depth, parseDepth, type Depth } from '~/lib/state';

/** Opens the layers at or above `value` and closes the rest, except the one with id `keep`. */
export function applyDepth(root: ParentNode, value: Depth, keep = ''): void {
  document.documentElement.dataset.depth = value;
  const level = DEPTHS.indexOf(value);
  for (const details of root.querySelectorAll<HTMLDetailsElement>('details[data-layer]')) {
    const rank = DEPTHS.indexOf(parseDepth(details.dataset.layer));
    details.open = rank <= level || (keep !== '' && details.id === keep);
  }
}

class DepthDial extends HTMLElement {
  private unsubscribe?: () => void;

  connectedCallback(): void {
    this.addEventListener('change', this.onChange);
    let first = true;
    this.unsubscribe = depth.subscribe((value) => {
      for (const input of this.querySelectorAll<HTMLInputElement>('input[name="depth"]')) {
        input.checked = input.value === value;
      }
      // On load, a section the address points to (#math-welch) stays open at any depth.
      applyDepth(document, value, first ? decodeURIComponent(window.location.hash.slice(1)) : '');
      first = false;
    });
  }

  disconnectedCallback(): void {
    this.removeEventListener('change', this.onChange);
    this.unsubscribe?.();
  }

  private onChange = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    if (input.name === 'depth') depth.set(parseDepth(input.value));
  };
}

if (!customElements.get('grwu-depth-dial')) customElements.define('grwu-depth-dial', DepthDial);
