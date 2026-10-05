/**
 * <grwu-unfold> enhances a native <details> (which already works without JavaScript):
 * opening and closing morph in place with a View Transition where supported and motion is
 * allowed, and the section opens itself when a link targets it (e.g. a margin peek).
 */
import { reducedMotion } from '~/lib/state';

type WithViewTransitions = Document & { startViewTransition?: (update: () => void) => unknown };

class Unfold extends HTMLElement {
  private details?: HTMLDetailsElement;

  connectedCallback(): void {
    this.details = this.querySelector('details') ?? undefined;
    this.details?.querySelector('summary')?.addEventListener('click', this.onToggle);
    window.addEventListener('hashchange', this.openIfTargeted);
    this.openIfTargeted();
  }

  disconnectedCallback(): void {
    this.details?.querySelector('summary')?.removeEventListener('click', this.onToggle);
    window.removeEventListener('hashchange', this.openIfTargeted);
  }

  private onToggle = (event: Event): void => {
    const doc = document as WithViewTransitions;
    const details = this.details;
    if (!details || !doc.startViewTransition || reducedMotion.get()) return;
    event.preventDefault();
    doc.startViewTransition(() => {
      details.open = !details.open;
    });
  };

  private openIfTargeted = (): void => {
    if (this.details?.id && window.location.hash === `#${this.details.id}`) {
      this.details.open = true;
    }
  };
}

if (!customElements.get('grwu-unfold')) customElements.define('grwu-unfold', Unfold);
