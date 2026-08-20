import type { Metadata } from "next";
import { categoryHubMetadata } from "@/lib/seo/diamond-guide-metadata";

export const metadata: Metadata = categoryHubMetadata("charlotte-guides");

export default function CharlotteGuidesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
