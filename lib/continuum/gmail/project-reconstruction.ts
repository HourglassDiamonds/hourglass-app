/**
 * Jewelry-type-aware Project Book Reconstruction model (Slice 1A).
 * Candidate evidence only. Does not decide canonical truth.
 * Does not write Persons, specs, lifecycle, Open Jobs, Human Intake, or CoS.
 * Does not fetch related Gmail threads or attachment bytes.
 */

import type { GmailIndexedMessage } from "@/lib/continuum/client-memory/gmail/types";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import {
  classifyCadIdentifierStrength,
  extractCadJobIdentifiers,
  hasBoundedIdentifierToken,
  isStrongStructuredCadIdentifier,
} from "./cad-job-identifier";
import { extractOrderIdentifiers, isPlausibleOrderIdentifier } from "./order-identifier";
import type {
  ProtectedExactThread,
  ProtectedExactThreadAttachment,
  ProtectedExactThreadMessage,
} from "./exact-thread-payload";
import type { ExactThreadCurrentSpecs } from "./reconstruction-evidence";
import { sizeLanguageIsAmbiguous } from "./size-ambiguity";

export const JEWELRY_ITEM_TYPES = [
  "ring",
  "bracelet",
  "necklace",
  "earrings",
  "loose_stones",
  "pendant",
  "other",
] as const;

export type JewelryItemType = (typeof JEWELRY_ITEM_TYPES)[number];

export const ITEM_STATES = [
  "completed_sold",
  "approved_in_production",
  "quoted",
  "discussed_contemplated",
  "declined",
  "abandoned",
  "unknown",
] as const;

export type ItemState = (typeof ITEM_STATES)[number];

export const SIZE_TYPES = [
  "finger_size",
  "ring_size",
  "wrist_size",
  "bracelet_length",
  "necklace_length",
  "chain_length",
  "none",
  "untyped",
] as const;

export type SizeType = (typeof SIZE_TYPES)[number];

export const EVIDENCE_CONFIDENCE = [
  "strong",
  "moderate",
  "ambiguous",
  "weak",
] as const;

export type EvidenceConfidence = (typeof EVIDENCE_CONFIDENCE)[number];

export const PROJECT_LIFECYCLE_CANDIDATES = [
  "historical_closed",
  "active_open",
  "unknown",
] as const;

export type ProjectLifecycleCandidate =
  (typeof PROJECT_LIFECYCLE_CANDIDATES)[number];

export type ReconstructionEvidenceRecord = {
  kind: string;
  proposedValue: string | null;
  sizeType: SizeType | null;
  confidence: EvidenceConfidence;
  explicit: boolean;
  sourceWording: string;
  messageId: string | null;
  automaticApply: false;
};

export type ReconstructedItemCandidate = {
  itemId: string;
  itemType: JewelryItemType;
  state: ItemState;
  owned: false | true;
  sizeType: SizeType;
  sizes: ReconstructionEvidenceRecord[];
  metal: ReconstructionEvidenceRecord[];
  stones: ReconstructionEvidenceRecord[];
  stoneShape: ReconstructionEvidenceRecord[];
  stoneColor: ReconstructionEvidenceRecord[];
  stoneSource: ReconstructionEvidenceRecord[];
  cadJobNumbers: ReconstructionEvidenceRecord[];
  orderNumbers: ReconstructionEvidenceRecord[];
  designDescription: ReconstructionEvidenceRecord[];
  approvals: ReconstructionEvidenceRecord[];
  revisions: ReconstructionEvidenceRecord[];
  pricingReferences: ReconstructionEvidenceRecord[];
  attachments: readonly ProtectedExactThreadAttachment[];
  timing: ReconstructionEvidenceRecord[];
  sourceWording: string[];
};

export type IdentityNameCorrectionEvidence = {
  kind: "possible_identity_name_correction";
  personId: string;
  currentDisplayName: string;
  observedDisplayName: string;
  sourceSystem: string;
  automaticApply: false;
  automaticRename: false;
  requiresFounderApproval: true;
  correctionPath: "intentional-person-correction";
};

export type IdentityNameBoundary = {
  personId: string | null;
  duplicatePersonCreated: false;
  automaticRename: false;
  fuzzyMerge: false;
  nameCorrectionEvidence: IdentityNameCorrectionEvidence[];
  neverMergeNameOnly: boolean;
};

export type StrongProjectIdentifierKind =
  | "cad_job_number"
  | "order_number"
  | "project_date"
  | "vendor"
  | "subject_term"
  | "person_email_hash"
  | "anchor_thread";

export type IdentifierSignalStrength =
  | "strong_structured"
  | "weak_numeric"
  | "supporting";

export type StrongProjectIdentifier = {
  kind: StrongProjectIdentifierKind;
  value: string;
  strength: IdentifierSignalStrength;
};

export type RelatedThreadMatchReasonKind =
  | StrongProjectIdentifierKind
  | "cad_identifier_strong"
  | "cad_identifier_weak_numeric"
  | "vendor_supporting_only"
  | "vendor_only"
  | "internal_address_ignored";

