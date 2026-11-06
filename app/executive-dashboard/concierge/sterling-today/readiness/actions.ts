"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { refreshTodayAfterFounderMutation } from "@/lib/continuum/chief-of-staff/operating-loop/load";
import { isVerifiedSterlingTodayPreviewRuntime } from "@/lib/continuum/today-sterling/server-config";

const PATH = "/executive-dashboard/concierge/sterling-today/readiness";
const TODAY_PATH = "/executive-dashboard/concierge";

export async function recomputeCanonicalToday(_formData: FormData): Promise<void> {
  void _formData;
  if (!isVerifiedSterlingTodayPreviewRuntime()) redirect(`${PATH}?recompute=not-preview`);

  let result = "completed";
  try {
    await refreshTodayAfterFounderMutation();
    revalidatePath(TODAY_PATH);
    revalidatePath(PATH);
  } catch {
    result = "failed";
  }

  redirect(`${PATH}?recompute=${result}`);
}
