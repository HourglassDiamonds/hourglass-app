const EXCLUDED_PREFIXES = [
  "/diamond-intelligence",
  "/calibration-library",
  "/ledger",
  "/executive-dashboard",
  "/api",
];

/** Public marketing routes that receive the facet scintillation rail. */
export function isFacetRailRoute(pathname: string): boolean {
  if (pathname.startsWith("/diamond-studio")) return false;
  if (EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }

  return (
    pathname === "/" ||
    pathname.startsWith("/the-house") ||
    pathname.startsWith("/engagement-rings") ||
    pathname.startsWith("/custom-design") ||
    pathname.startsWith("/diamond-guide") ||
    pathname.startsWith("/concierge")
  );
}
