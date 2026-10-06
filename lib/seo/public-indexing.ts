export const CRAWLER_DISALLOW_PATHS = [
  "/api/",
  "/executive-dashboard/",
  "/calibration-library/",
  "/diamond-shape-studio/capture/",
] as const;

export function isPrivateOrInternalPath(pathname: string): boolean {
  return CRAWLER_DISALLOW_PATHS.some((prefix) => {
    const root = prefix.slice(0, -1);
    return pathname === root || pathname.startsWith(prefix);
  });
}
