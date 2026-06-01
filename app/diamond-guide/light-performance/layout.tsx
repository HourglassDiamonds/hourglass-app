import type { Metadata } from "next";
import { categoryHubMetadata } from "@/lib/seo/diamond-guide-metadata";

export const metadata: Metadata = categoryHubMetadata("light-performance");

export default function LightPerformanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
