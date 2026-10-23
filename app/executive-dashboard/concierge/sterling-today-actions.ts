"use server";

import "server-only";

import {
  runAuthenticatedSterlingTodayAssembly,
  runAuthenticatedSterlingTodaySarahAssembly,
  runAuthenticatedSterlingTodaySarahSemantic,
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

/** Fixed Sarah/C026143 founder-only assembly. Submitted form fields are intentionally ignored. */
export async function runSterlingTodaySarahAssemblyAction(
  _previousState: SterlingTodayActionState,
  _formData: FormData,
): Promise<SterlingTodaySafeResult> {
  void _previousState;
  void _formData;
  return runAuthenticatedSterlingTodaySarahAssembly();
}

/** Fixed Sarah/C026143 one-shot semantic shadow. Submitted form fields are intentionally ignored. */
export async function runSterlingTodaySarahSemanticAction(
  _previousState: SterlingTodayActionState,
  _formData: FormData,
): Promise<SterlingTodaySafeResult> {
  void _previousState;
  void _formData;
  return runAuthenticatedSterlingTodaySarahSemantic();
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
