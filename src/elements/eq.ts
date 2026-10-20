/**
 * <grwu-eq>: links an equation's tagged terms (and its legend) to figures. Pointing at or
 * focusing a term publishes it on `highlightedTerm`; whatever is highlighted elsewhere
 * (a figure, another equation) lights up the matching terms here.
 */
import { highlightedTerm } from '~/lib/state';

function termOf(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('[data-term]') : null;
}

class GrwuEq extends HTMLElement {
  private unsubscribe?: () => void;

  connectedCallback(): void {
    this.addEventListener('pointerover', this.enter);
    this.addEventListener('pointerout', this.leave);
    this.addEventListener('focusin', this.enter);
    this.addEventListener('focusout', this.leave);
    this.unsubscribe = highlightedTerm.subscribe((active) => {
      for (const element of this.querySelectorAll<HTMLElement>('[data-term]')) {
        element.classList.toggle('is-highlighted', element.dataset.term === active);
      }
    });
  }

  disconnectedCallback(): void {
    this.removeEventListener('pointerover', this.enter);
    this.removeEventListener('pointerout', this.leave);
    this.removeEventListener('focusin', this.enter);
    this.removeEventListener('focusout', this.leave);
    this.unsubscribe?.();
  }

  private enter = (event: Event): void => {
    const term = termOf(event.target);
    if (term && this.contains(term)) highlightedTerm.set(term.dataset.term ?? null);
  };

  private leave = (event: Event): void => {
    const term = termOf(event.target);
    if (!term) return;
    const next = (event as PointerEvent | FocusEvent).relatedTarget;
    if (next instanceof Node && term.contains(next)) return;
    if (highlightedTerm.get() === term.dataset.term) highlightedTerm.set(null);
  };
}

if (!customElements.get('grwu-eq')) customElements.define('grwu-eq', GrwuEq);
