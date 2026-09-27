/** Types for the vendored hero engine (engine.js). */
export interface HeroScene {
  start(): void;
  stop(): void;
}

/** Mounts the GW250114 scene on `stage` (the `.ovh` element) with the overture data tables. */
export function mountHero(stage: HTMLElement, data: unknown): HeroScene;
