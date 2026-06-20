import type { Metadata, Viewport } from "next";
import { DEFAULT_OPEN_GRAPH } from "@/lib/seo/site-metadata";
import DiamondStudioJsonLd from "./components/DiamondStudioJsonLd";
import { DiamondStudioViewportLock } from "./viewport-lock";

export const viewport: Viewport = {
  viewportFit: "cover",
};

const DIAMOND_STUDIO_DESCRIPTION =
  "Preview diamond size on the hand by ring size, carat weight, shape, and orientation with Hourglass Diamonds' Diamond Studio.";

const DIAMOND_STUDIO_OG_IMAGE = {
  url: "https://www.hourglassdiamonds.com/og/diamond-studio-og.jpg",
  width: 1200,
  height: 630,
  alt: "Hourglass Diamonds Diamond Studio",
} as const;

export const metadata: Metadata = {
  title: "Diamond Studio",
  description: DIAMOND_STUDIO_DESCRIPTION,
  alternates: {
    canonical: "/diamond-studio",
  },
  openGraph: {
    ...DEFAULT_OPEN_GRAPH,
    title: "Diamond Studio",
    description: DIAMOND_STUDIO_DESCRIPTION,
    url: "/diamond-studio",
    images: [DIAMOND_STUDIO_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Diamond Studio",
    description: DIAMOND_STUDIO_DESCRIPTION,
    images: [DIAMOND_STUDIO_OG_IMAGE.url],
  },
};

/** Desktop: block document scroll before client hydration (Footer + min-h-screen). */
const DIAMOND_STUDIO_VIEWPORT_CSS = `
@media (min-width: 769px) {
  html:has([data-diamond-studio-route]),
  body:has([data-diamond-studio-route]) {
    overflow: hidden !important;
    height: 100dvh !important;
    max-height: 100dvh !important;
    overscroll-behavior: none;
  }
  body:has([data-diamond-studio-route]) > div {
    min-height: 0 !important;
    height: 100dvh !important;
    max-height: 100dvh !important;
    overflow: hidden !important;
  }
  body:has([data-diamond-studio-route]) main {
    min-height: 0 !important;
    height: 100dvh !important;
    max-height: 100dvh !important;
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
      <DiamondStudioJsonLd />
      <style dangerouslySetInnerHTML={{ __html: DIAMOND_STUDIO_VIEWPORT_CSS }} />
      <div
        data-diamond-studio-route
        className="diamond-studio-route fixed inset-0 z-[100] h-[100dvh] w-screen max-h-[100dvh] overflow-hidden overscroll-none"
      >
        <DiamondStudioViewportLock />
        {children}
      </div>
    </>
  );
}
