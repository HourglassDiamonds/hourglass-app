import type { Metadata, Viewport } from "next";
import { DEFAULT_OPEN_GRAPH } from "@/lib/seo/site-metadata";
import DiamondStudioJsonLd from "./components/DiamondStudioJsonLd";
import DiamondStudioSuiteShell from "./components/DiamondStudioSuiteShell";

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
