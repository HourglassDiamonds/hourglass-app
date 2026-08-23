import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  EXECUTIVE_DASHBOARD_LOGIN_PATH,
  readExecutiveDashboardSession,
} from "@/lib/executive-dashboard/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Passkeys",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ExecutiveDashboardSecurityLayout({
  children,
}: {
  children: ReactNode;
}) {
  const jar = await cookies();
  const session = readExecutiveDashboardSession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) {
    redirect(EXECUTIVE_DASHBOARD_LOGIN_PATH);
  }

  return children;
}
