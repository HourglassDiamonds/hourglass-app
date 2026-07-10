import type { Metadata } from "next";
import { DEFAULT_OPEN_GRAPH } from "@/lib/seo/site-metadata";
import DiamondIntelligenceJsonLd from "./components/DiamondIntelligenceJsonLd";
import DiamondStudioSuiteShell from "../diamond-studio/components/DiamondStudioSuiteShell";

const DIAMOND_INTELLIGENCE_DESCRIPTION =
  "Upload an original GIA, IGI, or GCAL 8X grading report PDF and review the diamond through Hourglass standards.";

const DIAMOND_INTELLIGENCE_OG_IMAGE = {
  url: "https://www.hourglassdiamonds.com/og/diamond-intelligence-og.jpg",
  width: 1200,
  height: 630,
  alt: "Hourglass Diamonds Diamond Intelligence",
} as const;

export const metadata: Metadata = {
  title: "Diamond Intelligence",
  description: DIAMOND_INTELLIGENCE_DESCRIPTION,
  alternates: {
    canonical: "/diamond-intelligence",
  },
  openGraph: {
    ...DEFAULT_OPEN_GRAPH,
    title: "Diamond Intelligence",
    description: DIAMOND_INTELLIGENCE_DESCRIPTION,
    url: "/diamond-intelligence",
    images: [DIAMOND_INTELLIGENCE_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Diamond Intelligence",
    description: DIAMOND_INTELLIGENCE_DESCRIPTION,
    images: [DIAMOND_INTELLIGENCE_OG_IMAGE.url],
  },
};

export default function DiamondIntelligenceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DiamondIntelligenceJsonLd />
      <DiamondStudioSuiteShell instrument>{children}</DiamondStudioSuiteShell>
    </>
  );
}