export type RelatedThreadMatchReason = {
  kind: RelatedThreadMatchReasonKind;
  value: string;
  messageId: string;
  subject: string | null;
  detail?: string;
};

export type RelatedThreadCandidate = {
  threadId: string;
  score: number;
  strength: "exact" | "strong" | "moderate" | "weak" | "insufficient";
  reasons: RelatedThreadMatchReason[];
  matchedOn: RelatedThreadMatchReason[];
  candidateProjectId: string | null;
  requiresFounderReview: true;
  fetchApproved: false;
};

export type RelatedThreadDiscoveryHandoff = {
  anchorThreadId: string;
  identifiers: StrongProjectIdentifier[];
  candidates: RelatedThreadCandidate[];
  autoFetch: false;
  mailboxWideBodySearch: false;
  requiresFounderApprovalToFetch: true;
};

export const RECONSTRUCTION_MUTATION_BOUNDARY = {
  updatesPersons: false,
  renamesPerson: false,
  updatesProjectSpecs: false,
  callsSliceC: false,
  createsSpecRevisions: false,
  changesLifecycle: false,
  createsOpenJobs: false,
  writesHumanIntake: false,
  writesChiefOfStaff: false,
  createsToday5: false,
  fetchesAttachmentBytes: false,
  sendsGmail: false,
  modifiesGmail: false,
  applyButton: false,
  fetchesRelatedThreads: false,
  createsProjects: false,
  mergesProjects: false,
  deletesProjects: false,
  fetchesGmail: false,
} as const;

export type ReconstructionMutationBoundary =
  typeof RECONSTRUCTION_MUTATION_BOUNDARY;

export type ProjectBookReconstructionHandoff = {
  projectId: string;
  projectShape: "single_item" | "multi_item";
  lifecycle: ProjectLifecycleCandidate;
  historicalSafety: {
    remainsHistorical: boolean;
    createsOpenJobs: false;
    createsOperationalWork: false;
    lifecycleMutated: false;
  };
  items: ReconstructedItemCandidate[];
  identity: IdentityNameBoundary;
  relatedThreads: RelatedThreadDiscoveryHandoff;
  openJobs: [];
  operationalWork: [];
  proposedCanonicalWrites: [];
  mutationBoundary: ReconstructionMutationBoundary;
  automaticApply: false;
};

export type SourceNameEvidence = {
  sourceSystem: string;
  displayName: string;
  emailHash: string | null;
};

export type ReconstructionPerson = {
  personId: string;
  displayName: string;
  emailHash: string | null;
};

export type ProjectReconstructionInput = {
  projectId: string;
  currentSpecs: ExactThreadCurrentSpecs;
  currentLifecycle: ProjectLifecycleCandidate;
  existingPerson: ReconstructionPerson | null;
  sourceNameEvidence: readonly SourceNameEvidence[];
  thread: ProtectedExactThread;
  indexedMessages: readonly GmailIndexedMessage[];
};

const METAL_EVIDENCE =
  /\b(platinum|palladium|18k\s+white\s+gold|18k\s+yellow\s+gold|18k\s+rose\s+gold|14k\s+white\s+gold|14k\s+yellow\s+gold|14k\s+rose\s+gold|white\s+gold|yellow\s+gold|rose\s+gold)\b/gi;
const STONE_SHAPE_EVIDENCE =
  /\b(marquise|round|oval|pear|emerald|princess|cushion|radiant|asscher|heart)\b/gi;
const STONE_COLOR_EVIDENCE =
  /\b(champagne|fancy\s+yellow|colorless|cognac|fancy\s+pink|fancy\s+blue)\b/gi;
const STONE_SOURCE_EVIDENCE =
  /\b(?:purchased\s+from|from\s+vendor|vendor)\s+([A-Za-z][A-Za-z0-9&. -]{1,40})/gi;
const PRICING_EVIDENCE =
  /\$[\d,]+(?:\.\d{2})?|\b(?:invoice\s+total|quoted\s+at)\s+\$?[\d,]+(?:\.\d{2})?/gi;
const VENDOR_EVIDENCE =
  /\b(?:from|vendor|workshop)\s+([A-Z][A-Za-z0-9&. -]{1,40})/g;
