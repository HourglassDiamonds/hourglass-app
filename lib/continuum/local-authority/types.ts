import type {
  AuthorityRegisterEntry,
} from "@/lib/intelligence/review-velocity/corroboration-register";
import type {
  ReviewAuthorityRow,
  ReviewCountSnapshot,
  ReviewVelocityEvidence,
} from "@/lib/intelligence/review-velocity/types";

export { TRACKED_PLACE_NAMES as TRACKED_BUSINESSES } from "@/lib/intelligence/review-velocity/types";
export type {
  AuthorityStatus as CorroborationStatus,
  CorroborationSourceId,
} from "@/lib/intelligence/review-velocity/corroboration-register";

export type EvidenceKind = "Observed" | "Static fallback";
export type WindowMonths = 3 | 6 | 12 | 24;

export type SearchSignalInput = {
  label: "Branded clicks" | "Non-branded clicks" | "Branded vs non-branded trend";
  value: string;
  trend: string | null;
  source: string;
};

export type LocalAuthorityInput = ReviewVelocityEvidence & {
  corroboration?: AuthorityRegisterEntry[];
  searchSignals: SearchSignalInput[];
  loadedAt: string;
};

export type BusinessReviewView = ReviewAuthorityRow & {
  placeIdConfirmed: boolean;
  snapshots: ReviewCountSnapshot[];
  exactReviewHistory: Array<{ observedAt: string; reviewCount: number }>;
};

/** Read-only handoff proposal. Canonical work is created only through Continuum Open Jobs. */
export type LocalAuthorityAction = {
  id: string;
  title: string;
  status: "proposed";
  priority: "high" | "medium" | "low";
  evidence: string;
  related: string;
};

export type LocalFalconEvidence = {
  latestCapturedOn: string | null;
  importedSnapshotRows: number;
  sourceReferences: string[];
};

export type LocalAuthorityWorkspace = {
  businesses: BusinessReviewView[];
  hourglass: BusinessReviewView;
  changes: string[];
  attention: string[];
  corroboration: Array<AuthorityRegisterEntry & { provenance: EvidenceKind }>;
  actions: LocalAuthorityAction[];
  localFalcon: LocalFalconEvidence;
  searchSignals: SearchSignalInput[];
  shareOfTrackedReviewGrowth: number | null;
  corroborationSummary: string;
  latestVisibilitySignal: string;
  lastUpdated: string;
  trackingStartedAt: string | null;
};
