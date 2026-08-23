/**
 * Shared PII-free import plan. Dry-run and apply consume the same counters.
 */

import type { PersonRowEvaluation } from "./eligibility";
import {
  isProseCandidate,
  type ParsedPersonRow,
  type ParsedProjectRow,
  type ParsedWorkbook,
} from "./workbook";
import { cellText } from "./xlsx";

export type ClientMemoryImportManifest = {
  peopleRows: number;
  personCandidates: number;
  personsEligible: number;
  personsNeedsReview: number;
  identityWarnings: number;
  identityConflicts: number;
  projectsExactEligible: number;
  projectsReviewLink: number;
  projectsUnresolved: number;
  reviewsWouldOpen: number;
  sourceNotesWouldCreate: number;
  relationshipsWouldCreate: number;
  projectsWouldCreate: number;
  factsWouldCreate: 0;
  wishesWouldCreate: 0;
};

export type PlannedReview = {
  importRowKey: string;
  reasonCode: string;
  issueText?: string | null;
  resolutionText?: string | null;
};

export type PlannedSourceNote = {
  importRowKey: string;
  sourceSheet: string;
  sourceField: string;
  text: string;
};

export type ProjectPlanAction = "exact-link" | "review-unlinked" | "unresolved";

export type PlannedProject = {
  row: ParsedProjectRow;
  action: ProjectPlanAction;
};

export type WorkbookSidePlan = {
  projects: PlannedProject[];
  reviews: PlannedReview[];
  notes: PlannedSourceNote[];
  manifest: ClientMemoryImportManifest;
};

export function duplicatePeopleNames(parsed: ParsedWorkbook): Set<string> {
  const duplicateNames = new Set<string>();
  for (const [name, count] of parsed.peopleNameCounts) {
    if (count !== 1) duplicateNames.add(name);
  }
  return duplicateNames;
}

export function uniqueReviewKey(review: PlannedReview): string {
  return `${review.importRowKey}\0${review.reasonCode}`;
}

export function dedupeReviews(reviews: PlannedReview[]): PlannedReview[] {
  const seen = new Set<string>();
  const out: PlannedReview[] = [];
  for (const review of reviews) {
    const key = uniqueReviewKey(review);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(review);
  }
  return out;
}

export function reviewsForPersonEvaluation(
  row: ParsedPersonRow,
  evaluation: PersonRowEvaluation,
): PlannedReview[] {
  const reviews: PlannedReview[] = [];
  for (const reasonCode of evaluation.reviewReasons) {
    reviews.push({ importRowKey: row.importRowKey, reasonCode });
  }
  if (
    evaluation.eligibility === "eligible" ||
    evaluation.eligibility === "identity-conflict"
  ) {
    for (const reasonCode of evaluation.identityWarnings) {
      reviews.push({ importRowKey: row.importRowKey, reasonCode });
    }
  }
  return reviews;
}

export function planProjectsAndNotes(
  parsed: ParsedWorkbook,
  eligibleUniqueNames: Set<string>,
): { projects: PlannedProject[]; reviews: PlannedReview[]; notes: PlannedSourceNote[] } {
  const projects: PlannedProject[] = [];
  const reviews: PlannedReview[] = [];
  const notes: PlannedSourceNote[] = [];

  for (const row of parsed.projects) {
    if (row.matchJudgment === "no-exact") {
      projects.push({ row, action: "unresolved" });
      continue;
    }

    const exactLink =
      row.matchJudgment === "exact" &&
      Boolean(row.canonicalClient) &&
      eligibleUniqueNames.has(row.canonicalClient);
    const action: ProjectPlanAction = exactLink ? "exact-link" : "review-unlinked";
    projects.push({ row, action });

    if (action === "review-unlinked") {
      reviews.push({
        importRowKey: row.importRowKey,
        reasonCode:
          row.matchJudgment === "malformed-source-value"
            ? "REVIEW_MALFORMED_PROJECT_MATCH"
            : row.matchJudgment === "exact"
              ? "REVIEW_EXACT_NAME_NOT_UNIQUE_OR_UNIMPORTED"
              : "REVIEW_PROJECT_PERSON_LINK",
      });
    }

    if (row.gmailThread.status === "invalid") {
      reviews.push({
        importRowKey: row.importRowKey,
        reasonCode: "REVIEW_INVALID_GMAIL_THREAD_ID",
      });
      notes.push({
        importRowKey: row.importRowKey,
        sourceSheet: "Reconciled Projects",
        sourceField: "Gmail Thread ID",
        text: row.gmailThread.source,
      });
    }
    if (isProseCandidate(row.notes)) {
      notes.push({
        importRowKey: row.importRowKey,
        sourceSheet: "Reconciled Projects",
        sourceField: "Notes",
        text: cellText(row.notes),
      });
    }
    if (row.reviewFlagProse) {
      notes.push({
        importRowKey: row.importRowKey,
        sourceSheet: "Reconciled Projects",
        sourceField: "Review Flag",
        text: row.reviewFlagProse,
      });
    }
  }

  for (const row of parsed.reviewQueue) {
    reviews.push({
      importRowKey: row.importRowKey,
      reasonCode: "REVIEW_QUEUE_SEEDED",
      issueText: row.issue || null,
      resolutionText: row.recommendedResolution || null,
    });
  }

  return { projects, reviews, notes };
}