const SIZE_VALUE = "(\\d+(?:\\.(?:0|00|25|5|50|75))?)";
const GENERIC_SUBJECT_TERMS = new Set([
  "re",
  "fw",
  "fwd",
  "hi",
  "hello",
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "for",
  "in",
  "on",
  "your",
  "our",
  "this",
  "that",
  "please",
  "see",
  "attached",
  "thanks",
  "thank",
  "you",
]);

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function excerpt(text: string, max = 160): string {
  const value = compact(text);
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}…`;
}

function record(input: {
  kind: string;
  proposedValue: string | null;
  sizeType?: SizeType | null;
  confidence: EvidenceConfidence;
  explicit?: boolean;
  sourceWording: string;
  messageId: string | null;
}): ReconstructionEvidenceRecord {
  return {
    kind: input.kind,
    proposedValue: input.proposedValue,
    sizeType: input.sizeType ?? null,
    confidence: input.confidence,
    explicit: input.explicit ?? true,
    sourceWording: excerpt(input.sourceWording),
    messageId: input.messageId,
    automaticApply: false,
  };
}

function collectRegex(
  text: string,
  pattern: RegExp,
  kind: string,
  messageId: string | null,
  extra?: Partial<Pick<ReconstructionEvidenceRecord, "sizeType" | "confidence">>,
): ReconstructionEvidenceRecord[] {
  const rows: ReconstructionEvidenceRecord[] = [];
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const proposedValue = (match[1] ?? match[0] ?? "").trim();
    if (!proposedValue) continue;
    rows.push(
      record({
        kind,
        proposedValue,
        confidence: extra?.confidence ?? "moderate",
        sizeType: extra?.sizeType,
        sourceWording: match[0],
        messageId,
      }),
    );
  }
  return rows;
}

export function classifyJewelryItemTypes(text: string): JewelryItemType[] {
  const hay = text.toLowerCase();
  const types: JewelryItemType[] = [];
  const add = (type: JewelryItemType) => {
    if (!types.includes(type)) types.push(type);
  };
  if (
    /\bloose\b[\s\S]{0,80}\b(?:stones?|diamonds?)\b/.test(hay) ||
    /\b(?:purchased|invoice)\b[\s\S]{0,80}\b(?:loose\s+)?(?:stones?|diamonds?)\b/.test(
      hay,
    )
  ) {
    add("loose_stones");
  }
  if (
    /\bbracelets?\b/.test(hay) ||
    /\bdiamonds?[-\s]by[-\s]the[-\s]yard\b/.test(hay) ||
    /\bstation\s+bracelet\b/.test(hay)
  ) {
    add("bracelet");
  }
  if (/\bnecklaces?\b/.test(hay) || /\bchain\s+length\b/.test(hay)) {
    add("necklace");
  }
  if (/\bearrings?\b/.test(hay)) add("earrings");
  if (/\bpendants?\b/.test(hay) && !/\bpendant\s+necklace\b/.test(hay)) {
    add("pendant");
  }
  if (
    /\b(?:engagement\s+)?rings?\b/.test(hay) ||
    /\b(?:wedding\s+|engagement\s+)?bands?\b/.test(hay) ||
    /\b(?:ring|finger)\s+size\b/.test(hay)
  ) {
    add("ring");
  }
  return types;
}

export type SizeEvidenceCandidate = {
  value: string;
  sizeType: SizeType;
  confidence: EvidenceConfidence;
  sourceWording: string;
};

function nearby(text: string, index: number, radius = 48): string {
  return text.slice(Math.max(0, index - radius), Math.min(text.length, index + radius));
}

function sizeTypeFromLocalContext(
  window: string,
  unitInches: boolean,
  itemType: JewelryItemType | null,
): SizeType {
  const hay = window.toLowerCase();
  if (/\b(?:ring|finger)\s+size\b/.test(hay) || /\bfinger\b/.test(hay)) {
    return unitInches ? "untyped" : "finger_size";
  }
  if (/\bwrist\b/.test(hay)) return "wrist_size";
  if (/\bbracelet\b/.test(hay) || /\bfinished\s+bracelet\s+length\b/.test(hay)) {
    return "bracelet_length";
  }
  if (/\bnecklace\b/.test(hay)) return "necklace_length";
  if (/\bchain\b/.test(hay)) return "chain_length";
  if (unitInches) {
    if (itemType === "bracelet") return "bracelet_length";
    if (itemType === "necklace") return "necklace_length";
    if (itemType === "ring" || itemType === "loose_stones" || itemType === "earrings") {
      return "untyped";
    }
    return "untyped";
  }
  if (itemType === "ring") return "finger_size";
  if (itemType === "bracelet") return "wrist_size";
  if (itemType === "necklace") return "necklace_length";
  if (itemType === "earrings" || itemType === "loose_stones") return "none";
  return "untyped";
}

export function classifySizeEvidence(
  text: string,
  itemType: JewelryItemType | null = null,
): SizeEvidenceCandidate[] {
  const rows: SizeEvidenceCandidate[] = [];
  const seen = new Set<string>();
  const patterns: Array<{ regex: RegExp; inches: boolean }> = [
    {
      regex: new RegExp(
        `\\b(?:final\\s+)?(?:bracelet|finished\\s+bracelet)\\s+(?:length|size)\\s*(?:is|=|:|of)?\\s*${SIZE_VALUE}\\s*(?:inches|inch|in\\b)?`,
        "gi",
      ),
      inches: true,
    },
    {
      regex: new RegExp(
        `\\b(?:necklace|chain)\\s+(?:length|size)\\s*(?:is|=|:|of)?\\s*${SIZE_VALUE}\\s*(?:inches|inch|in\\b)?`,
        "gi",
      ),
      inches: true,
    },
    {
      regex: new RegExp(
        `\\bwrist\\s*(?:size|measurement|length)?\\s*(?:is|=|:)?\\s*${SIZE_VALUE}\\s*(?:inches|inch|in\\b)?`,
        "gi",
      ),
      inches: true,
    },
    {
      regex: new RegExp(
        `\\b(?:ring|finger)\\s+size\\s*(?:is|=|:)?\\s*${SIZE_VALUE}\\b`,
        "gi",
      ),
      inches: false,
    },
    {
      regex: new RegExp(
        `${SIZE_VALUE}\\s*(?:-\\s*)?(?:inches|inch|in\\.)\\b`,
        "gi",
      ),
      inches: true,
    },
    {
      regex: new RegExp(
        `${SIZE_VALUE}(?=\\s+or\\s+${SIZE_VALUE}\\s*(?:inches|inch|in\\.)\\b)`,
        "gi",
      ),
      inches: true,
    },
  ];

  for (const pattern of patterns) {
    pattern.regex.lastIndex = 0;
    for (const match of text.matchAll(pattern.regex)) {
      const value = match[1]?.trim();
      if (!value) continue;
      const sourceWording = compact(match[0]);
      const window = nearby(text, match.index ?? 0);
      const sizeType = sizeTypeFromLocalContext(window, pattern.inches, itemType);
      const confidence: EvidenceConfidence = sizeLanguageIsAmbiguous(
        text,
        value,
      )
        ? "ambiguous"
        : /\bfinal\b/i.test(sourceWording)
          ? "strong"
          : "moderate";
      const key = `${sizeType}:${value}:${confidence}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ value, sizeType, confidence, sourceWording });
    }
  }

  if (itemType === "loose_stones" || itemType === "earrings") {
    return rows.filter(
      (row) => row.sizeType !== "finger_size" && row.sizeType !== "ring_size",
    );
  }
  return rows;
}

