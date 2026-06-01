import type { Metadata } from "next";
import { categoryIndexMetadata } from "@/lib/seo/diamond-guide-metadata";

export const metadata: Metadata = categoryIndexMetadata("light-performance");

export default function LightPerformanceAllLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
