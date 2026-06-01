import type { Metadata } from "next";
import CategoryGuideJsonLd from "../components/CategoryGuideJsonLd";
import { categoryHubMetadata } from "@/lib/seo/diamond-guide-metadata";

export const metadata: Metadata = categoryHubMetadata("buying-strategy");

export default function BuyingStrategyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <CategoryGuideJsonLd segment="buying-strategy" variant="hub" />
      {children}
    </>
  );
}
