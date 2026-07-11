export type DiamondStudioSuiteNavItem = {
  /** Full destination name — used for accessibility and desktop display. */
  label: string;
  /**
   * Controlled mobile line breaks for the primary label.
   * Joined with a space on desktop; stacked on small screens.
   */
  labelLines: [string, string];
  /** Quiet secondary line — customer outcome, not a product codename. */
  descriptor: string;
  href: string;
  comingSoon?: boolean;
};

export const DIAMOND_STUDIO_SUITE_NAV: DiamondStudioSuiteNavItem[] = [
  {
    label: "See It On a Finger",
    labelLines: ["See It On", "a Finger"],
    descriptor: "Size & proportion",
    href: "/diamond-studio",
  },
  {
    label: "See It On Your Hand",
    labelLines: ["See It On", "Your Hand"],
    descriptor: "Upload your hand",
    href: "/diamond-shape-studio",
  },
  {
    label: "Analyze Sparkle",
    labelLines: ["Analyze", "Sparkle"],
    descriptor: "Light performance",
    href: "/diamond-intelligence",
  },
];

export function isDiamondStudioSuiteNavActive(
  pathname: string,
  href: string,
): boolean {
  if (href === "/diamond-studio") {
    return (
      pathname === "/diamond-studio" ||
      pathname.startsWith("/diamond-studio/")
    );
  }
  if (href === "/diamond-shape-studio") {
    return (
      pathname === "/diamond-shape-studio" ||
      (pathname.startsWith("/diamond-shape-studio/") &&
        !pathname.includes("/capture/"))
    );
  }
  if (href === "/diamond-intelligence") {
    return (
      pathname === "/diamond-intelligence" ||
      pathname.startsWith("/diamond-intelligence/")
    );
  }
  return false;
}
