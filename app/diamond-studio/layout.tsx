import type { Metadata, Viewport } from "next";
import { DEFAULT_OPEN_GRAPH } from "@/lib/seo/site-metadata";
import Header from "../shared-components/Header";
import DiamondStudioBrandChrome from "./components/DiamondStudioBrandChrome";
import DiamondStudioJsonLd from "./components/DiamondStudioJsonLd";

export const viewport: Viewport = {
  viewportFit: "cover",
};

const DIAMOND_STUDIO_DESCRIPTION =
  "Compare diamond size on your finger before you buy. Explore how carat weight, shape, ring size, and finger coverage change the way a diamond appears on the hand.";

const DIAMOND_STUDIO_OG_IMAGE = {
  url: "https://www.hourglassdiamonds.com/og/diamond-studio-og.jpg",
  width: 1200,
  height: 630,
  alt: "Hourglass Diamonds Diamond Studio",
} as const;

export const metadata: Metadata = {
  title: "Diamond Size Studio | Compare Diamond Size on Your Finger",
  description: DIAMOND_STUDIO_DESCRIPTION,
  alternates: {
    canonical: "/diamond-studio",
  },
  openGraph: {
    ...DEFAULT_OPEN_GRAPH,
    title: "Diamond Size Studio | Compare Diamond Size on Your Finger",
    description: DIAMOND_STUDIO_DESCRIPTION,
    url: "/diamond-studio",
    images: [DIAMOND_STUDIO_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Diamond Size Studio | Compare Diamond Size on Your Finger",
    description: DIAMOND_STUDIO_DESCRIPTION,
    images: [DIAMOND_STUDIO_OG_IMAGE.url],
  },
};

/**
 * Document-scroll shell: canonical Header → instrument workspace → editorial →
 * root Footer. Workspace height is `100dvh − measured chrome` (see brand chrome).
 */
const DIAMOND_STUDIO_SHELL_CSS = `
[data-diamond-studio-route] {
  --dts-header-h: var(--hg-studio-header-h, 7.5rem);
  --dts-subnav-h: 44px;
  --dts-chrome-h: calc(var(--dts-header-h) + var(--dts-subnav-h));
  --dts-workspace-h: calc(100dvh - var(--dts-chrome-h));
  background: var(--hg-ivory, #efe8de);
  color: var(--hg-ink, #1c1b1a);
}
@media (min-width: 769px) {
  [data-diamond-studio-route] .dts-app {
    height: var(--dts-workspace-h);
    max-height: var(--dts-workspace-h);
    min-height: 0;
    overflow: hidden;
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
      <style dangerouslySetInnerHTML={{ __html: DIAMOND_STUDIO_SHELL_CSS }} />
      <div data-diamond-studio-route className="diamond-studio-route min-h-screen w-full">
        <DiamondStudioBrandChrome />
        <div className="diamond-studio-site-header" data-dts-site-header>
          <div className="mx-auto w-full max-w-[1200px] px-6 md:px-10">
            <Header currentPage="diamond-studio" />
          </div>
        </div>
        {children}
      </div>
    </>
  );
}
