import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isExecutiveDashboardPublicProduction } from "@/lib/executive-dashboard/env";

export const metadata: Metadata = {
  title: "Executive Dashboard",
  description: "Internal founder surface.",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export const dynamic = "force-dynamic";

/**
 * Option B — Vercel production always 404s the entire /executive-dashboard tree
 * (including login), so the public domain never reveals this surface.
 */
export default function ExecutiveDashboardRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (isExecutiveDashboardPublicProduction()) {
    notFound();
  }

  return children;
}
