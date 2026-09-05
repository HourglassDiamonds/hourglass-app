/** True when this nav href is the current page or a nested path under it. */
export function isNavCurrent(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
