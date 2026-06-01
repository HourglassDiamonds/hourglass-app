import type { Metadata } from "next";
import { categoryIndexMetadata } from "@/lib/seo/diamond-guide-metadata";

export const metadata: Metadata = categoryIndexMetadata("buying-strategy");

export default function BuyingStrategyAllLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
