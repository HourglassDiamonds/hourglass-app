import type { Metadata, Viewport } from "next";
import { DEFAULT_OPEN_GRAPH } from "@/lib/seo/site-metadata";
import { DIAMOND_STUDIO_DESCRIPTION } from "@/lib/seo/schema/constants";
import DiamondStudioJsonLd from "./components/DiamondStudioJsonLd";
import DiamondStudioSuiteShell from "./components/DiamondStudioSuiteShell";

export const viewport: Viewport = {
  viewportFit: "cover",
};

const DIAMOND_STUDIO_TITLE =
  "Diamond Size Studio | See Diamond Size on Your Hand";
const DIAMOND_STUDIO_SOCIAL_TITLE =
  "Diamond Size Studio | See Diamond Size on Your Hand | Hourglass Diamonds";

const DIAMOND_STUDIO_OG_IMAGE = {
  url: "https://www.hourglassdiamonds.com/og/diamond-studio-og.jpg",
  width: 1200,
  height: 630,
  alt: "Hourglass Diamonds Diamond Size Studio — compare diamond size on your hand",
} as const;

export const metadata: Metadata = {
  title: DIAMOND_STUDIO_TITLE,
  description: DIAMOND_STUDIO_DESCRIPTION,
  alternates: {
    canonical: "/diamond-studio",
  },
  openGraph: {
    ...DEFAULT_OPEN_GRAPH,
    title: DIAMOND_STUDIO_SOCIAL_TITLE,
    description: DIAMOND_STUDIO_DESCRIPTION,
    url: "/diamond-studio",
    images: [DIAMOND_STUDIO_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: DIAMOND_STUDIO_SOCIAL_TITLE,
    description: DIAMOND_STUDIO_DESCRIPTION,
    images: [DIAMOND_STUDIO_OG_IMAGE.url],
  },
};

export default function DiamondStudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DiamondStudioJsonLd />
      <DiamondStudioSuiteShell instrument>{children}</DiamondStudioSuiteShell>
    </>
  );
}
