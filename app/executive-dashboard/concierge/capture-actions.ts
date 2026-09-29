"use server";

import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { interpretCaptureAuthenticated, commitCaptureAuthenticated } from "@/lib/continuum/capture/runtime";
import { captureApplication } from "@/lib/continuum/capture/application";
import type { CaptureRequest, CaptureCommitInput } from "@/lib/continuum/capture/types";

const actions = captureApplication({
  async authenticate() {
    const jar = await cookies();
    const session = await requireInternalClientMemorySession(jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value);
    if (!session.ok) throw new Error("Capture authorization unavailable");
  },
  interpret: interpretCaptureAuthenticated,
  commit: commitCaptureAuthenticated,
});

export async function proposeCaptureAction(request: CaptureRequest) {
  return actions.proposeAction(request);
}

export async function saveCaptureAction(input: CaptureCommitInput) {
  return actions.saveAction(input);
}
