/**
 * Reusable founder disposition controls for Today.
 * Presentation + verb selection only. Persistence lives in disposition.ts.
 */

import { isEditableProjectSpecField } from "@/lib/continuum/client-memory/contracts";
import { validateProjectSpecCorrection } from "@/lib/continuum/client-memory/project-spec/validate";
import { PROJECT_SPEC_FIELD_LABELS } from "@/lib/continuum/client-memory/project-spec/types";
import { currentProjectFocusHref } from "@/lib/continuum/client-memory/open-projects/present";
import { CONCIERGE_HOME_PATH } from "@/lib/continuum/client-memory/read/presentation";
import { CONCIERGE_GMAIL_INTAKE_PATH } from "@/lib/continuum/gmail/types";
import { selectOpenEmailSources } from "./email-source";
import {
  addCalendarDays,
  civilDateInZone,
  encodeDateOnlyForTimestamptz,
  parseDateOnly,
} from "@/lib/continuum/date-only";
import type {
  CosAnomalyItem,
  CosBriefItem,
  CosEvidenceBeat,
  CosFounderAttentionItem,
  CosSpecConflictView,
  CosTop5Item,
} from "./types";

export const COS_ACTION_FAMILIES = [
  "spec_conflict",
  "person_association",
  "cad_decision",
  "client_response",
  "vendor_blocker",
  "open_job",
  "generic",
] as const;

export type CosActionFamily = (typeof COS_ACTION_FAMILIES)[number];

export const COS_FOUNDER_VERBS = [
  "keep_canonical",
  "adopt_evidence",
  "need_to_verify",
  "approve",
  "request_changes",
  "responded",
  "resolved",
  "follow_up",
  "complete",
  "snooze",
  "disregard",
] as const;

export type CosFounderVerb = (typeof COS_FOUNDER_VERBS)[number];

export const SNOOZE_PRESETS = [
  "later_today",
  "tomorrow",
  "3_days",
  "1_week",
  "choose_date",
] as const;

export type CosSnoozePreset = (typeof SNOOZE_PRESETS)[number];

export const SNOOZE_PRESET_LABELS: Record<CosSnoozePreset, string> = {
  later_today: "Later today",
  tomorrow: "Tomorrow",
  "3_days": "3 days",
  "1_week": "1 week",
  choose_date: "Choose date",
};

export type CosFounderActionSource = {
  origin: string;
  subject: string;
  headline: string;
  context: string | null;
  job: CosTop5Item | null;
  brief: CosBriefItem | null;
  decision: CosFounderAttentionItem | null;
  anomaly: CosAnomalyItem | null;
};

export type CosFounderActionView = {
  verb: CosFounderVerb;
  label: string;
  emphasis: "primary" | "secondary";
  needsSnooze: boolean;
};

export type CosEmailSourceView = {
  href: string;
  label: string;
};

export type CosEvidenceFact = {
  label: string;
  value: string;
};

export type CosFounderEvidenceView = {
  why: string;
  facts: CosEvidenceFact[];
  source: string | null;
  beats: CosEvidenceBeat[];
};

export type CosConfirmPersonView = {
  href: string;
  candidateId: string | null;
};

export type CosFounderControlsView = {
  family: CosActionFamily;
  actions: CosFounderActionView[];
  fallback: CosFounderActionView[];
  specConflict: CosSpecConflictView | null;
  evidence: CosFounderEvidenceView | null;
  confirmPerson: CosConfirmPersonView | null;
  openProjectHref: string | null;
  openEmail: CosEmailSourceView | null;
  emailSources: CosEmailSourceView[];
  editHref: string | null;
  completableJob: boolean;
};

const TECHNICAL_EVIDENCE =
  /approved_value=|latest_candidate=|source=email_|candidate state|approved vs candidate|superseded evidence|moderator/i;

function specLabel(fieldName: string): string {
  if (isEditableProjectSpecField(fieldName)) {
    return PROJECT_SPEC_FIELD_LABELS[fieldName];
  }
  return fieldName.replaceAll("_", " ");
}

