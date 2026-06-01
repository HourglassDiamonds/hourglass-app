import type { Metadata } from "next";
import CategoryGuideJsonLd from "../components/CategoryGuideJsonLd";
import { categoryHubMetadata } from "@/lib/seo/diamond-guide-metadata";

export const metadata: Metadata = categoryHubMetadata("diamond-size");

export default function DiamondSizeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <CategoryGuideJsonLd segment="diamond-size" variant="hub" />
      {children}
    </>
  );
}
