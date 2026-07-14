# Conversations system

Reusable long-form video foundation for Hourglass Diamonds.

The website hosts a native viewing experience for Justin’s conversations. The same finished videos may also publish to YouTube and social platforms, but the Hourglass episode page remains the primary destination inside the brand ecosystem.

This document describes the publishing workflow. Media standards below are practical starting points and can be refined after the real filming and editing workflow is reviewed.

---

## Routes

| Route | Purpose |
|---|---|
| `/conversations` | Editorial hub (unavailable in production until a published episode exists) |
| `/conversations/[slug]` | Reusable episode template |

Draft episodes can be reviewed locally in development. In production they return 404, stay out of listings, stay out of the sitemap, and remain `noindex`.

---

## Content model

Episode records live in:

`lib/conversations/episodes.ts`

Each episode supports:

- identity: `slug`, `status`, `title`, `eyebrow`, `summary`
- editorial: `centralIdea`, `keyIdeas`, `transcript`
- labels: `season`, `episodeNumber`, `topicLabel`, `durationLabel`, `durationIso`, `publishedAt`
- media: `poster`, `thumbnail`, `video`, `captions`
- pathways: `relatedArticle`, `relatedTool`
- SEO: `seoTitle`, `seoDescription`, `openGraphImage`

### Publish status

- `draft` — local/design preview only
- `published` — publicly listable, indexable (when video/SEO requirements are met), sitemap-eligible

### Video source shape

```ts
video: {
  provider: "mux" | "file",
  playbackId?: string, // Mux public playback ID
  src?: string,        // CDN MP4/HLS URL for provider "file"
  poster?: string,
  captions?: Array<{ src: string; label: string; srclang: string; default?: boolean }>
}
```

Do not put large long-form masters in the Next.js `public/` folder.

---

## Publishing workflow

1. Edit the master video.
2. Export a distribution copy for YouTube (platform packaging / end screen as needed).
3. Export a clean website copy and upload it to Mux (preferred) or the selected CDN.
4. Obtain the Mux playback ID or CDN URL.
5. Create a 16:9 poster image.
6. Create a caption file (WebVTT).
7. Add or update the episode record in `lib/conversations/episodes.ts`.
8. Add the full transcript as HTML-ready paragraph sections.
9. Add one related Diamond Guide article and one Diamond Studio tool pathway when relevant.
10. Change `status` from `draft` to `published`.
11. Verify metadata, Open Graph image, and `VideoObject` schema on the episode page.
12. Add UTM links for social distribution that land on the Hourglass episode URL.

### Future Mux upload workflow

This sprint intentionally does **not** include server-side Mux upload credentials or an automated ingest pipeline.

Future workflow (documented, not built):

1. Create a Mux Direct Upload or authenticated upload from an internal tool.
2. Store only the public playback ID in the episode record.
3. Keep signing keys / tokens in environment secrets — never in episode content.
4. Optionally generate poster stills from Mux image API once a final frame is chosen.

No Mux account is required merely to build or preview the site. Without a playback ID, the player shows a polished poster preview state.

---

## Recommended media standards

These are initial recommendations, not permanently locked specs.

| Asset | Recommendation |
|---|---|
| Aspect ratio | 16:9 |
| Website master | 1080p (1920×1080), H.264, clear dialogue loudness |
| Poster | 1920×1080 JPEG or WebP, restrained Editorial still, no giant play badge burned in |
| Thumbnail / OG | 1920×1080 or 1200×630 if a dedicated social crop is preferred |
| Captions | WebVTT (`.vtt`), English first; store under `/public/media/conversations/captions/` |
| File naming | `why-we-re-here.mp4`, `why-we-re-here-poster.jpg`, `why-we-re-here.en.vtt` |
| Transcript | Plain language paragraphs with optional chapter headings; mirror spoken content closely |

Place website posters and caption files under `public/media/conversations/` (not `public/conversations/`), so static media does not collide with the `/conversations/[slug]` App Router.

### YouTube copy versus website copy

- **Website:** Clean open, no aggressive end screen, captions available, transcript on page.
- **YouTube:** May include end screens, cards, and platform-specific packaging.
- Prefer identical speech content where practical so transcript and captions stay aligned.

---

## Weekly publishing checklist

- [ ] Video plays on desktop and mobile (inline, captions, fullscreen)
- [ ] Poster renders without layout shift
- [ ] Captions present and selectable
- [ ] Transcript proofread and semantically structured
- [ ] Title, summary, SEO title/description reviewed
- [ ] `VideoObject` + breadcrumb schema valid
- [ ] Mobile QA at phone and tablet widths
- [ ] Analytics fire: start, progress milestones, complete
- [ ] Related resource clicks tracked
- [ ] Concierge CTA preserves `tool=conversations` + `content={slug}`
- [ ] Episode status set to `published`
- [ ] YouTube distribution copy published
- [ ] Social links point to Hourglass episode URL with UTMs

---

## Analytics events

Non-PII GA4 events:

- `conversation_video_started`
- `conversation_video_progress` (25 / 50 / 75 / 90 once each per page view)
- `conversation_video_completed`
- `conversation_related_resource_clicked`
- `conversation_concierge_clicked`

Safe params: episode slug, season, episode number, video provider, progress milestone, destination type/path.

Also preserve the existing `consultation_cta_clicked` event via `ConsultationCtaLink`.

---

## Key files

| Area | Path |
|---|---|
| Episode data | `lib/conversations/episodes.ts` |
| Analytics | `lib/conversations/analytics.ts` |
| Player | `app/conversations/components/HourglassVideoPlayer.tsx` |
| Hub | `app/conversations/page.tsx` |
| Episode page | `app/conversations/[slug]/page.tsx` |
| Metadata | `lib/seo/conversations-metadata.ts` |
| Schema | `lib/seo/schema/conversations.ts` |
| Docs | `docs/conversations-system.md` |
