"use server";

import "server-only";
import { runAuthenticatedOperationalShadowReview, type OperationalShadowResult } from
  "@/lib/continuum/today-sterling/operational-shadow-review";

export type OperationalShadowActionState = OperationalShadowResult | null;

/** Fixed-scope action. Browser fields are intentionally ignored. */
export async function runOperationalShadowAction(
  _previous: OperationalShadowActionState,
  _formData: FormData,
): Promise<OperationalShadowResult> {
  void _previous;
  void _formData;
  return runAuthenticatedOperationalShadowReview();
}