export function classifyItemState(text: string): ItemState {
  const hay = text.toLowerCase();
  if (
    /\bdeclined\b/.test(hay) ||
    /\bpassed\s+on\b/.test(hay) ||
    /\bnot\s+moving\s+forward\b/.test(hay)
  ) {
    return "declined";
  }
  if (/\babandoned\b/.test(hay) || /\bnever\s+proceeded\b/.test(hay)) {
    return "abandoned";
  }
  if (
    /\b(?:completed|purchased|sold|invoice|paid)\b/.test(hay) &&
    !/\bwe\s+discussed\b/.test(hay)
  ) {
    return "completed_sold";
  }
  if (
    /\b(?:approved|please\s+proceed|in\s+production|at\s+the\s+bench)\b/.test(hay)
  ) {
    return "approved_in_production";
  }
  if (/\b(?:quote|estimate|proposal)\b/.test(hay)) return "quoted";
  if (
    /\b(?:discussed|contemplated|concept|thinking\s+about|we\s+talked)\b/.test(
      hay,
    )
  ) {
    return "discussed_contemplated";
  }
  return "unknown";
}

function itemOwned(state: ItemState): boolean {
  return state === "completed_sold";
}

function emptyItem(itemType: JewelryItemType): ReconstructedItemCandidate {
  return {
    itemId: `item-${itemType}`,
    itemType,
    state: "unknown",
    owned: false,
    sizeType: itemType === "earrings" || itemType === "loose_stones" ? "none" : "untyped",
    sizes: [],
    metal: [],
    stones: [],
    stoneShape: [],
    stoneColor: [],
    stoneSource: [],
    cadJobNumbers: [],
    orderNumbers: [],
    designDescription: [],
    approvals: [],
    revisions: [],
    pricingReferences: [],
    attachments: [],
    timing: [],
    sourceWording: [],
  };
}

function mergeRecords(
  into: ReconstructionEvidenceRecord[],
  incoming: ReconstructionEvidenceRecord[],
): void {
  for (const row of incoming) {
    const exists = into.some(
      (existing) =>
        existing.kind === row.kind &&
        existing.proposedValue === row.proposedValue &&
        existing.sourceWording === row.sourceWording,
    );
    if (!exists) into.push(row);
  }
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => compact(part))
    .filter(Boolean);
}

function defaultSizeType(item: ReconstructedItemCandidate): SizeType {
  if (item.sizes.length === 0) {
    return item.itemType === "earrings" || item.itemType === "loose_stones"
      ? "none"
      : "untyped";
  }
  const unique = [...new Set(item.sizes.map((row) => row.sizeType).filter(Boolean))];
  if (unique.length === 1) return unique[0] as SizeType;
  return item.sizes[0]?.sizeType ?? "untyped";
}

