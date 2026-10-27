import { createHash } from "node:crypto";
import type { ProjectKind } from "./project-kind";
import type { ProjectLifecycleStage } from "./project-lifecycle";
import type { OpenJobActor } from "./project-jobs/types";
import type { ClientWebsiteIntake } from "./read/website-intake";

export const WEBSITE_INTAKE_DISPOSITIONS = [
  "new",
  "test_submission",
  "solicitation",
  "contacted",
] as const;

export type WebsiteIntakeDisposition =
  (typeof WEBSITE_INTAKE_DISPOSITIONS)[number];

export const WEBSITE_INTAKE_NEXT_ACTION_OWNERS = [
  "client",
  "founder",
  "unknown",
] as const;

export type WebsiteIntakeNextActionOwner =
  (typeof WEBSITE_INTAKE_NEXT_ACTION_OWNERS)[number];

export function isWebsiteIntakeNextActionOwner(
  value: unknown,
): value is WebsiteIntakeNextActionOwner {
  return typeof value === "string" &&
    (WEBSITE_INTAKE_NEXT_ACTION_OWNERS as readonly string[]).includes(value);
}

const MARKER_PREFIX = "[continuum-intake-lifecycle:v1";
const MARKER_PATTERN = /\[continuum-intake-lifecycle:v1 disposition=(new|test_submission|solicitation|contacted) basis=founder_explicit\]/;

export function isWebsiteIntakeDisposition(
  value: unknown,
): value is WebsiteIntakeDisposition {
  return typeof value === "string" &&
    (WEBSITE_INTAKE_DISPOSITIONS as readonly string[]).includes(value);
}

export function websiteIntakeDispositionLabel(value: WebsiteIntakeDisposition): string {
  if (value === "test_submission") return "Test submission";
  if (value === "solicitation") return "Solicitation";
  if (value === "contacted") return "Contacted";
  return "New inquiry";
}

export function websiteIntakeDispositionFromDetail(
  detail: string | null | undefined,
): WebsiteIntakeDisposition {
  const match = (detail ?? "").match(MARKER_PATTERN);
  return isWebsiteIntakeDisposition(match?.[1]) ? match[1] : "new";
}

export function withoutWebsiteIntakeDispositionMarker(
  detail: string | null | undefined,
): string | null {
  const cleaned = (detail ?? "")
    .split("\n")
    .filter((line) => !line.trim().startsWith(MARKER_PREFIX))
    .join("\n")
    .trim();
  return cleaned || null;
}

export function withWebsiteIntakeDispositionMarker(
  detail: string | null | undefined,
  disposition: Exclude<WebsiteIntakeDisposition, "new">,
): string {
  const base = withoutWebsiteIntakeDispositionMarker(detail);
  const marker = `${MARKER_PREFIX} disposition=${disposition} basis=founder_explicit]`;
  return base ? `${base}\n${marker}` : marker;
}

/** Stable UUID-shaped operation IDs make founder retries safe without a new table. */
export function websiteIntakeOperationId(intakeId: string, operation: string): string {
  const hex = createHash("sha256")
    .update(`continuum:website-intake:v1:${intakeId.trim()}:${operation.trim()}`)
    .digest("hex")
    .slice(0, 32)
    .split("");
  hex[12] = "4";
  hex[16] = ((Number.parseInt(hex[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
  const joined = hex.join("");
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20)}`;
}

export type WebsiteIntakeOpportunityPlan = {
  title: string;
  projectKind: ProjectKind;
  lifecycleStage: ProjectLifecycleStage | null;
};

export function websiteIntakeNextAction(input: {
  fullName: string;
  projectType: string;
  owner: WebsiteIntakeNextActionOwner;
}): { subject: string; waitingOnActor: OpenJobActor } {
  const projectType = input.projectType.trim() || "Concierge inquiry";
  if (input.owner === "client") {
    return {
      subject: `Await reply from ${input.fullName} about ${projectType}`,
      waitingOnActor: "client",
    };
  }
  if (input.owner === "founder") {
    return {
      subject: `Follow up with ${input.fullName} about ${projectType}`,
      waitingOnActor: "founder",
    };
  }
  return {
    subject: `Clarify the next step for ${input.fullName} about ${projectType}`,
    waitingOnActor: "unknown",
  };
}

export function websiteIntakeOpportunityPlan(input: {
  fullName: string;
  category: string;
  projectType: string;
}): WebsiteIntakeOpportunityPlan {
  const category = input.category.trim().toLowerCase();
  const projectType = input.projectType.trim() || "Concierge inquiry";
  if (category === "repair") {
    return {
      title: `${input.fullName} — ${projectType}`,
      projectKind: "repair_service",
      lifecycleStage: "intake",
    };
  }
  if (category === "stone_sourcing" || category === "loose_stone_sourcing") {
    return {
      title: `${input.fullName} — ${projectType}`,
      projectKind: "loose_stone_sourcing",
      lifecycleStage: null,
    };
  }
  return {
    title: `${input.fullName} — ${projectType}`,
    projectKind: "custom_new_jewelry",
    lifecycleStage: "discovery",
  };
}

export function websiteIntakeContactDetail(input: {
  correspondenceApproved: boolean;
  nextActionOwner: WebsiteIntakeNextActionOwner;
}): string {
  const ownership = input.nextActionOwner === "client"
    ? "Founder selected Waiting on Client."
    : input.nextActionOwner === "founder"
      ? "Founder selected Founder Action."
      : "Founder selected Next Step Unresolved.";
  return input.correspondenceApproved
    ? `Founder confirmed initial contact. Exact-address correspondence is founder-approved and linked. ${ownership}`
    : `Founder confirmed initial contact. No verified outbound correspondence is attached; this record does not claim an email was sent. ${ownership}`;
}

export type WebsiteIntakeLifecycleJob = {
  jobId: string;
  projectId: string | null;
  state: "open" | "snoozed" | "resolved" | "cancelled";
  detail: string | null;
  sourceRef: string | null;
};

export function applyWebsiteIntakeLifecycle(
  intakes: readonly ClientWebsiteIntake[],
  jobs: readonly WebsiteIntakeLifecycleJob[],
  projectTitles: ReadonlyMap<string, string> = new Map(),
  projectStages: ReadonlyMap<string, string> = new Map(),
): ClientWebsiteIntake[] {
  return intakes.map((intake) => {
    const intakeRef = `website-intake:${intake.intakeId}`;
    const contactRef = `website-intake-contact:${intake.intakeId}`;
    const intakeJobs = jobs.filter((job) => job.sourceRef === intakeRef);
    const contactJob = jobs.find((job) => job.sourceRef === contactRef) ?? null;
    const activeJob = intakeJobs.find((job) => job.state === "open" || job.state === "snoozed") ?? null;
    const lifecycleJob = activeJob ?? intakeJobs[0] ?? null;
    const disposition = activeJob
      ? "new"
      : websiteIntakeDispositionFromDetail(lifecycleJob?.detail);
    const projectId = contactJob?.projectId ?? null;
    return {
      ...intake,
      jobId: lifecycleJob?.jobId ?? intake.jobId,
      lifecycle: {
        disposition,
        label: websiteIntakeDispositionLabel(disposition),
        activeJobId: activeJob?.jobId ?? null,
        jobState: lifecycleJob?.state ?? null,
        projectId,
        projectTitle: projectId ? projectTitles.get(projectId) ?? null : null,
        projectStage: projectId ? projectStages.get(projectId) ?? null : null,
      },
    };
  });
}
