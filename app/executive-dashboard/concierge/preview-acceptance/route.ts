import { cookies } from "next/headers";
import { createPreviewConciergeAcceptanceHandler } from "@/lib/continuum/concierge-funnel/acceptance-endpoint";
import { conciergePreviewAcceptanceEnabled } from "@/lib/continuum/concierge-funnel/preview-gate";
import { preparePersistentConciergeAcceptanceServer } from "@/lib/continuum/concierge-funnel/server";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";

export const dynamic = "force-dynamic";

export const POST = createPreviewConciergeAcceptanceHandler({
  enabled: conciergePreviewAcceptanceEnabled,
  async authorize() {
    const jar = await cookies();
    const session = await requireInternalClientMemorySession(
      jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
    );
    return session.ok;
  },
  prepare: preparePersistentConciergeAcceptanceServer,
  now: () => new Date().toISOString(),
});
