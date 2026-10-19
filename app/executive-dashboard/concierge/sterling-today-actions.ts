"use server";

import "server-only";

import {
  runAuthenticatedSterlingTodayAssembly,
  runAuthenticatedSterlingTodaySemantic,
} from "@/lib/continuum/today-sterling/action-runtime";
import type { SterlingTodaySafeResult } from "@/lib/continuum/today-sterling/server-runner";

export type SterlingTodayActionState = SterlingTodaySafeResult | null;

/** Explicit founder-only assembly. Form fields are intentionally ignored. */
export async function runSterlingTodayAssemblyAction(
  _previousState: SterlingTodayActionState,
  _formData: FormData,
): Promise<SterlingTodaySafeResult> {
  void _previousState;
  void _formData;
  return runAuthenticatedSterlingTodayAssembly();
}

/**
 * Semantic execution is deliberately fail-closed until both the deployed flag
 * and a separately authorized durable lease are active.
 */
export async function runSterlingTodaySemanticAction(
  _previousState: SterlingTodayActionState,
  _formData: FormData,
): Promise<SterlingTodaySafeResult> {
  void _previousState;
  void _formData;
  return runAuthenticatedSterlingTodaySemantic();
}
