import type { Metadata } from "next";
import CategoryGuideJsonLd from "../components/CategoryGuideJsonLd";
import { categoryHubMetadata } from "@/lib/seo/diamond-guide-metadata";

export const metadata: Metadata = categoryHubMetadata("certification");

export default function CertificationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <CategoryGuideJsonLd segment="certification" variant="hub" />
      {children}
    </>
  );
}
