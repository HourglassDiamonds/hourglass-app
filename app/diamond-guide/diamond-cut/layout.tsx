import type { Metadata } from "next";
import { categoryHubMetadata } from "@/lib/seo/diamond-guide-metadata";

export const metadata: Metadata = categoryHubMetadata("diamond-cut");

export default function DiamondCutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
