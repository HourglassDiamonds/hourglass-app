import type { Metadata } from "next";
import CategoryGuideJsonLd from "../components/CategoryGuideJsonLd";
import { categoryHubMetadata } from "@/lib/seo/diamond-guide-metadata";

export const metadata: Metadata = categoryHubMetadata("diamond-shapes");

export default function DiamondShapesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <CategoryGuideJsonLd segment="diamond-shapes" variant="hub" />
      {children}
    </>
  );
}
