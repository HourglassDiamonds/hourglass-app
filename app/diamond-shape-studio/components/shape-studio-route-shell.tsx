"use client";

import { usePathname } from "next/navigation";
import DiamondStudioSuiteShell from "../../diamond-studio/components/DiamondStudioSuiteShell";

const CAPTURE_ROUTE_CSS = `
body:has([data-diamond-shape-studio-capture]) footer {
  display: none !important;
}
`;

function detectCaptureRoute(pathname: string | null): boolean {
  if (pathname != null) return pathname.includes("/capture/");
  if (typeof window !== "undefined") {
    return window.location.pathname.includes("/capture/");
  }
  return false;
}

export function ShapeStudioRouteShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isCaptureRoute = detectCaptureRoute(pathname);

  if (isCaptureRoute) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CAPTURE_ROUTE_CSS }} />
        <div
          data-diamond-shape-studio-capture
          className="relative min-h-[100dvh] w-full touch-manipulation"
        >
          {children}
        </div>
      </>
    );
  }

  return (
    <DiamondStudioSuiteShell instrument>{children}</DiamondStudioSuiteShell>
  );
}
