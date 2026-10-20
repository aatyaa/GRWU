/**
 * <grwu-scrolly id="..."> drives a sticky figure from the text beside it. Each child with
 * [data-step] in the steps column is a step; the step crossing the middle of the viewport becomes active. The
 * active index is written to `scrollySteps` (keyed by the element's id) and mirrored on the
 * element as data-active, so islands and CSS can both follow it. Without JavaScript every
 * step is plain text and the figure shows its first state.
 */
import { scrollySteps } from '~/lib/state';

class Scrolly extends HTMLElement {
  private observer?: IntersectionObserver;

  connectedCallback(): void {
    const steps = Array.from(this.querySelectorAll<HTMLElement>('.scrolly__steps > [data-step]'));
    const key = this.id;
    const activate = (index: number) => {
      this.dataset.active = String(index);
      steps.forEach((step, i) => step.classList.toggle('is-active', i === index));
      if (key) scrollySteps.setKey(key, index);
    };
    activate(0);
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) activate(steps.indexOf(entry.target as HTMLElement));
        }
      },
      // A thin band across the middle of the viewport: whichever step is in it is active.
      { rootMargin: '-48% 0px -48% 0px' },
    );
    for (const step of steps) this.observer.observe(step);
  }

  disconnectedCallback(): void {
    this.observer?.disconnect();
  }
}

if (!customElements.get('grwu-scrolly')) customElements.define('grwu-scrolly', Scrolly);
