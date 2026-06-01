import type { Metadata } from "next";
import { categoryIndexMetadata } from "@/lib/seo/diamond-guide-metadata";

export const metadata: Metadata = categoryIndexMetadata("diamond-color");

export default function DiamondColorAllLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
