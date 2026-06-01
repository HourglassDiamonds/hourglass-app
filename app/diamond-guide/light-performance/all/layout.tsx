import type { Metadata } from "next";
import CategoryGuideJsonLd from "../../components/CategoryGuideJsonLd";
import { categoryIndexMetadata } from "@/lib/seo/diamond-guide-metadata";

export const metadata: Metadata = categoryIndexMetadata("light-performance");

export default function LightPerformanceAllLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <CategoryGuideJsonLd segment="light-performance" variant="index" />
      {children}
    </>
  );
}
