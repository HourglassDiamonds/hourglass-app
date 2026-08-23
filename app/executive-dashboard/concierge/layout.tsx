import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { EXECUTIVE_DASHBOARD_LOGIN_PATH } from "@/lib/executive-dashboard/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import "./concierge.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Concierge",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeLayout({
  children,
}: {
  children: ReactNode;
}) {
  const jar = await cookies();
  const session = requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) {
    redirect(EXECUTIVE_DASHBOARD_LOGIN_PATH);
  }

  return children;
}
