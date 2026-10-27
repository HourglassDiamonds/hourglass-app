import type { FounderProjectWriter } from "./founder-project/writer";
import type { ProjectJobWriter } from "./project-jobs/writer";
import type { ClientWebsiteIntake } from "./read/website-intake";
import {
  websiteIntakeContactDetail,
  websiteIntakeDispositionFromDetail,
  websiteIntakeOperationId,
  websiteIntakeOpportunityPlan,
  withWebsiteIntakeDispositionMarker,
  withoutWebsiteIntakeDispositionMarker,
  type WebsiteIntakeDisposition,
} from "./website-intake-lifecycle";

export type WebsiteIntakeTransitionResult =
  | { ok: true; status: "restored" | "classified" | "contacted" | "already-present" }
  | { ok: false; reason: "correspondence-pending" | "invalid-state" | "write-failed"; partialProjectId?: string };

export async function transitionWebsiteIntakeWithWriters(input: {
  intake: ClientWebsiteIntake;
  disposition: WebsiteIntakeDisposition;
  jobs: ProjectJobWriter;
  projects: FounderProjectWriter;
  actor: string;
}): Promise<WebsiteIntakeTransitionResult> {
  const { intake, disposition, jobs, projects, actor } = input;
  if (!intake.personId) return { ok: false, reason: "invalid-state" };

  if (disposition === "new") {
    if (intake.lifecycle.disposition === "contacted") return { ok: false, reason: "invalid-state" };
    if (intake.lifecycle.activeJobId) return { ok: true, status: "already-present" };
    const restored = await jobs.createJob({
      mutationId: websiteIntakeOperationId(intake.intakeId, `restore:${intake.jobId ?? "history"}`),
      projectId: null,
      kind: "required_action",
      subject: `Website inquiry — ${intake.fullName}`,
      detail: withoutWebsiteIntakeDispositionMarker(
        `Founder restored this preserved ${intake.lifecycle.label.toLowerCase()} for review.`,
      ),
      waitingOnActor: "founder",
      associatedPersonId: intake.personId,
      actor,
      sourceSystem: "continuum",
      sourceRef: `website-intake:${intake.intakeId}`,
    });
    return restored.ok ? { ok: true, status: "restored" } : { ok: false, reason: "write-failed" };
  }

  const activeJobId = intake.lifecycle.activeJobId;
  if (!activeJobId) return { ok: true, status: "already-present" };
  const intakeJob = await jobs.getJob(null, activeJobId);
  if (!intakeJob || (intakeJob.state !== "open" && intakeJob.state !== "snoozed")) {
    return { ok: false, reason: "invalid-state" };
  }

  let projectId: string | undefined;
  if (disposition === "contacted") {
    if (intake.correspondenceReview?.status === "pending") {
      return { ok: false, reason: "correspondence-pending" };
    }
    const plan = websiteIntakeOpportunityPlan(intake);
    const created = await projects.createProject({
      mutationId: websiteIntakeOperationId(intake.intakeId, "contacted:project"),
      title: plan.title,
      personId: intake.personId,
      projectKind: plan.projectKind,
      lifecycleStage: plan.lifecycleStage,
      actor,
    });
    if (!created.ok) return { ok: false, reason: "write-failed" };
    projectId = created.projectId;
    const waiting = await jobs.createJob({
      mutationId: websiteIntakeOperationId(intake.intakeId, "contacted:waiting-client"),
      projectId,
      kind: "commitment",
      subject: plan.nextActionSubject,
      detail: websiteIntakeContactDetail({
        correspondenceApproved: intake.correspondenceReview?.status === "approved",
      }),
      waitingOnActor: "client",
      associatedPersonId: intake.personId,
      actor,
      sourceSystem: "continuum",
      sourceRef: `website-intake-contact:${intake.intakeId}`,
    });
    if (!waiting.ok) return { ok: false, reason: "write-failed", partialProjectId: projectId };
  }

  if (websiteIntakeDispositionFromDetail(intakeJob.detail) !== disposition) {
    const marked = await jobs.mutateJob({
      mutationId: websiteIntakeOperationId(intake.intakeId, `${disposition}:mark`),
      projectId: null,
      jobId: activeJobId,
      action: "update",
      detail: withWebsiteIntakeDispositionMarker(intakeJob.detail, disposition),
      actor,
      expectedUpdatedAt: intakeJob.updatedAt,
    });
    if (!marked.ok) return { ok: false, reason: "write-failed", partialProjectId: projectId };
  }
  const terminal = await jobs.mutateJob({
    mutationId: websiteIntakeOperationId(intake.intakeId, `${disposition}:terminal`),
    projectId: null,
    jobId: activeJobId,
    action: disposition === "contacted" ? "resolve" : "cancel",
    actor,
  });
  if (!terminal.ok) return { ok: false, reason: "write-failed", partialProjectId: projectId };
  return { ok: true, status: disposition === "contacted" ? "contacted" : "classified" };
}
