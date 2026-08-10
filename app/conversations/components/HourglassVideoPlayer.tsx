"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { useReducedMotion } from "@/app/shared-components/motion/useReducedMotion";
import {
  resolveNewProgressMilestones,
  trackConversationVideoCompleted,
  trackConversationVideoProgress,
  trackConversationVideoStarted,
} from "@/lib/conversations/analytics";
import type {
  ConversationCaptionTrack,
  ConversationEpisode,
  ConversationVideoSource,
} from "@/lib/conversations/episodes";
import {
  episodeHasPlayableVideo,
  shouldShowTemporaryPlaybackNote,
} from "@/lib/conversations/episodes";
import {
  buildYouTubeEmbedUrl,
  buildYouTubeIframeTitle,
  normalizeYouTubeVideoId,
} from "@/lib/conversations/youtube";

type HourglassVideoPlayerProps = {
  episode: ConversationEpisode;
  className?: string;
};

type MuxPlayerProps = {
  playbackId: string;
  poster?: string;
  streamType?: string;
  preload?: string;
  playsInline?: boolean;
  autoPlay?: boolean;
  className?: string;
  style?: CSSProperties;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  onPlay?: () => void;
  onTimeUpdate?: (event: Event) => void;
  onEnded?: () => void;
  onError?: () => void;
  children?: React.ReactNode;
  "aria-labelledby"?: string;
};

function captionTracksFor(
  episode: ConversationEpisode,
  video?: ConversationVideoSource,
): ConversationCaptionTrack[] {
  return video?.captions ?? episode.captions ?? [];
}

function analyticsBase(episode: ConversationEpisode) {
  return {
    episode_slug: episode.slug,
    season: episode.season,
    episode_number: episode.episodeNumber,
    video_provider: episode.video?.provider ?? ("none" as const),
  };
}