export function canMutateSpecConflict(
  conflict: Pick<CosSpecConflictView, "fieldName" | "proposedValue">,
  projectId: string | null | undefined,
): boolean {
  if (!projectId?.trim()) return false;
  if (!isEditableProjectSpecField(conflict.fieldName)) return false;
  return validateProjectSpecCorrection(conflict.fieldName, conflict.proposedValue).ok;
}

export function specConflictOf(item: CosFounderActionSource): CosSpecConflictView | null {
  return item.brief?.specConflict ?? item.decision?.specConflict ?? null;
}

function isCadDecision(item: CosFounderActionSource): boolean {
  if (item.job && /approval|CAD|render|design/i.test(item.job.action)) return true;
  if (item.brief?.rankClass === "state_transition" && /approv/i.test(item.headline + (item.context ?? ""))) {
    return true;
  }
  if (item.decision?.recap?.kind === "likely-complete") return true;
  if (item.anomaly?.kind === "contradicts-completion") return false;
  const hay = `${item.headline} ${item.context ?? ""}`;
  return /\b(CAD|render|design)\b/i.test(hay) && /\bapprov/i.test(hay);
}

function isClientResponse(item: CosFounderActionSource): boolean {
  if (item.brief?.rankClass === "client_reply") return true;
  if (item.anomaly?.kind === "client-responded") return true;
  if (item.decision && /answered the design question|Your turn/i.test(item.headline)) {
    return true;
  }
  return /Send the recap/i.test(item.headline);
}

function isVendorBlocker(item: CosFounderActionSource): boolean {
  if (item.brief?.rankClass === "production_blocker") return true;
  if (item.anomaly?.kind === "vendor-evidence") return true;
  if (item.job?.ownership === "WAITING ON SHOP") return true;
  return /shop|vendor|production ETA/i.test(`${item.headline} ${item.context ?? ""}`);
}

function confirmPersonAction(item: CosFounderActionSource) {
  return item.brief?.actions.find((row) => row.kind === "confirm_person") ?? null;
}

function personAssociationCandidateIdFromHref(href: string | null): string | null {
  if (!href) return null;
  const queryIndex = href.indexOf("?");
  if (queryIndex < 0) return null;
  return new URLSearchParams(href.slice(queryIndex)).get("personAssociation");
}

function withTodayReturn(href: string): string {
  const url = new URL(href, "https://hourglass.local");
  url.searchParams.set("returnTo", CONCIERGE_HOME_PATH);
  return `${url.pathname}${url.search}${url.hash}`;
}

function needsPersonConfirm(item: CosFounderActionSource): boolean {
  if (specConflictOf(item)) return false;
  if (confirmPersonAction(item)) return true;
  return Boolean(item.brief && !item.brief.personLabel && isClientResponse(item));
}

function confirmPersonView(item: CosFounderActionSource): CosConfirmPersonView {
  const action = confirmPersonAction(item);
  const href = withTodayReturn(action?.href?.trim() || CONCIERGE_GMAIL_INTAKE_PATH);
  return {
    href,
    candidateId: personAssociationCandidateIdFromHref(href),
  };
}

function emailSourcesFor(item: CosFounderActionSource): CosEmailSourceView[] {
  if (item.brief) {
    const action = item.brief.actions.find((row) => row.kind === "open_email" && row.href);
    return selectOpenEmailSources({
      beats: item.brief.evidence,
      specCandidateId: item.brief.specConflict?.candidateId ?? null,
      canonicalThreadId: item.brief.canonicalGmailThreadId ?? null,
      fallbackHref: action?.href ?? null,
    });
  }
  const decisionHref = item.decision?.sourceHref;
  if (decisionHref?.startsWith("https://mail.google.com/")) {
    return selectOpenEmailSources({
      beats: [],
      canonicalThreadId: null,
      fallbackHref: decisionHref,
    }).map((source) => ({
      href: source.href,
      label: item.decision?.sourceLabel ?? source.label,
    }));
  }
  const anomalyHref = item.anomaly?.sourceHref;
  if (anomalyHref?.startsWith("https://mail.google.com/")) {
    return selectOpenEmailSources({
      beats: [],
      canonicalThreadId: null,
      fallbackHref: anomalyHref,
    }).map((source) => ({
      href: source.href,
      label: item.anomaly?.sourceLabel ?? source.label,
    }));
  }
  return [];
}

