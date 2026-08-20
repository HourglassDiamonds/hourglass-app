import type { Metadata } from "next";
import { categoryHubMetadata } from "@/lib/seo/diamond-guide-metadata";

export const metadata: Metadata = categoryHubMetadata("diamond-color");

export default function DiamondColorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
