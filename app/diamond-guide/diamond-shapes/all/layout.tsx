import type { Metadata } from "next";
import { categoryIndexMetadata } from "@/lib/seo/diamond-guide-metadata";

export const metadata: Metadata = categoryIndexMetadata("diamond-shapes");

export default function DiamondShapesAllLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
