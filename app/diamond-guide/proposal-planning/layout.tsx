import type { Metadata } from "next";
import { categoryHubMetadata } from "@/lib/seo/diamond-guide-metadata";

export const metadata: Metadata = categoryHubMetadata("proposal-planning");

export default function ProposalPlanningLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
