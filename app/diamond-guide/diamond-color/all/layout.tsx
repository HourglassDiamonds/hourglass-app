import type { Metadata } from "next";
import CategoryGuideJsonLd from "../../components/CategoryGuideJsonLd";
import { categoryIndexMetadata } from "@/lib/seo/diamond-guide-metadata";

export const metadata: Metadata = categoryIndexMetadata("diamond-color");

export default function DiamondColorAllLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <CategoryGuideJsonLd segment="diamond-color" variant="index" />
      {children}
    </>
  );
}
