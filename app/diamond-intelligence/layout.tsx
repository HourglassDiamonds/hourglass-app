import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Light Performance | Diamond Studio | Hourglass Diamonds",
  description:
    "Upload a diamond report for a calm, proportion-aware light performance interpretation.",
};

export default function DiamondIntelligenceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
