import type { Metadata } from "next";
import { DEFAULT_OPEN_GRAPH } from "@/lib/seo/site-metadata";
import {
  DIAMOND_INTELLIGENCE_ALTERNATE_NAME,
  DIAMOND_INTELLIGENCE_DESCRIPTION,
  DIAMOND_INTELLIGENCE_NAME,
} from "@/lib/seo/schema/constants";
import DiamondIntelligenceJsonLd from "./components/DiamondIntelligenceJsonLd";
import DiamondStudioSuiteShell from "../diamond-studio/components/DiamondStudioSuiteShell";

const DIAMOND_INTELLIGENCE_OG_IMAGE = {
  url: "https://www.hourglassdiamonds.com/og/diamond-intelligence-og.jpg",
  width: 1200,
  height: 630,
  alt: "Hourglass Diamonds Diamond Intelligence",
} as const;

export const metadata: Metadata = {
  title: `${DIAMOND_INTELLIGENCE_ALTERNATE_NAME} | ${DIAMOND_INTELLIGENCE_NAME}`,
  description: DIAMOND_INTELLIGENCE_DESCRIPTION,
  alternates: {
    canonical: "/diamond-intelligence",
  },
  openGraph: {
    ...DEFAULT_OPEN_GRAPH,
    title: `${DIAMOND_INTELLIGENCE_ALTERNATE_NAME} | ${DIAMOND_INTELLIGENCE_NAME} | Hourglass Diamonds`,
    description: DIAMOND_INTELLIGENCE_DESCRIPTION,
    url: "/diamond-intelligence",
    images: [DIAMOND_INTELLIGENCE_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `${DIAMOND_INTELLIGENCE_ALTERNATE_NAME} | ${DIAMOND_INTELLIGENCE_NAME} | Hourglass Diamonds`,
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
