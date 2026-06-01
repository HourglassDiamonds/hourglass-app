import type { Metadata } from "next";
import { categoryHubMetadata } from "@/lib/seo/diamond-guide-metadata";

export const metadata: Metadata = categoryHubMetadata("diamond-clarity");

export default function DiamondClarityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
