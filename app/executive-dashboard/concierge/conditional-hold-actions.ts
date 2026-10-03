"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedProjectJobWriter } from "@/lib/continuum/client-memory/project-jobs/load-writer";
import { ConditionalHoldService } from "@/lib/continuum/sterling/holds/service";
import { getAuthenticatedConditionalHoldRepository } from "@/lib/continuum/sterling/holds/load";
import { refreshTodayAfterFounderMutation } from "@/lib/continuum/chief-of-staff/operating-loop/load";

export async function manageConditionalHoldAction(formData: FormData): Promise<void> {
  const holdId = String(formData.get("holdId") ?? "");
  const action = String(formData.get("holdAction") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(holdId) || !["resume", "keep", "cancel"].includes(action)) return;
  const [holds, jobs] = await Promise.all([getAuthenticatedConditionalHoldRepository(), getAuthenticatedProjectJobWriter()]);
  if (!holds.ok || !jobs.ok) return;
  const now = new Date();
  if (action === "resume") await new ConditionalHoldService({ repository: holds.repository, jobs: jobs.writer }).resumeNow(holdId, now);
  if (action === "keep") await holds.repository.keepHolding(holdId, now.toISOString());
  if (action === "cancel") await holds.repository.close(holdId, "cancelled", now.toISOString());
  await refreshTodayAfterFounderMutation().catch(() => undefined);
  revalidatePath("/executive-dashboard/concierge/ask");
  revalidatePath("/executive-dashboard/concierge/home");
}