export default function HourglassVideoPlayer({
  episode,
  className = "",
}: HourglassVideoPlayerProps) {
  const playable = episodeHasPlayableVideo(episode);
  const showTemporaryNote = shouldShowTemporaryPlaybackNote(episode);
  const video = episode.video;
  const poster = video?.poster ?? episode.poster;
  const captions = captionTracksFor(episode, video);
  const reducedMotion = useReducedMotion();
  const labelId = useId();

  const [activated, setActivated] = useState(false);
  const [MuxPlayer, setMuxPlayer] = useState<ComponentType<MuxPlayerProps> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fileVideoRef = useRef<HTMLVideoElement | null>(null);
  const startedRef = useRef(false);
  const completedRef = useRef(false);
  const firedMilestonesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!activated || video?.provider !== "mux" || !video.playbackId) return;

    let cancelled = false;
    setLoading(true);

    void import("@mux/mux-player-react")
      .then((mod) => {
        if (cancelled) return;
        setMuxPlayer(() => mod.default as ComponentType<MuxPlayerProps>);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Video could not be loaded. Please try again later.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activated, video?.playbackId, video?.provider]);

  const markStarted = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    trackConversationVideoStarted(analyticsBase(episode));
  }, [episode]);

  const handleProgressPercent = useCallback(
    (percent: number) => {
      const crossed = resolveNewProgressMilestones(
        percent,
        firedMilestonesRef.current,
      );
      for (const milestone of crossed) {
        firedMilestonesRef.current.add(milestone);
        trackConversationVideoProgress({
          ...analyticsBase(episode),
          progress_milestone: milestone,
        });
      }
    },
    [episode],
  );

  const markCompleted = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    handleProgressPercent(100);
    trackConversationVideoCompleted(analyticsBase(episode));
  }, [episode, handleProgressPercent]);

  const activate = useCallback(() => {
    if (!playable) return;
    setError(null);
    setActivated(true);
    // YouTube iframe has no native progress API here — count activation as start.
    if (video?.provider === "youtube") {
      markStarted();
    }
  }, [markStarted, playable, video?.provider]);

  useEffect(() => {
    if (!activated || video?.provider !== "file") return;
    const el = fileVideoRef.current;
    if (!el) return;
    void el
      .play()
      .then(() => markStarted())
      .catch(() => {
        setError(
          "Playback could not start. Use the player controls to try again.",
        );
      });
  }, [activated, markStarted, video?.provider]);

  const onFileTimeUpdate = useCallback(() => {
    const el = fileVideoRef.current;
    if (!el || !el.duration || !Number.isFinite(el.duration)) return;
    handleProgressPercent((el.currentTime / el.duration) * 100);
  }, [handleProgressPercent]);

  const onMuxTimeUpdate = useCallback(
    (event: Event) => {
      const target = event.currentTarget as unknown as {
        currentTime?: number;
        duration?: number;
      };
      const current = target.currentTime ?? 0;
      const duration = target.duration ?? 0;
      if (!duration || !Number.isFinite(duration)) return;
      handleProgressPercent((current / duration) * 100);
    },
    [handleProgressPercent],
  );

  const onPreviewKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate();
    }
  };

  const shellClass = [
    "relative aspect-[16/9] w-full overflow-hidden rounded-[22px] border border-[#2a2622] bg-[#1c1a18]",
    "shadow-[0_18px_48px_rgba(28,24,20,0.18)]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <div className={shellClass}>
      <p id={labelId} className="sr-only">
        {episode.title}
        {episode.durationLabel ? ` — ${episode.durationLabel}` : ""}
      </p>

      {!activated || !playable ? (
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- poster may be SVG; avoid Next image SVG restrictions */}
          <img
            src={poster}
            alt=""
            width={1920}
            height={1080}
            className="absolute inset-0 h-full w-full object-cover"
            decoding="async"
            fetchPriority="high"
          />
          <div
            className={
              playable
                ? "absolute inset-0 bg-gradient-to-t from-[#141210]/70 via-[#141210]/25 to-transparent"
                : "absolute inset-0 bg-gradient-to-t from-[#141210]/28 via-transparent to-transparent"
            }
            aria-hidden
          />

          {playable ? (
            <button
              type="button"
              onClick={activate}
              onKeyDown={onPreviewKeyDown}
              aria-labelledby={labelId}
              aria-label={`Play ${episode.title}`}
              className={[
                "absolute inset-0 flex items-center justify-center",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-6px] focus-visible:outline-hg-focus",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-flex min-h-11 min-w-[11rem] items-center justify-center gap-3",
                  "rounded-full border border-white/25 bg-[#1c1a18]/78 px-7 py-3",
                  "text-[11px] uppercase tracking-[0.28em] text-[#f4eee6]",
                  "transition-[background-color,transform,border-color] duration-500",
                  "hover:border-white/40 hover:bg-[#1c1a18]/9",
                  reducedMotion ? "" : "hover:-translate-y-px",
                ].join(" ")}
              >
                <span
                  aria-hidden
                  className="inline-block h-0 w-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-[#f4eee6]"
                />
                Watch the Conversation
              </span>
            </button>
          ) : null}
        </div>
      ) : null}

      {activated && playable && video?.provider === "file" && video.src ? (
        <video
          ref={fileVideoRef}
          className="absolute inset-0 h-full w-full bg-black object-contain"
          controls
          playsInline
          preload="metadata"
          poster={poster}
          aria-labelledby={labelId}
          onPlay={markStarted}
          onTimeUpdate={onFileTimeUpdate}
          onEnded={markCompleted}
          onError={() =>
            setError("Video could not be loaded. Please try again later.")
          }
        >
          <source src={video.src} />
          {captions.map((track) => (
            <track
              key={track.src}
              kind="captions"
              src={track.src}
              srcLang={track.srclang}
              label={track.label}
              default={track.default}
            />
          ))}
        </video>
      ) : null}

      {activated &&
      playable &&
      video?.provider === "youtube" &&
      normalizeYouTubeVideoId(video.youtubeVideoId) ? (
        <iframe
          title={buildYouTubeIframeTitle(episode.title)}
          src={buildYouTubeEmbedUrl(video.youtubeVideoId!, { autoplay: true })}
          className="absolute inset-0 h-full w-full border-0 bg-black"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
        />
      ) : null}

      {activated &&
      playable &&
      video?.provider === "mux" &&
      video.playbackId &&
      MuxPlayer ? (
        <MuxPlayer
          playbackId={video.playbackId}
          poster={poster}
          streamType="on-demand"
          preload="metadata"
          playsInline
          autoPlay
          className="absolute inset-0 h-full w-full"
          style={
            {
              "--media-object-fit": "contain",
              "--controls-backdrop-color": "rgba(28,26,24,0.72)",
            } as CSSProperties
          }
          primaryColor="#f4eee6"
          secondaryColor="#1c1a18"
          accentColor="#ad9164"
          aria-labelledby={labelId}
          onPlay={markStarted}
          onTimeUpdate={onMuxTimeUpdate}
          onEnded={markCompleted}
          onError={() =>
            setError("Video could not be loaded. Please try again later.")
          }
        >
          {captions.map((track) => (
            <track
              key={track.src}
              kind="captions"
              src={track.src}
              srcLang={track.srclang}
              label={track.label}
              default={track.default}
            />
          ))}
        </MuxPlayer>
      ) : null}

      {activated && loading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1c1a18]/55">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#cbbda9]">
            Loading
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="absolute inset-x-0 bottom-0 z-10 border-t border-white/10 bg-[#1c1a18]/92 px-5 py-4 text-center">
          <p className="text-[0.9rem] leading-[1.6] text-[#efe8de]">{error}</p>
          <button
            type="button"
            className="mt-3 min-h-11 rounded-full border border-white/25 px-5 text-[10px] uppercase tracking-[0.26em] text-[#f4eee6] transition hover:border-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hg-focus"
            onClick={() => {
              setError(null);
              setActivated(false);
              startedRef.current = false;
              completedRef.current = false;
              firedMilestonesRef.current = new Set();
            }}
          >
            Return to poster
          </button>
        </div>
      ) : null}
      </div>

      {showTemporaryNote ? (
        <p className="mt-5 text-center text-[0.92rem] leading-[1.7] text-[#6d655e]">
          The finished conversation will play in this frame. Poster and
          transcript are ready for review while the master is prepared.
        </p>
      ) : null}
    </div>
  );
}
