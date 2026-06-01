import type { Metadata } from "next";
import { categoryIndexMetadata } from "@/lib/seo/diamond-guide-metadata";

export const metadata: Metadata = categoryIndexMetadata("certification");

export default function CertificationAllLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
