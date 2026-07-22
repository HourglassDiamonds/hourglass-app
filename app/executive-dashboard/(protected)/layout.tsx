import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  EXECUTIVE_DASHBOARD_LOGIN_PATH,
  getExecutiveDashboardAccessDecision,
} from "@/lib/executive-dashboard/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";

/**
 * Nested protected segment — session required before any child renders.
 * Login lives outside this group so unauthenticated visitors never reach
 * dashboard server components or data loaders.
 */
export default async function ExecutiveDashboardProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const jar = await cookies();
  const decision = getExecutiveDashboardAccessDecision({
    cookieValue: jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  });

  if (decision.status === "hidden") {
    notFound();
  }

  if (decision.status === "unauthenticated") {
    redirect(EXECUTIVE_DASHBOARD_LOGIN_PATH);
  }

  return children;
}
