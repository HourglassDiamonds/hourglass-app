export type DiamondStudioSuiteNavItem = {
  label: string;
  href: string;
  comingSoon?: boolean;
};

export const DIAMOND_STUDIO_SUITE_NAV: DiamondStudioSuiteNavItem[] = [
  { label: "Diamond Size Studio", href: "/diamond-studio" },
  { label: "Shape Comparison", href: "/diamond-shape-studio", comingSoon: true },
  { label: "Light Performance", href: "/diamond-intelligence" },
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
