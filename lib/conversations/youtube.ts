/**
 * YouTube helpers for Conversations episode playback and schema.
 * Use only real production video IDs — never invent placeholders in episode data.
 */

/** Standard 11-character YouTube video ID. */
const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function isValidYouTubeVideoId(value: string | undefined | null): boolean {
  if (!value?.trim()) return false;
  return YOUTUBE_VIDEO_ID_PATTERN.test(value.trim());
}

export function normalizeYouTubeVideoId(
  value: string | undefined | null,
): string | null {
  if (!isValidYouTubeVideoId(value)) return null;
  return value!.trim();
}

/**
 * Privacy-enhanced embed URL used after click-to-activate.
 * `autoplay=1` is only applied when the operator opts in after a user gesture.
 */
export function buildYouTubeEmbedUrl(
  videoId: string,
  options: { autoplay?: boolean } = {},
): string {
  const id = normalizeYouTubeVideoId(videoId);
  if (!id) {
    throw new Error("Invalid YouTube video ID");
  }

  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });

  if (options.autoplay) {
    params.set("autoplay", "1");
  }

  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

export function buildYouTubeWatchUrl(videoId: string): string {
  const id = normalizeYouTubeVideoId(videoId);
  if (!id) {
    throw new Error("Invalid YouTube video ID");
  }
  return `https://www.youtube.com/watch?v=${id}`;
}

export function buildYouTubeIframeTitle(episodeTitle: string): string {
  const title = episodeTitle.trim() || "Conversation";
  return `${title} — Hourglass Conversations`;
}
