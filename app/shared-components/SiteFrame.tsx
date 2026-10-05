"use client";

import { usePathname } from "next/navigation";
import Header from "./Header";

function isStudioSuite(pathname: string): boolean {
  if (pathname.startsWith("/diamond-shape-studio/capture/")) return false;
  return (
    pathname === "/diamond-studio" ||
    pathname.startsWith("/diamond-studio/") ||
    pathname === "/diamond-shape-studio" ||
    pathname.startsWith("/diamond-shape-studio/") ||
    pathname === "/diamond-intelligence" ||
    pathname.startsWith("/diamond-intelligence/")
  );
}

function isHeaderlessRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/executive-dashboard") ||
    pathname === "/continuum" ||
    pathname.startsWith("/c/") ||
    pathname.startsWith("/diamond-shape-studio/capture/")
  );
}

export default function SiteFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";

  // The Studio suite owns its brand/header/subnav order and supplies its main
  // landmark inside DiamondStudioSuiteShell.
  if (isStudioSuite(pathname)) return children;

  if (isHeaderlessRoute(pathname)) {
    return (
      <main id="hg-page-content" tabIndex={-1} className="flex-1">
        {children}
      </main>
    );
  }

  return (
    <>
      <div className="sticky top-0 z-50 mx-auto w-full max-w-[1200px] px-6 md:px-10">
        <Header renderSkipTarget={false} />
      </div>
      <main id="hg-page-content" tabIndex={-1} className="flex-1">
        {children}
      </main>
    </>
  );
}
