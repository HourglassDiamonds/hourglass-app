import type { Metadata } from "next";
import { categoryIndexMetadata } from "@/lib/seo/diamond-guide-metadata";

export const metadata: Metadata = categoryIndexMetadata("diamond-cut");

export default function DiamondCutAllLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
