import type { Metadata } from "next";
import { categoryIndexMetadata } from "@/lib/seo/diamond-guide-metadata";

export const metadata: Metadata = categoryIndexMetadata("diamond-clarity");

export default function DiamondClarityAllLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
