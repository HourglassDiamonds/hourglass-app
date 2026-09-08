/**
 * Human-readable Person disambiguation from canonical Continuum evidence.
 * Uses linked Project titles/Kind and Person roles. Never Gmail display names.
 */

import type { PersonRole } from "../types";
import type { ProjectKind } from "../project-kind";

export type LinkedProjectContext = {
  title: string;
  projectKind: ProjectKind | null;
};

export function personRelationshipContext(input: {
  roles: readonly PersonRole[];
  projects: readonly LinkedProjectContext[];
}): string | null {
  const hay = input.projects
    .map((row) => row.title)
    .join(" ")
    .toLowerCase();
  if (/\bengagement\b/.test(hay)) return "Prior engagement-ring client";
  if (/\bwedding\b/.test(hay) && /\bring/.test(hay)) {
    return "Prior custom wedding-ring client";
  }
  if (input.projects.some((row) => row.projectKind === "custom_new_jewelry")) {
    return "Prior custom jewelry client";
  }
  if (input.projects.some((row) => row.projectKind === "repair_service")) {
    return "Prior repair client";
  }
  if (input.projects.length > 0) return "Prior client";
  if (input.roles.includes("prospect")) return "Prospect";
  if (input.roles.includes("client")) return "Client";
  return null;
}
