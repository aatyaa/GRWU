/** Types for the vendored hero engine (engine.js). */
export interface HeroScene {
  start(): void;
  stop(): void;
  /** Takes the scene to `t` seconds from the peak of the signal. */
  jump(t: number): void;
}

/** Mounts the GW250114 scene on `stage` (the `.ovh` element) with the overture data tables. */
export function mountHero(stage: HTMLElement, data: unknown): HeroScene;
