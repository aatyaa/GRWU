/**
 * <grwu-binary-hero data-src="...json">: loads the GW250114 scene only when it is about to be
 * seen, runs it while it is on screen and stops it (and the GPU) when it is not. Pointing at
 * a part of the signal map ([data-seg][data-at]) marks the stage with data-seg, which lights
 * that stretch of the signal, and takes the scene to that moment.
 */
import type { HeroScene } from '~/lib/hero/engine.js';

class BinaryHero extends HTMLElement {
  private scene?: HeroScene;
  private observer?: IntersectionObserver;
  private loading?: Promise<void>;

  connectedCallback(): void {
    this.observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void this.run();
        else this.scene?.stop();
      },
      { rootMargin: '120px 0px' },
    );
    this.observer.observe(this);

    const stage = this.querySelector<HTMLElement>('.ovh');
    if (!stage) return;
    for (const link of this.querySelectorAll<HTMLElement>('[data-seg][data-at]')) {
      const enter = () => {
        stage.dataset.seg = link.dataset.seg;
        this.scene?.jump(Number(link.dataset.at));
      };
      const leave = () => {
        if (stage.dataset.seg === link.dataset.seg) delete stage.dataset.seg;
      };
      link.addEventListener('pointerenter', enter);
      link.addEventListener('focus', enter);
      link.addEventListener('pointerleave', leave);
      link.addEventListener('blur', leave);
    }
  }

  disconnectedCallback(): void {
    this.observer?.disconnect();
    this.scene?.stop();
  }

  private async run(): Promise<void> {
    this.loading ??= this.load();
    await this.loading;
    this.scene?.start();
  }

  private async load(): Promise<void> {
    const stage = this.querySelector<HTMLElement>('.ovh');
    if (!stage) return;
    try {
      const [{ mountHero }, data] = await Promise.all([
        import('~/lib/hero/engine.js'),
        fetch(this.dataset.src ?? '').then((r) => r.json()),
      ]);
      this.scene = mountHero(stage, data as unknown);
    } catch (error) {
      stage.dataset.heroError = error instanceof Error ? error.message : String(error);
    }
  }
}

if (!customElements.get('grwu-binary-hero')) customElements.define('grwu-binary-hero', BinaryHero);
