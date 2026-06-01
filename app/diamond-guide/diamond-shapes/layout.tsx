import type { Metadata } from "next";
import { categoryHubMetadata } from "@/lib/seo/diamond-guide-metadata";

export const metadata: Metadata = categoryHubMetadata("diamond-shapes");

export default function DiamondShapesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
