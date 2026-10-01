import { redirect } from "next/navigation";
import { ConciergeBackLink } from "../components/concierge-back-link";
import { ConciergeShell } from "../components/concierge-shell";
import { LocalAuthorityWorkspaceView } from "../components/local-authority-workspace";
import { loadAuthenticatedLocalAuthorityWorkspace } from "@/lib/continuum/local-authority/load";
import type { WindowMonths } from "@/lib/continuum/local-authority/types";
import { founderLoginPathWithNext } from "@/lib/continuum/operating-shell/login-destination";
import { CONCIERGE_LOCAL_AUTHORITY_PATH } from "@/lib/continuum/operating-shell/destinations";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Local Authority · Continuum",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

function historyWindow(value: string | string[] | undefined): WindowMonths {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "3" || candidate === "12" || candidate === "24"
    ? Number(candidate) as WindowMonths
    : 6;
}

export default async function LocalAuthorityPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string | string[] }>;
}) {
  const [{ window }, workspace] = await Promise.all([
    searchParams,
    loadAuthenticatedLocalAuthorityWorkspace(),
  ]);
  if (!workspace) redirect(founderLoginPathWithNext(CONCIERGE_LOCAL_AUTHORITY_PATH));

  return (
    <ConciergeShell variant="home">
      <ConciergeBackLink />
      <LocalAuthorityWorkspaceView workspace={workspace} selectedWindow={historyWindow(window)} />
    </ConciergeShell>
  );
}
