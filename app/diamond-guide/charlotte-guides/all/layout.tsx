import type { Metadata } from "next";
import CategoryGuideJsonLd from "../../components/CategoryGuideJsonLd";
import { categoryIndexMetadata } from "@/lib/seo/diamond-guide-metadata";

export const metadata: Metadata = categoryIndexMetadata("charlotte-guides");

export default function CharlotteGuidesAllLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <CategoryGuideJsonLd segment="charlotte-guides" variant="index" />
      {children}
    </>
  );
}
