/**
 * Read-only Content inventory from repository sources.
 *
 * Deployment-safe: static imports of conversation episodes + theme registries.
 * No filesystem walks, no worktree paths, no marketing-sprint directory scans,
 * no customer data, no transcript dumps in output.
 *
 * Critical: repository material/theme truth is NOT publication-state truth.
 * Without a verified publishing adapter or explicit publication ledger,
 * publicationState remains `unknown` — never inferred from draft labels.
 */

import {
  CONVERSATION_EPISODES,
  type ConversationEpisode,
} from "@/lib/conversations/episodes";
import {
  MESSAGE_TERRITORIES,
  PLANNED_CONVERSATION_TOPICS,
  RESERVE_BACKLOG_CONVERSATION_TOPICS,
  type MessageTerritory,
  type PlannedConversationTopic,
} from "./themes";

/** Repository material readiness — independent of live publish/schedule state. */
export type ContentMaterialState =
  | "source-material-exists"
  | "planned"
  | "incomplete"
  | "unknown";

/**
 * Verified publishing/scheduling state only.
 * Must not be inferred from draft labels, registry presence, or missing Buffer.
 */
export type ContentPublicationState =
  | "verified-published"
  | "verified-scheduled"
  | "verified-unpublished"
  | "unknown";

/** How complete publication coverage is for this inventory snapshot. */
export type ContentInventoryCompleteness = "complete" | "partial" | "unknown";

export type ContentInventoryItem = {
  id: string;
  kind: "conversation-episode" | "planned-topic" | "message-territory" | "reserve-backlog-topic";
  title: string;
  topic: string;
  format: "founder-conversation" | "theme" | "planned-map";
  /** @deprecated Prefer materialState + publicationState */
  status: "draft" | "published" | "planned" | "covered";
  materialState: ContentMaterialState;
  publicationState: ContentPublicationState;
  /** Registry draft/published label as material metadata only — not operational publish proof */
  registryMaterialLabel?: "draft" | "published" | "planned" | "covered";
  funnelStage: string;
  audience: string;
  sourceReference: string;
  relatedGuide?: string | null;
  relatedTool?: string | null;
  relatedConcierge?: string | null;
  parentSlug?: string | null;
  messageTags: string[];
  /** Never include full transcript text */
  hasTranscript: boolean;
  hasVideoSource: boolean;
  /** Registry date field if present — not proof of live publication */
  registryDateHint?: string | null;
};

export type ContentInventorySnapshot = {
  episodeCount: number;
  /** Count of registry rows labeled published — NOT verified live publish count */
  registryLabeledPublishedCount: number;
  /** Count of registry rows labeled draft — material label only */
  registryLabeledDraftCount: number;
  plannedTopicCount: number;
  reserveBacklogTopicCount: number;
  messageTerritoryCount: number;
  uncoveredTerritoryCount: number;
  inventoryCompleteness: ContentInventoryCompleteness;
  publicationCoverageNote: string;
  hasVerifiedPublicationLedger: boolean;
  hasVerifiedSocialAdapter: boolean;
  items: ContentInventoryItem[];
  episodes: ConversationEpisode[];
  /** Active reserved Conversation sequence (canonical) */
  plannedTopics: PlannedConversationTopic[];
  /** Older planned themes preserved for inspectability — not active sequence */
  reserveBacklogTopics: PlannedConversationTopic[];
  territories: MessageTerritory[];
};

export type InspectContentInventoryOptions = {
  /** True only when a verified Buffer/social adapter returned live data */
  socialAdapterAvailable?: boolean;
  /** True only when an explicit verified publication ledger is connected */
  publicationLedgerAvailable?: boolean;
  /** Optional verified publication overrides keyed by episode slug (tests / future adapter) */
  verifiedPublicationBySlug?: Record<string, ContentPublicationState>;
};

