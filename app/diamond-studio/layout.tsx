import type { Metadata, Viewport } from "next";
import { DiamondStudioViewportLock } from "./viewport-lock";

export const viewport: Viewport = {
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Diamond Studio | Hourglass Diamonds",
  description:
    "Explore diamond size, finger coverage, shape, and proportion in a visual, calm environment.",
};

/** Desktop: block document scroll before client hydration (Footer + min-h-screen). */
const DIAMOND_STUDIO_VIEWPORT_CSS = `
@media (min-width: 769px) {
  html:has([data-diamond-studio-route]),
  body:has([data-diamond-studio-route]) {
    overflow: hidden !important;
    height: 100vh !important;
    max-height: 100vh !important;
    overscroll-behavior: none;
  }
  body:has([data-diamond-studio-route]) > div {
    min-height: 0 !important;
    height: 100vh !important;
    max-height: 100vh !important;
    overflow: hidden !important;
  }
  body:has([data-diamond-studio-route]) main {
    min-height: 0 !important;
    height: 100vh !important;
    max-height: 100vh !important;
    overflow: hidden !important;
    flex: 0 0 auto !important;
  }
  body:has([data-diamond-studio-route]) footer {
    display: none !important;
  }
}
`;

export default function DiamondStudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DIAMOND_STUDIO_VIEWPORT_CSS }} />
      <div
        data-diamond-studio-route
        className="diamond-studio-route fixed inset-0 z-[100] h-screen w-screen max-h-screen overflow-hidden overscroll-none"
      >
        <DiamondStudioViewportLock />
        {children}
      </div>
    </>
  );
}
