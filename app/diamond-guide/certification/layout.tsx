import type { Metadata } from "next";
import { categoryHubMetadata } from "@/lib/seo/diamond-guide-metadata";

export const metadata: Metadata = categoryHubMetadata("certification");

export default function CertificationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
