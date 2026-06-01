import type { Metadata } from "next";
import { categoryIndexMetadata } from "@/lib/seo/diamond-guide-metadata";

export const metadata: Metadata = categoryIndexMetadata("diamond-size");

export default function DiamondSizeAllLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