function openProjectHrefFor(item: CosFounderActionSource): string | null {
  const projectId =
    item.job?.projectId ??
    item.brief?.projectId ??
    item.decision?.projectId ??
    item.anomaly?.projectId ??
    null;
  if (projectId?.trim()) return currentProjectFocusHref(projectId);
  const fromJob = item.job?.accordionHref?.trim();
  if (fromJob) return fromJob;
  return item.brief?.actions.find((row) => row.kind === "open_project")?.href ?? null;
}

function softenEvidenceText(text: string): string {
  return text
    .replace(/\bapproved_value=/gi, "Project record: ")
    .replace(/\blatest_candidate=/gi, "Latest client evidence: ")
    .replace(/\bsource=email_[^\s]*/gi, "")
    .replace(/\bapproved vs candidate\b/gi, "")
    .replace(/\bcandidate state\b/gi, "")
    .replace(/\bsuperseded evidence\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function presentFounderEvidence(item: CosFounderActionSource): CosFounderEvidenceView | null {
  const conflict = specConflictOf(item);
  const latest = (item.brief?.evidence ?? [])[item.brief?.evidence.length ? item.brief.evidence.length - 1 : 0];
  const beats = (item.brief?.evidence ?? []).filter(
    (beat) => !TECHNICAL_EVIDENCE.test(`${beat.label} ${beat.summary}`),
  );
  const source = latest
    ? `${latest.at} email${item.subject ? ` from ${item.subject.split("/")[0]?.trim()}` : ""}`
    : null;
  if (conflict) {
    return {
      why: "Why Continuum flagged this",
      facts: [
        { label: "Project record", value: conflict.canonicalValue },
        { label: "Latest client evidence", value: conflict.proposedValue },
      ],
      source: source ? `Latest evidence: ${source}` : null,
      beats: beats.map((beat) => ({
        ...beat,
        label: softenEvidenceText(beat.label),
        summary: softenEvidenceText(beat.summary),
      })),
    };
  }
  if (beats.length === 0) return null;
  return {
    why: "Why Continuum flagged this",
    facts: [],
    source: source ? `Latest evidence: ${source}` : null,
    beats: beats.map((beat) => ({
      ...beat,
      label: softenEvidenceText(beat.label),
      summary: softenEvidenceText(beat.summary),
    })),
  };
}

function fallbackFor(
  item: CosFounderActionSource,
  family: CosActionFamily,
): CosFounderActionView[] {
  const completable = Boolean(item.job?.completable && item.job.writer === "open_job.resolve");
  const showComplete =
    family === "open_job" || family === "generic"
      ? completable
      : false;
  const actions: CosFounderActionView[] = [];
  if (showComplete) {
    actions.push({
      verb: "complete",
      label: "Complete",
      emphasis: "primary",
      needsSnooze: false,
    });
  }
  actions.push({
    verb: "snooze",
    label: "Snooze",
    emphasis: "secondary",
    needsSnooze: true,
  });
  actions.push({
    verb: "disregard",
    label: "Disregard",
    emphasis: "secondary",
    needsSnooze: false,
  });
  return actions;
}

export function selectFounderControls(item: CosFounderActionSource): CosFounderControlsView {
  const conflict = specConflictOf(item);
  const emails = emailSourcesFor(item);
  const evidence = presentFounderEvidence(item);
  const completableJob = Boolean(
    item.job?.completable && item.job.writer === "open_job.resolve",
  );

  if (item.origin === "master_sprint") {
    return {
      family: "generic",
      actions: [
        {
          verb: "complete",
          label: "Complete",
          emphasis: "primary",
          needsSnooze: false,
        },
      ],
      fallback: [
        {
          verb: "disregard",
          label: "Disregard",
          emphasis: "secondary",
          needsSnooze: false,
        },
      ],
      specConflict: null,
      evidence,
      confirmPerson: null,
      openProjectHref: openProjectHrefFor(item),
      openEmail: emails.length === 1 ? emails[0]! : null,
      emailSources: emails,
      editHref: null,
      completableJob: false,
    };
  }

  let family: CosActionFamily = "generic";
  let actions: CosFounderActionView[] = [];

  if (conflict) {
    family = "spec_conflict";
    const mutable = canMutateSpecConflict(conflict, item.brief?.projectId ?? item.job?.projectId ?? item.decision?.projectId);
    actions = [
      {
        verb: "keep_canonical",
        label: `Keep ${conflict.canonicalValue}`,
        emphasis: "primary",
        needsSnooze: false,
      },
      ...(mutable
        ? [
            {
              verb: "adopt_evidence" as const,
              label: `Update to ${conflict.proposedValue}`,
              emphasis: "secondary" as const,
              needsSnooze: false,
            },
          ]
        : []),
      {
        verb: "need_to_verify",
        label: "Need to verify",
        emphasis: "secondary",
        needsSnooze: true,
      },
    ];
  } else if (needsPersonConfirm(item)) {
    family = "person_association";
    actions = [
      { verb: "snooze", label: "Snooze", emphasis: "secondary", needsSnooze: true },
    ];
  } else if (isCadDecision(item)) {
    family = "cad_decision";
    actions = [
      { verb: "approve", label: "Approve", emphasis: "primary", needsSnooze: false },
      {
        verb: "request_changes",
        label: "Request changes",
        emphasis: "secondary",
        needsSnooze: true,
      },
    ];
  } else if (isClientResponse(item) && !completableJob) {
    family = "client_response";
    actions = [
      { verb: "responded", label: "Responded", emphasis: "primary", needsSnooze: false },
      { verb: "snooze", label: "Snooze", emphasis: "secondary", needsSnooze: true },
    ];
  } else if (isVendorBlocker(item)) {
    family = "vendor_blocker";
    actions = [
      { verb: "resolved", label: "Resolved", emphasis: "primary", needsSnooze: false },
      { verb: "follow_up", label: "Follow up", emphasis: "secondary", needsSnooze: true },
    ];
  } else if (completableJob) {
    family = "open_job";
  }

  const fallback = family === "spec_conflict" || family === "person_association" || family === "cad_decision" || family === "client_response" || family === "vendor_blocker"
    ? []
    : fallbackFor(item, family);

  return {
    family,
    actions,
    fallback,
    specConflict: conflict,
    evidence,
    confirmPerson: family === "person_association" ? confirmPersonView(item) : null,
    openProjectHref: openProjectHrefFor(item),
    openEmail: emails.length === 1 ? emails[0]! : null,
    emailSources: emails,
    editHref: item.job?.editHref ?? null,
    completableJob,
  };
}

export function snoozeUntilForPreset(
  preset: CosSnoozePreset,
  nowIso: string,
  chosenDate?: string | null,
): string | null {
  if (preset === "later_today") {
    const later = Date.parse(nowIso) + 4 * 60 * 60 * 1000;
    if (!Number.isFinite(later)) return null;
    return new Date(later).toISOString().replace(/\.\d{3}Z$/, ".000Z");
  }
  if (preset === "choose_date") {
    const date = parseDateOnly(chosenDate ?? "");
    return date ? encodeDateOnlyForTimestamptz(date) : null;
  }
  const today = civilDateInZone(nowIso);
  if (!today) return null;
  const days = preset === "tomorrow" ? 1 : preset === "3_days" ? 3 : 7;
  const until = addCalendarDays(today, days);
  return until ? encodeDateOnlyForTimestamptz(until) : null;
}

export function isSnoozePreset(value: string): value is CosSnoozePreset {
  return (SNOOZE_PRESETS as readonly string[]).includes(value);
}

export function isFounderVerb(value: string): value is CosFounderVerb {
  return (COS_FOUNDER_VERBS as readonly string[]).includes(value);
}

export function specConflictFromCandidates(input: {
  fieldName: string;
  canonicalValue: string | null;
  proposedValue: string;
  candidateId: string;
  projectId: string | null;
}): CosSpecConflictView | null {
  const canonical = input.canonicalValue?.trim() ?? "";
  const proposed = input.proposedValue.trim();
  if (!canonical || !proposed) return null;
  const view: CosSpecConflictView = {
    fieldName: input.fieldName,
    fieldLabel: specLabel(input.fieldName),
    canonicalValue: canonical,
    proposedValue: proposed,
    candidateId: input.candidateId,
    canMutate: false,
  };
  view.canMutate = canMutateSpecConflict(view, input.projectId);
  return view;
}
