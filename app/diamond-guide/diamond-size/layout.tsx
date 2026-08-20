import type { Metadata } from "next";
import { categoryHubMetadata } from "@/lib/seo/diamond-guide-metadata";

export const metadata: Metadata = categoryHubMetadata("diamond-size");

export default function DiamondSizeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
