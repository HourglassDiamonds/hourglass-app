import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Inter, Newsreader } from "next/font/google";
import { EXECUTIVE_DASHBOARD_PATHNAME_HEADER } from "@/lib/executive-dashboard/access";
import { founderLoginPathWithNext } from "@/lib/continuum/operating-shell/login-destination";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { ContinuumEnvBadge } from "./components/continuum-env-badge";
import "./concierge.css";

const continuumSans = Inter({
  subsets: ["latin"],
  variable: "--font-continuum-sans",
  display: "swap",
});

const continuumSerif = Newsreader({
  subsets: ["latin"],
  variable: "--font-continuum-serif",
  display: "swap",
});

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Continuum",
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
    const headerList = await headers();
    const pathname = headerList.get(EXECUTIVE_DASHBOARD_PATHNAME_HEADER);
    redirect(founderLoginPathWithNext(pathname));
  }

  return (
    <div className={`${continuumSans.variable} ${continuumSerif.variable}`}>
      <ContinuumEnvBadge />
      {children}
    </div>
  );
}
