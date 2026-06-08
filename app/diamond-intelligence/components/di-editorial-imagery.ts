import type { VisualPersonalityArchetype } from "@/lib/diamond-intelligence/visual-personality";

/**
 * Centralized Diamond Intelligence imagery.
 * All image paths live here — do not scatter references in components.
 *
 * enableEditorialImagery: false until curated assets are approved.
 * useCuratedAssets: false uses interim fallbacks from diamond-tech-suite.
 */
export const DI_IMAGERY = {
  /** Hero visual anchor only — notice slots stay off until curated assets ship. */
  enableHeroImagery: false,
  enableEditorialImagery: false,
  useCuratedAssets: false,
  basePath: "/diamond-intelligence",
} as const;

export type DiImageSlot =
  | "hero"
  | "notice-bright-sparkle"
  | "notice-fire"
  | "notice-spread"
  | "notice-compact"
  | "notice-balanced"
  | "notice-broad"
  | "notice-lively"
  | "notice-unclear"
  | "performance-watermark";

export type DiEditorialImageSpec = {
  src: string;
  fallbackSrc: string;
  alt: string;
  objectPosition?: string;
  priority?: boolean;
};

const CURATED = DI_IMAGERY.basePath;

export const DI_IMAGE_CATALOG: Record<DiImageSlot, DiEditorialImageSpec> = {
  hero: {
    src: `${CURATED}/hero-diamond.webp`,
    fallbackSrc: "/diamond-tech-suite/diamonds/round.png",
    alt: "Round brilliant diamond — top view",
    priority: true,
  },
  "notice-bright-sparkle": {
    src: `${CURATED}/diamond-side-profile.webp`,
    fallbackSrc: "/diamond-tech-suite/diamonds/round.png",
    alt: "Round brilliant diamond — side profile",
    objectPosition: "55% 42%",
  },
  "notice-fire": {
    src: `${CURATED}/diamond-light-performance.webp`,
    fallbackSrc: "/diamond-tech-suite/diamonds/round.png",
    alt: "Round brilliant diamond — light return",
    objectPosition: "50% 45%",
  },
  "notice-spread": {
    src: `${CURATED}/diamond-scale-reference.webp`,
    fallbackSrc: "/diamond-tech-suite/finger/finger-light.png",
    alt: "Diamond scale reference",
    objectPosition: "50% 35%",
  },
  "notice-compact": {
    src: `${CURATED}/diamond-compact-profile.webp`,
    fallbackSrc: "/diamond-tech-suite/diamonds/round.png",
    alt: "Round brilliant diamond — profile",
    objectPosition: "48% 55%",
  },
  "notice-balanced": {
    src: `${CURATED}/diamond-balanced-sparkle.webp`,
    fallbackSrc: "/diamond-tech-suite/diamonds/round.png",
    alt: "Round brilliant diamond — balanced sparkle",
    objectPosition: "50% 50%",
  },
  "notice-broad": {
    src: `${CURATED}/diamond-broad-flash.webp`,
    fallbackSrc: "/diamond-tech-suite/diamonds/round.png",
    alt: "Round brilliant diamond — broad brightness",
    objectPosition: "50% 40%",
  },
  "notice-lively": {
    src: `${CURATED}/diamond-lively-character.webp`,
    fallbackSrc: "/diamond-tech-suite/diamonds/round.png",
    alt: "Round brilliant diamond — lively character",
    objectPosition: "52% 48%",
  },
  "notice-unclear": {
    src: `${CURATED}/diamond-neutral-study.webp`,
    fallbackSrc: "/diamond-tech-suite/diamonds/round-backing.png",
    alt: "Diamond proportion study",
    objectPosition: "50% 50%",
  },
  "performance-watermark": {
    src: `${CURATED}/diamond-facet-outline.webp`,
    fallbackSrc: "/diamond-tech-suite/diamonds/round-backing.png",
    alt: "",
  },
};

const ARCHETYPE_NOTICE_SLOT: Record<VisualPersonalityArchetype, DiImageSlot> = {
  "Bright & Structured": "notice-bright-sparkle",
  "Fire Forward": "notice-fire",
  "Spread Forward": "notice-spread",
  "Compact Architecture": "notice-compact",
  "Balanced Performer": "notice-balanced",
  "Broad Flash Style": "notice-broad",
  "Lively Character": "notice-lively",
  "Architecture Unclear": "notice-unclear",
};

export function resolveNoticeImageSlot(
  archetype: VisualPersonalityArchetype,
): DiImageSlot {
  return ARCHETYPE_NOTICE_SLOT[archetype];
}

export function resolveImageSpec(slot: DiImageSlot): DiEditorialImageSpec {
  return DI_IMAGE_CATALOG[slot];
}

export function resolveImageSrc(spec: DiEditorialImageSpec): string {
  return DI_IMAGERY.useCuratedAssets ? spec.src : spec.fallbackSrc;
}