function collectStoneMentions(
  text: string,
  messageId: string | null,
): ReconstructionEvidenceRecord[] {
  const rows: ReconstructionEvidenceRecord[] = [];
  const hay = text.toLowerCase();
  if (/\bstones?\b/.test(hay) || /\bdiamonds?\b/.test(hay)) {
    const two = /\btwo\b/.test(hay) ? "two " : "";
    rows.push(
      record({
        kind: "stones",
        proposedValue: compact(
          `${two}${/\bloose\b/.test(hay) ? "loose " : ""}${hay.includes("diamond") ? "diamonds" : "stones"}`,
        ),
        confidence: "moderate",
        sourceWording: excerpt(text),
        messageId,
      }),
    );
  }
  return rows;
}

function collectEvidenceForSpan(
  item: ReconstructedItemCandidate,
  text: string,
  message: ProtectedExactThreadMessage,
): void {
  const messageId = message.messageId;
  item.sourceWording.push(excerpt(text));
  mergeRecords(item.metal, collectRegex(text, METAL_EVIDENCE, "metal", messageId));
  mergeRecords(
    item.stoneShape,
    collectRegex(text, STONE_SHAPE_EVIDENCE, "stone_shape", messageId),
  );
  mergeRecords(
    item.stoneColor,
    collectRegex(text, STONE_COLOR_EVIDENCE, "stone_color", messageId),
  );
  mergeRecords(
    item.stoneSource,
    collectRegex(text, STONE_SOURCE_EVIDENCE, "stone_source", messageId),
  );
  mergeRecords(item.stones, collectStoneMentions(text, messageId));
  mergeRecords(
    item.orderNumbers,
    extractOrderIdentifiers(text).map((order) =>
      record({
        kind: "order_number",
        proposedValue: order,
        confidence: "strong",
        sourceWording: order,
        messageId,
      }),
    ),
  );
  mergeRecords(
    item.pricingReferences,
    collectRegex(text, PRICING_EVIDENCE, "pricing", messageId),
  );
  mergeRecords(
    item.approvals,
    collectRegex(
      text,
      /\b(approved|looks great|please proceed|we(?:'| a)re good)\b/gi,
      "approval",
      messageId,
    ),
  );
  mergeRecords(
    item.revisions,
    collectRegex(
      text,
      /\b(please (?:change|revise|update)|can we (?:change|make|revise)|revision requested)\b/gi,
      "revision",
      messageId,
    ),
  );
  for (const cadId of extractCadJobIdentifiers(text)) {
    const cadStrength = classifyCadIdentifierStrength(cadId);
    mergeRecords(item.cadJobNumbers, [
      record({
        kind: "cad_job_number",
        proposedValue: cadId,
        confidence: cadStrength === "strong_structured" ? "strong" : "weak",
        sourceWording: cadId,
        messageId,
      }),
    ]);
  }
  if (/\b(?:station|diamonds?[-\s]by[-\s]the[-\s]yard|design)\b/i.test(text)) {
    mergeRecords(item.designDescription, [
      record({
        kind: "design_description",
        proposedValue: excerpt(text, 120),
        confidence: "moderate",
        sourceWording: excerpt(text),
        messageId,
      }),
    ]);
  }
  for (const size of classifySizeEvidence(text, item.itemType)) {
    if (size.sizeType === "finger_size" && item.itemType !== "ring") continue;
    if (
      (item.itemType === "loose_stones" || item.itemType === "earrings") &&
      size.sizeType !== "none"
    ) {
      continue;
    }
    mergeRecords(item.sizes, [
      record({
        kind: "size",
        proposedValue: size.value,
        sizeType: size.sizeType,
        confidence: size.confidence,
        sourceWording: size.sourceWording,
        messageId,
      }),
    ]);
  }
  if (message.internalDate) {
    mergeRecords(item.timing, [
      record({
        kind: "timing",
        proposedValue: message.internalDate,
        confidence: "strong",
        sourceWording: message.internalDate,
        messageId,
      }),
    ]);
  }
}

function namesEquivalent(left: string, right: string): boolean {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[.]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  return normalize(left) === normalize(right);
}

export function assessIdentityNameBoundary(input: {
  existingPerson: ReconstructionPerson | null;
  sourceNameEvidence: readonly SourceNameEvidence[];
}): IdentityNameBoundary {
  const evidence: IdentityNameCorrectionEvidence[] = [];
  const person = input.existingPerson;
  let neverMergeNameOnly = false;

  for (const source of input.sourceNameEvidence) {
    const observed = source.displayName.trim();
    if (!observed) continue;
    const sameEmail =
      Boolean(person?.emailHash) &&
      Boolean(source.emailHash) &&
      person?.emailHash === source.emailHash;
    if (!person) {
      neverMergeNameOnly = true;
      continue;
    }
    if (namesEquivalent(person.displayName, observed)) continue;
    if (!sameEmail && !source.emailHash) {
      neverMergeNameOnly = true;
      continue;
    }
    if (!sameEmail) {
      neverMergeNameOnly = true;
      continue;
    }
    evidence.push({
      kind: "possible_identity_name_correction",
      personId: person.personId,
      currentDisplayName: person.displayName,
      observedDisplayName: observed,
      sourceSystem: source.sourceSystem,
      automaticApply: false,
      automaticRename: false,
      requiresFounderApproval: true,
      correctionPath: "intentional-person-correction",
    });
  }

  return {
    personId: person?.personId ?? null,
    duplicatePersonCreated: false,
    automaticRename: false,
    fuzzyMerge: false,
    nameCorrectionEvidence: evidence,
    neverMergeNameOnly,
  };
}

function subjectTermsFromText(text: string): string[] {
  const terms = new Set<string>();
  for (const type of classifyJewelryItemTypes(text)) {
    terms.add(type.replace("_", " "));
  }
  for (const match of text.matchAll(STONE_SHAPE_EVIDENCE)) {
    if (match[1]) terms.add(match[1].toLowerCase());
  }
  for (const match of text.matchAll(STONE_COLOR_EVIDENCE)) {
    if (match[1]) terms.add(match[1].toLowerCase());
  }
  if (/\bdiamonds?[-\s]by[-\s]the[-\s]yard\b/i.test(text)) {
    terms.add("diamonds by the yard");
  }
  if (/\bstation\b/i.test(text)) terms.add("station");
  return [...terms];
}

export const INTERNAL_HOURGLASS_ADDRESSES = [
  "founder@hourglass.example",
  "studio@hourglass.example",
] as const;

export function internalHourglassEmailHashes(
  extra: readonly string[] = [],
): string[] {
  const hashes = [...INTERNAL_HOURGLASS_ADDRESSES, ...extra]
    .map((addr) => hashEmail(addr))
    .filter((value): value is string => Boolean(value));
  return [...new Set(hashes)];
}

function identifierStrengthFor(
  kind: StrongProjectIdentifierKind,
  value: string,
): IdentifierSignalStrength {
  if (kind === "cad_job_number") {
    return classifyCadIdentifierStrength(value) === "strong_structured"
      ? "strong_structured"
      : "weak_numeric";
  }
  if (kind === "order_number" || kind === "anchor_thread") {
    return "strong_structured";
  }
  return "supporting";
}

export function extractStrongProjectIdentifiers(input: {
  thread: ProtectedExactThread;
  currentSpecs: ExactThreadCurrentSpecs;
  personEmailHash: string | null;
  internalEmailHashes?: readonly string[];
}): StrongProjectIdentifier[] {
  const identifiers: StrongProjectIdentifier[] = [
    {
      kind: "anchor_thread",
      value: input.thread.threadId,
      strength: "strong_structured",
    },
  ];
  const seen = new Set<string>();
  const add = (
    kind: StrongProjectIdentifierKind,
    value: string,
    strength = identifierStrengthFor(kind, value),
  ) => {
    const key = `${kind}:${value.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    identifiers.push({ kind, value, strength });
  };

  if (input.currentSpecs.cadJobNumber?.trim()) {
    for (const cad of extractCadJobIdentifiers(input.currentSpecs.cadJobNumber)) {
      add("cad_job_number", cad);
    }
    const raw = input.currentSpecs.cadJobNumber.trim();
    if (isFiniteCad(raw)) add("cad_job_number", raw);
  }
  if (
    input.currentSpecs.orderNumber?.trim() &&
    isPlausibleOrderIdentifier(input.currentSpecs.orderNumber)
  ) {
    add("order_number", input.currentSpecs.orderNumber.trim());
  }
  const internal = new Set([
    ...internalHourglassEmailHashes(),
    ...(input.internalEmailHashes ?? []),
  ]);
  if (input.personEmailHash && !internal.has(input.personEmailHash)) {
    add("person_email_hash", input.personEmailHash);
  }

  for (const message of input.thread.messages) {
    const hay = [message.subject, message.plainText].filter(Boolean).join("\n");
    for (const cad of extractCadJobIdentifiers(hay)) add("cad_job_number", cad);
    for (const order of extractOrderIdentifiers(hay)) add("order_number", order);
    VENDOR_EVIDENCE.lastIndex = 0;
    for (const match of hay.matchAll(VENDOR_EVIDENCE)) {
      const vendor = match[1]?.trim();
      if (vendor && !GENERIC_SUBJECT_TERMS.has(vendor.toLowerCase())) {
        add("vendor", vendor);
      }
    }
    if (message.internalDate) add("project_date", message.internalDate);
    for (const term of subjectTermsFromText(hay)) add("subject_term", term);
  }
  return identifiers;
}

function isFiniteCad(value: string): boolean {
  return extractCadJobIdentifiers(value).length > 0 || /\d/.test(value);
}

function dateWindowMatch(indexSentAt: string, projectDates: string[]): boolean {
  const sent = Date.parse(indexSentAt);
  if (!Number.isFinite(sent)) return false;
  const windowMs = 14 * 24 * 60 * 60 * 1000;
  return projectDates.some((value) => {
    const ts = Date.parse(value);
    return Number.isFinite(ts) && Math.abs(ts - sent) <= windowMs;
  });
}

function indexedTouchesPerson(
  row: GmailIndexedMessage,
  personEmailHash: string,
): boolean {
  if (row.fromEmailHash === personEmailHash) return true;
  return (
    row.toEmailHashes.includes(personEmailHash) ||
    row.ccEmailHashes.includes(personEmailHash) ||
    row.bccEmailHashes.includes(personEmailHash)
  );
}

const DISCOVERY_CANDIDATE_THRESHOLD = 40;

function discoveryStrength(
  score: number,
): RelatedThreadCandidate["strength"] {
  if (score >= 100) return "exact";
  if (score >= 80) return "strong";
  if (score >= 40) return "moderate";
  if (score >= 15) return "weak";
  return "insufficient";
}

function uniqueDiscoveryReasons(
  reasons: RelatedThreadMatchReason[],
): RelatedThreadMatchReason[] {
  const seen = new Set<string>();
  const rows: RelatedThreadMatchReason[] = [];
  for (const reason of reasons) {
    const key = `${reason.kind}:${reason.value.toLowerCase()}:${reason.messageId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(reason);
  }
  return rows;
}

export function discoverRelatedThreadCandidates(input: {
  anchorThreadId: string;
  identifiers: readonly StrongProjectIdentifier[];
  indexedMessages: readonly GmailIndexedMessage[];
  candidateProjectId?: string | null;
  internalEmailHashes?: readonly string[];
}): RelatedThreadDiscoveryHandoff {
  const byThread = new Map<string, RelatedThreadCandidate>();
  const internal = new Set([
    ...internalHourglassEmailHashes(),
    ...(input.internalEmailHashes ?? []),
  ]);
  const strongCads = input.identifiers.filter(
    (row) =>
      row.kind === "cad_job_number" && isStrongStructuredCadIdentifier(row.value),
  );
  const weakCads = input.identifiers.filter(
    (row) =>
      row.kind === "cad_job_number" &&
      classifyCadIdentifierStrength(row.value) === "weak_numeric",
  );
  const orderIds = input.identifiers.filter(
    (row) =>
      row.kind === "order_number" && isPlausibleOrderIdentifier(row.value),
  );
  const vendors = input.identifiers
    .filter((row) => row.kind === "vendor")
    .map((row) => row.value);
  const terms = input.identifiers
    .filter((row) => row.kind === "subject_term")
    .map((row) => row.value.toLowerCase())
    .filter((term) => !GENERIC_SUBJECT_TERMS.has(term));
  const dates = input.identifiers
    .filter((row) => row.kind === "project_date")
    .map((row) => row.value);
  const personHashes = input.identifiers
    .filter((row) => row.kind === "person_email_hash")
    .map((row) => row.value)
    .filter((hash) => !internal.has(hash));

  for (const row of input.indexedMessages) {
    if (row.threadId === input.anchorThreadId) continue;
    const subject = row.subject ?? "";
    const reasons: RelatedThreadMatchReason[] = [];
    let strongScore = 0;
    let supportingScore = 0;

    for (const cad of strongCads) {
      if (!hasBoundedIdentifierToken(subject, cad.value)) continue;
      strongScore += 100;
      reasons.push({
        kind: "cad_identifier_strong",
        value: cad.value,
        messageId: row.messageId,
        subject: row.subject,
        detail: `Structured CAD/job identifier ${cad.value} is strong project identity evidence.`,
      });
    }

    for (const cad of weakCads) {
      if (!hasBoundedIdentifierToken(subject, cad.value)) continue;
      reasons.push({
        kind: "cad_identifier_weak_numeric",
        value: cad.value,
        messageId: row.messageId,
        subject: row.subject,
        detail: `Numeric CAD/job token ${cad.value} is too weak to discover a related thread by itself.`,
      });
    }

    for (const order of orderIds) {
      if (!hasBoundedIdentifierToken(subject, order.value)) continue;
      strongScore += 100;
      reasons.push({
        kind: "order_number",
        value: order.value,
        messageId: row.messageId,
        subject: row.subject,
        detail: `Validated order identifier ${order.value} is strong project identity evidence.`,
      });
    }

    const vendorHit = vendors.find((vendor) =>
      hasBoundedIdentifierToken(subject, vendor),
    );
    const personHit = personHashes.some((hash) =>
      indexedTouchesPerson(row, hash),
    );
    const termHit = terms.find(
      (term) =>
        hasBoundedIdentifierToken(subject, term) ||
        subject.toLowerCase().includes(term),
    );
    const dated = dateWindowMatch(row.sentAt, dates);

    if (strongScore > 0) {
      if (vendorHit) {
        supportingScore += 15;
        reasons.push({
          kind: "vendor_supporting_only",
          value: vendorHit,
          messageId: row.messageId,
          subject: row.subject,
          detail:
            "Vendor is supporting evidence only and cannot discover a thread by itself.",
        });
      }
      if (termHit) {
        supportingScore += 12;
        reasons.push({
          kind: "subject_term",
          value: termHit,
          messageId: row.messageId,
          subject: row.subject,
          detail: "Subject continuity is a supporting signal, not project identity.",
        });
      }
      if (dated) {
        supportingScore += 10;
        reasons.push({
          kind: "project_date",
          value: row.sentAt,
          messageId: row.messageId,
          subject: row.subject,
          detail: "Date proximity is a supporting signal, not project identity.",
        });
      }
      if (personHit) {
        supportingScore += 5;
        reasons.push({
          kind: "person_email_hash",
          value: personHashes[0] ?? "",
          messageId: row.messageId,
          subject: row.subject,
          detail: "Exact Person email hash is supporting evidence only.",
        });
      }
    } else if (vendorHit) {
      reasons.push({
        kind: "vendor_only",
        value: vendorHit,
        messageId: row.messageId,
        subject: row.subject,
        detail: "Same vendor is insufficient to discover a related thread.",
      });
    }

    const score = strongScore + supportingScore;
    if (score < DISCOVERY_CANDIDATE_THRESHOLD) continue;

    const matchedOn = uniqueDiscoveryReasons(reasons);
    const existing = byThread.get(row.threadId);
    if (!existing || score > existing.score) {
      byThread.set(row.threadId, {
        threadId: row.threadId,
        score,
        strength: discoveryStrength(score),
        reasons: matchedOn,
        matchedOn,
        candidateProjectId: input.candidateProjectId ?? null,
        requiresFounderReview: true,
        fetchApproved: false,
      });
    }
  }

  const candidates = [...byThread.values()].sort(
    (left, right) =>
      right.score - left.score || left.threadId.localeCompare(right.threadId),
  );

  return {
    anchorThreadId: input.anchorThreadId,
    identifiers: [...input.identifiers],
    candidates,
    autoFetch: false,
    mailboxWideBodySearch: false,
    requiresFounderApprovalToFetch: true,
  };
}

export function reconstructProjectBook(
  input: ProjectReconstructionInput,
): ProjectBookReconstructionHandoff {
  const items = new Map<JewelryItemType, ReconstructedItemCandidate>();
  const ensure = (type: JewelryItemType) => {
    const existing = items.get(type);
    if (existing) return existing;
    const created = emptyItem(type);
    items.set(type, created);
    return created;
  };

  for (const message of input.thread.messages) {
    const hay = [message.subject, message.plainText].filter(Boolean).join("\n");
    const sentences = splitSentences(hay);
    let inherit: JewelryItemType | null = classifyJewelryItemTypes(
      message.subject ?? "",
    )[0] ?? null;

    for (const sentence of sentences.length ? sentences : [hay]) {
      const types = classifyJewelryItemTypes(sentence);
      const active = types.length > 0 ? types : inherit ? [inherit] : [];
      if (types[0]) inherit = types[0];
      for (const type of active) {
        const item = ensure(type);
        collectEvidenceForSpan(item, sentence, message);
        const state = classifyItemState(sentence);
        if (state !== "unknown") item.state = state;
        item.owned = itemOwned(item.state);
      }
    }

    const messageTypes = classifyJewelryItemTypes(hay);
    for (const type of messageTypes) {
      const item = items.get(type);
      if (!item) continue;
      const extra = message.attachments.filter(
        (attachment) =>
          !item.attachments.some(
            (existing) => existing.attachmentId === attachment.attachmentId,
          ),
      );
      item.attachments = [...item.attachments, ...extra];
    }
  }

  const reconstructed = [...items.values()].map((item) => {
    const state = item.state === "unknown"
      ? classifyItemState(item.sourceWording.join(" "))
      : item.state;
    return {
      ...item,
      state,
      owned: itemOwned(state),
      sizeType: defaultSizeType(item),
    };
  });

  const lifecycle: ProjectLifecycleCandidate =
    input.currentLifecycle === "historical_closed"
      ? "historical_closed"
      : input.currentLifecycle;

  const identifiers = extractStrongProjectIdentifiers({
    thread: input.thread,
    currentSpecs: input.currentSpecs,
    personEmailHash: input.existingPerson?.emailHash ?? null,
  });

  return {
    projectId: input.projectId,
    projectShape: reconstructed.length > 1 ? "multi_item" : "single_item",
    lifecycle,
    historicalSafety: {
      remainsHistorical: lifecycle === "historical_closed",
      createsOpenJobs: false,
      createsOperationalWork: false,
      lifecycleMutated: false,
    },
    items: reconstructed,
    identity: assessIdentityNameBoundary({
      existingPerson: input.existingPerson,
      sourceNameEvidence: input.sourceNameEvidence,
    }),
    relatedThreads: discoverRelatedThreadCandidates({
      anchorThreadId: input.thread.threadId,
      identifiers,
      indexedMessages: input.indexedMessages,
      candidateProjectId: input.projectId,
    }),
    openJobs: [],
    operationalWork: [],
    proposedCanonicalWrites: [],
    mutationBoundary: RECONSTRUCTION_MUTATION_BOUNDARY,
    automaticApply: false,
  };
}
