/**
 * Exact Gmail thread_id ↔ project_history.gmail_thread_id correlation.
 * No subject/body similarity. No CAD/order language. No Person-membership attach.
 */

import { coerceGmailThreadId } from "@/lib/continuum/client-memory/gmail";
import type { ExactProjectThreadMatch } from "./types";

export type ProjectThreadPointer = {
  projectId: string;
  gmailThreadId: string | null;
};

export function correlateExactProjectThread(
  threadId: string,
  projects: readonly ProjectThreadPointer[],
): ExactProjectThreadMatch {
  const canonical = threadId.trim();
  if (!canonical) return { status: "unmatched" };
  const projectIds = [
    ...new Set(
      projects
        .filter((project) => {
          if (!project.gmailThreadId) return false;
          const coerced = coerceGmailThreadId(project.gmailThreadId);
          if (coerced.status !== "canonical") return false;
          return coerced.value === canonical;
        })
        .map((project) => project.projectId),
    ),
  ].sort();
  if (projectIds.length === 0) return { status: "unmatched" };
  return { status: "exact", projectIds };
}
