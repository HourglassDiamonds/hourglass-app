import type { Viewport } from "next";

export const viewport: Viewport = {
  viewportFit: "cover",
};

const SHAPE_STUDIO_VIEWPORT_CSS = `
@media (min-width: 769px) {
  html:has([data-diamond-shape-studio-route]),
  body:has([data-diamond-shape-studio-route]) {
    overflow: hidden !important;
    height: 100dvh !important;
    max-height: 100dvh !important;
    overscroll-behavior: none;
  }
  body:has([data-diamond-shape-studio-route]) > div {
    min-height: 0 !important;
    height: 100dvh !important;
    max-height: 100dvh !important;
    overflow: hidden !important;
  }
  body:has([data-diamond-shape-studio-route]) main {
    min-height: 0 !important;
    height: 100dvh !important;
    max-height: 100dvh !important;
    overflow: hidden !important;
    flex: 0 0 auto !important;
  }
  body:has([data-diamond-shape-studio-route]) footer {
    display: none !important;
  }
}
`;

export default function DiamondShapeStudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SHAPE_STUDIO_VIEWPORT_CSS }} />
      <div
        data-diamond-shape-studio-route
        className="diamond-shape-studio-route fixed inset-0 z-[100] h-[100dvh] w-screen max-h-[100dvh] overflow-hidden overscroll-none"
      >
        {children}
      </div>
    </>
  );
}