export function buildWorkbookSidePlan(
  parsed: ParsedWorkbook,
  people: Array<{ row: ParsedPersonRow; evaluation: PersonRowEvaluation }>,
  importedUniqueNames?: Set<string>,
): WorkbookSidePlan {
  const duplicateNames = duplicatePeopleNames(parsed);
  const eligibleUniqueNames = importedUniqueNames ?? new Set<string>();
  const personReviews: PlannedReview[] = [];
  if (!importedUniqueNames) {
    for (const { row, evaluation } of people) {
      if (
        evaluation.eligibility === "eligible" &&
        row.name &&
        !duplicateNames.has(row.name)
      ) {
        eligibleUniqueNames.add(row.name);
      }
    }
  }
  for (const { row, evaluation } of people) {
    personReviews.push(...reviewsForPersonEvaluation(row, evaluation));
  }

  const planned = planProjectsAndNotes(parsed, eligibleUniqueNames);
  const reviews = dedupeReviews([...personReviews, ...planned.reviews]);
  const manifest = buildImportManifest({
    parsed,
    evaluations: people.map((item) => item.evaluation),
    projects: planned.projects,
    reviewsWouldOpen: reviews.length,
    sourceNotesWouldCreate: planned.notes.length,
  });
  return {
    projects: planned.projects,
    reviews,
    notes: planned.notes,
    manifest,
  };
}

export function buildImportManifest(input: {
  parsed: ParsedWorkbook;
  evaluations: PersonRowEvaluation[];
  projects: PlannedProject[];
  reviewsWouldOpen: number;
  sourceNotesWouldCreate: number;
}): ClientMemoryImportManifest {
  let personCandidates = 0;
  let personsEligible = 0;
  let personsNeedsReview = 0;
  let identityWarnings = 0;
  let identityConflicts = 0;
  for (const evaluation of input.evaluations) {
    identityWarnings += evaluation.identityWarnings.length;
    if (evaluation.eligibility === "eligible") personsEligible += 1;
    if (evaluation.eligibility === "needs-review") personsNeedsReview += 1;
    if (evaluation.eligibility === "identity-conflict") identityConflicts += 1;
  }
  for (const row of input.parsed.people) {
    if (row.classification === "person-candidate") personCandidates += 1;
  }

  let projectsExactEligible = 0;
  let projectsReviewLink = 0;
  let projectsUnresolved = 0;
  for (const project of input.projects) {
    if (project.action === "exact-link") projectsExactEligible += 1;
    else if (project.action === "review-unlinked") projectsReviewLink += 1;
    else projectsUnresolved += 1;
  }

  const projectsWouldCreate =
    projectsExactEligible + projectsReviewLink;

  return {
    peopleRows: input.parsed.people.length,
    personCandidates,
    personsEligible,
    personsNeedsReview,
    identityWarnings,
    identityConflicts,
    projectsExactEligible,
    projectsReviewLink,
    projectsUnresolved,
    reviewsWouldOpen: input.reviewsWouldOpen,
    sourceNotesWouldCreate: input.sourceNotesWouldCreate,
    relationshipsWouldCreate: projectsExactEligible,
    projectsWouldCreate,
    factsWouldCreate: 0,
    wishesWouldCreate: 0,
  };
}