export function inspectContentInventory(
  episodes: ConversationEpisode[] = CONVERSATION_EPISODES,
  options: InspectContentInventoryOptions = {},
): ContentInventorySnapshot {
  const socialAdapterAvailable = options.socialAdapterAvailable === true;
  const publicationLedgerAvailable = options.publicationLedgerAvailable === true;
  const verifiedMap = options.verifiedPublicationBySlug ?? {};

  const items: ContentInventoryItem[] = [];

  for (const ep of episodes) {
    const materialState = deriveEpisodeMaterialState(ep);
    const publicationState = publicationLedgerAvailable
      ? (verifiedMap[ep.slug] ?? "unknown")
      : "unknown";

    items.push({
      id: `episode:${ep.slug}`,
      kind: "conversation-episode",
      title: ep.title,
      topic: ep.topicLabel ?? ep.centralIdea.slice(0, 80),
      format: "founder-conversation",
      status: ep.status,
      materialState,
      publicationState,
      registryMaterialLabel: ep.status,
      funnelStage: "trust",
      audience: "engagement-buyers",
      sourceReference: `lib/conversations/episodes.ts#${ep.slug}`,
      relatedGuide: ep.relatedArticle?.href ?? null,
      relatedTool: ep.relatedTool?.href ?? null,
      relatedConcierge: "/concierge",
      parentSlug: null,
      messageTags: [ep.slug, ep.topicLabel ?? "conversations"].filter(Boolean),
      hasTranscript: ep.transcript.length > 0,
      hasVideoSource: Boolean(ep.video?.playbackId || ep.video?.src),
      registryDateHint: ep.publishedAt ?? null,
    });
  }

  for (const topic of PLANNED_CONVERSATION_TOPICS) {
    items.push({
      id: `planned:${topic.id}`,
      kind: "planned-topic",
      title: topic.title,
      topic: topic.id,
      format: "planned-map",
      status: "planned",
      materialState: "planned",
      publicationState: "unknown",
      registryMaterialLabel: "planned",
      funnelStage: topic.funnelStage,
      audience: "engagement-buyers",
      sourceReference: `lib/agent-os/content/editorial-sequence.ts#${topic.id}`,
      relatedGuide: topic.relatedGuideSlug
        ? `/diamond-guide/${topic.relatedGuideSlug}`
        : null,
      relatedTool: topic.relatedToolPath ?? null,
      relatedConcierge: topic.relatedToolPath === "/concierge" ? "/concierge" : null,
      parentSlug: topic.sequenceAfter ?? null,
      messageTags: [topic.id, "reserved-sequence"],
      hasTranscript: false,
      hasVideoSource: false,
      registryDateHint: null,
    });
  }

  for (const topic of RESERVE_BACKLOG_CONVERSATION_TOPICS) {
    items.push({
      id: `reserve-backlog:${topic.id}`,
      kind: "reserve-backlog-topic",
      title: topic.title,
      topic: topic.id,
      format: "planned-map",
      status: "planned",
      materialState: "planned",
      publicationState: "unknown",
      registryMaterialLabel: "planned",
      funnelStage: topic.funnelStage,
      audience: "engagement-buyers",
      sourceReference: `lib/agent-os/content/editorial-sequence.ts#reserve:${topic.id}`,
      relatedGuide: topic.relatedGuideSlug
        ? `/diamond-guide/${topic.relatedGuideSlug}`
        : null,
      relatedTool: topic.relatedToolPath ?? null,
      relatedConcierge: topic.relatedToolPath === "/concierge" ? "/concierge" : null,
      parentSlug: topic.sequenceAfter ?? null,
      messageTags: [topic.id, "reserve-backlog"],
      hasTranscript: false,
      hasVideoSource: false,
      registryDateHint: null,
    });
  }

  for (const territory of MESSAGE_TERRITORIES) {
    const covered = territory.coveredByEpisodeSlugs.length > 0;
    items.push({
      id: `territory:${territory.id}`,
      kind: "message-territory",
      title: territory.label,
      topic: territory.id,
      format: "theme",
      status: covered ? "covered" : "planned",
      materialState: covered ? "source-material-exists" : "planned",
      publicationState: "unknown",
      registryMaterialLabel: covered ? "covered" : "planned",
      funnelStage: "awareness",
      audience: "engagement-buyers",
      sourceReference: `lib/agent-os/content/themes.ts#${territory.id}`,
      messageTags: [territory.id],
      hasTranscript: false,
      hasVideoSource: false,
    });
  }

  const registryLabeledPublishedCount = episodes.filter(
    (e) => e.status === "published",
  ).length;
  const registryLabeledDraftCount = episodes.filter(
    (e) => e.status === "draft",
  ).length;
  const uncoveredTerritoryCount = MESSAGE_TERRITORIES.filter(
    (t) => t.coveredByEpisodeSlugs.length === 0,
  ).length;

  const inventoryCompleteness = resolveInventoryCompleteness({
    socialAdapterAvailable,
    publicationLedgerAvailable,
  });

  return {
    episodeCount: episodes.length,
    registryLabeledPublishedCount,
    registryLabeledDraftCount,
    plannedTopicCount: PLANNED_CONVERSATION_TOPICS.length,
    reserveBacklogTopicCount: RESERVE_BACKLOG_CONVERSATION_TOPICS.length,
    messageTerritoryCount: MESSAGE_TERRITORIES.length,
    uncoveredTerritoryCount,
    inventoryCompleteness,
    publicationCoverageNote:
      inventoryCompleteness === "complete"
        ? "Verified publication ledger and social adapter connected"
        : "Publication/scheduling state cannot be reconciled — Buffer/social unavailable, no verified publication ledger, marketing-sprint assets not in this worktree, external platform history not readable",
    hasVerifiedPublicationLedger: publicationLedgerAvailable,
    hasVerifiedSocialAdapter: socialAdapterAvailable,
    items: items.slice(0, 50),
    episodes,
    plannedTopics: PLANNED_CONVERSATION_TOPICS,
    reserveBacklogTopics: RESERVE_BACKLOG_CONVERSATION_TOPICS,
    territories: MESSAGE_TERRITORIES,
  };
}

function deriveEpisodeMaterialState(
  ep: ConversationEpisode,
): ContentMaterialState {
  const hasCore =
    Boolean(ep.title) &&
    Boolean(ep.centralIdea) &&
    (ep.keyIdeas?.length ?? 0) > 0;
  if (!hasCore) return "incomplete";
  if (!ep.video?.playbackId && !ep.video?.src) return "incomplete";
  return "source-material-exists";
}

function resolveInventoryCompleteness(input: {
  socialAdapterAvailable: boolean;
  publicationLedgerAvailable: boolean;
}): ContentInventoryCompleteness {
  if (input.socialAdapterAvailable && input.publicationLedgerAvailable) {
    return "complete";
  }
  // Current production posture: partial publication coverage
  return "partial";
}

/** Stable ID for the publication-inventory measurement gap (Decision Journal–ready). */
export const CONTENT_PUBLICATION_INVENTORY_GAP_ID =
  "content:derived:content-measurement-gap:publication-inventory-ledger";
