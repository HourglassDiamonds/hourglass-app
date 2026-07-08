/**
 * Custom Design pear-project media under public/custom-page/.
 *
 * On-page:
 * - custom-hero.png (hero technical direction)
 * - pear-3d.png (dimensional form)
 * - pear-finished.png (finished photographic still)
 * - GemBox external motion experience
 *
 * Available in repo but not rendered on this page:
 * - pear.jpg (full CAD specification sheet)
 */

export const CUSTOM_DESIGN_MEDIA = {
  hero: "/custom-page/custom-hero.png",
  /** Reserved for later editorial use; not displayed on /custom-design. */
  cad2d: "/custom-page/pear.jpg",
  cad3d: "/custom-page/pear-3d.png",
  finishedStill: "/custom-page/pear-finished.png",
  finishedMotionUrl: "https://gembox.app/c/L8Ab4sSlsX",
} as const;

export const CUSTOM_DESIGN_MEDIA_READY = {
  hero: true,
  cad2d: false,
  cad3d: true,
  finishedStill: true,
  finishedMotion: true,
} as const;

/** Final presentation slot aspect ratios (width / height). */
export const CUSTOM_DESIGN_SLOT_ASPECT = {
  hero: "4 / 5",
  /** Matched square panels for CAD + finished still. */
  cad3d: "1 / 1",
  finishedStill: "1 / 1",
} as const;

export const CUSTOM_DESIGN_ALT = {
  hero: "Custom pear engagement ring design board with technical views and measurements",
  cad3d: "Three-dimensional pear engagement ring CAD rendering in yellow gold",
  finishedStill:
    "Finished pear-shaped diamond engagement ring on a warm ivory reflective surface",
} as const;
