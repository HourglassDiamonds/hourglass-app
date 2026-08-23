import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Executive Dashboard",
  description: "Internal founder surface.",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export const dynamic = "force-dynamic";

/**
 * Shared private headers for founder surfaces.
 * Metrics dashboard production hide lives in `(protected)/layout`.
 * Concierge is session-gated separately so it can run on a phone.
 */
export default function ExecutiveDashboardRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
