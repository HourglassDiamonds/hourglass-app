import type { Metadata } from "next";
import CategoryGuideJsonLd from "../../components/CategoryGuideJsonLd";
import { categoryIndexMetadata } from "@/lib/seo/diamond-guide-metadata";

export const metadata: Metadata = categoryIndexMetadata("certification");

export default function CertificationAllLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <CategoryGuideJsonLd segment="certification" variant="index" />
      {children}
    </>
  );
}
