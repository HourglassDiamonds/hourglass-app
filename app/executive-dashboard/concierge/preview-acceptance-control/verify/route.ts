import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { createControlledAcceptanceVerificationHandler } from "@/lib/continuum/concierge-funnel/verification-endpoint";
import { conciergePreviewAcceptanceEnabled } from "@/lib/continuum/concierge-funnel/preview-gate";
import { verifyControlledAcceptanceServer } from "@/lib/continuum/concierge-funnel/verification";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";

export const dynamic = "force-dynamic";

export const GET = createControlledAcceptanceVerificationHandler({
  enabled: conciergePreviewAcceptanceEnabled,
  async authorize() {
    const jar = await cookies();
    return requireInternalClientMemorySession(
      jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
    ).then((session) => session.ok);
  },
  verify: verifyControlledAcceptanceServer,
});
