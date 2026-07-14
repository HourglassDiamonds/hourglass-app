import { event as gtagEvent } from "@/lib/gtag";
import type { ConversationVideoProvider } from "./episodes";

export const CONVERSATION_VIDEO_PROGRESS_MILESTONES = [
  25, 50, 75, 90,
] as const;

export type ConversationVideoProgressMilestone =
  (typeof CONVERSATION_VIDEO_PROGRESS_MILESTONES)[number];

export type ConversationAnalyticsParams = {
  episode_slug: string;
  season?: number;
  episode_number?: number;
  video_provider?: ConversationVideoProvider | "none";
  progress_milestone?: ConversationVideoProgressMilestone | 100;
  destination_type?: "article" | "tool" | "concierge";
  destination_path?: string;
};

const SAFE_PARAM_MAX = {
  episode_slug: 80,
  destination_path: 120,
} as const;

/** Strip control chars; reject emails/phones; keep path-safe tokens. */
export function sanitizeConversationAnalyticsValue(
  value: unknown,
  maxLength: number,
): string | undefined {
  if (typeof value !== "string") return undefined;
  let cleaned = value.trim().slice(0, maxLength);
  if (!cleaned) return undefined;
  cleaned = cleaned.replace(/[\u0000-\u001f\u007f]/g, "");
  if (!cleaned) return undefined;
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(cleaned)) return undefined;
  if (/\+?\d[\d\s().-]{8,}\d/.test(cleaned)) return undefined;
  if (!/^[a-zA-Z0-9_./:%+\-]+$/.test(cleaned)) {
    cleaned = cleaned.replace(/[^a-zA-Z0-9_./:%+\-]+/g, "");
  }
  cleaned = cleaned.trim().slice(0, maxLength);
  return cleaned || undefined;
}

export function buildConversationAnalyticsPayload(
  params: ConversationAnalyticsParams,
): Record<string, string | number> {
  const payload: Record<string, string | number> = {};

  const slug = sanitizeConversationAnalyticsValue(
    params.episode_slug,
    SAFE_PARAM_MAX.episode_slug,
  );
  if (slug) payload.episode_slug = slug;

  if (typeof params.season === "number" && Number.isFinite(params.season)) {
    payload.season = Math.trunc(params.season);
  }

  if (
    typeof params.episode_number === "number" &&
    Number.isFinite(params.episode_number)
  ) {
    payload.episode_number = Math.trunc(params.episode_number);
  }

  if (params.video_provider) {
    payload.video_provider = params.video_provider;
  }

  if (typeof params.progress_milestone === "number") {
    payload.progress_milestone = params.progress_milestone;
  }

  if (params.destination_type) {
    payload.destination_type = params.destination_type;
  }

  const destination = sanitizeConversationAnalyticsValue(
    params.destination_path,
    SAFE_PARAM_MAX.destination_path,
  );
  if (destination) payload.destination_path = destination;

  return payload;
}

function track(
  eventName: string,
  params: ConversationAnalyticsParams,
): void {
  if (typeof window === "undefined") return;
  try {
    gtagEvent(eventName, buildConversationAnalyticsPayload(params));
  } catch {
    /* provider missing or blocked */
  }
}

export function trackConversationVideoStarted(
  params: ConversationAnalyticsParams,
): void {
  track("conversation_video_started", params);
}

export function trackConversationVideoProgress(
  params: ConversationAnalyticsParams & {
    progress_milestone: ConversationVideoProgressMilestone;
  },
): void {
  track("conversation_video_progress", params);
}

export function trackConversationVideoCompleted(
  params: ConversationAnalyticsParams,
): void {
  track("conversation_video_completed", {
    ...params,
    progress_milestone: 100,
  });
}

export function trackConversationRelatedResourceClicked(
  params: ConversationAnalyticsParams & {
    destination_type: "article" | "tool";
    destination_path: string;
  },
): void {
  track("conversation_related_resource_clicked", params);
}

export function trackConversationConciergeClicked(
  params: ConversationAnalyticsParams & {
    destination_path?: string;
  },
): void {
  track("conversation_concierge_clicked", {
    ...params,
    destination_type: "concierge",
    destination_path: params.destination_path ?? "/concierge",
  });
}

/**
 * Returns the next progress milestones crossed by `percent`, excluding any
 * already recorded in `fired`. Each milestone fires at most once per page view.
 */
export function resolveNewProgressMilestones(
  percent: number,
  fired: ReadonlySet<number>,
): ConversationVideoProgressMilestone[] {
  const next: ConversationVideoProgressMilestone[] = [];
  for (const milestone of CONVERSATION_VIDEO_PROGRESS_MILESTONES) {
    if (percent >= milestone && !fired.has(milestone)) {
      next.push(milestone);
    }
  }
  return next;
}

export function buildConversationConciergeHref(slug: string): string {
  const safeSlug =
    sanitizeConversationAnalyticsValue(slug, SAFE_PARAM_MAX.episode_slug) ??
    slug;
  const params = new URLSearchParams({
    tool: "conversations",
    content: safeSlug,
  });
  return `/concierge?${params.toString()}`;
}
