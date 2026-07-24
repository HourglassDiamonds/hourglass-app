# Conversations episode publishing

Operator guide for publishing long-form Hourglass Diamonds Conversations on the website.

The website episode page is the primary brand destination. The same finished film may also publish to YouTube. Do not invent video IDs, upload dates, durations, transcripts, thumbnails, or performance metrics.

System architecture reference: `docs/conversations-system.md`

---

## 1. Where episode data lives

`lib/conversations/episodes.ts` — typed TypeScript registry (`CONVERSATION_EPISODES`).

Routes are already reusable:

| Route | Purpose |
|---|---|
| `/conversations` | Hub |
| `/conversations/[slug]` | Episode template |

Adding an episode means adding a registry object — not a new route file.

---

## 2. Required fields (before `status: "published"`)

| Field | Notes |
|---|---|
| `slug` | kebab-case, unique |
| `status` | `"published"` only when complete |
| `title` | Editorial title |
| `summary` / `seoDescription` | Public description |
| `publishedAt` | ISO date string (`YYYY-MM-DD`) |
| `durationLabel` | Human label (e.g. `About 8 min`) |
| `durationIso` | ISO-8601 duration (e.g. `PT8M`) |
| `poster` | 16:9 still under `public/media/conversations/` |
| `video` | Playable `mux`, `file`, or `youtube` source |
| `transcript` | Final spoken text — no draft markers |

Publish gate: `episodeIsPubliclyEligible()` in `lib/conversations/episodes.ts`.

Incomplete published records stay out of the hub, sitemap, and public routes.

---

## 3. Optional fields

- `eyebrow`, `centralIdea`, `keyIdeas`
- `season`, `episodeNumber`, `topicLabel`
- `thumbnail`, `openGraphImage`
- `captions` / `video.captions` (WebVTT)
- `relatedArticle`, `relatedTool`
- `seoTitle`

---

## 4. YouTube URL / video ID format

Preferred website provider for the YouTube Conversations series:

```ts
video: {
  provider: "youtube",
  youtubeVideoId: "XXXXXXXXXXX", // exactly 11 characters [A-Za-z0-9_-]
}
```

Approved embed base (built by `buildYouTubeEmbedUrl`):

`https://www.youtube-nocookie.com/embed/{id}?rel=0&modestbranding=1&playsinline=1`

- No autoplay on initial page load (click-to-activate poster first).
- After user click, the player may request `autoplay=1` inside the iframe.
- Watch URL used in schema: `https://www.youtube.com/watch?v={id}`

Also supported:

```ts
video: { provider: "mux", playbackId: "..." }
video: { provider: "file", src: "https://cdn.example/master.mp4" }
```

**Never invent a YouTube ID.** If the ID is missing, leave `video` unset and keep `status: "draft"`.

---

## 5. Thumbnail / poster requirements

| Asset | Recommendation |
|---|---|
| Aspect | 16:9 |
| Poster | 1920×1080 JPEG or WebP, quiet editorial still |
| Naming | `{slug}-poster.jpg` under `public/media/conversations/` |
| Avoid | Giant play badge burned into the image; SVG is draft-only |

Current first-episode poster is an SVG placeholder for layout review only. Replace before public publish.

---

## 6. Title and description conventions

- Title: calm, specific, no hard sell (`Why We’re Here`).
- Summary: one or two sentences of editorial framing.
- SEO description: long-form, human, no keyword stuffing.
- Avoid urgency language and fabricated performance claims.

---

## 7. Transcript / excerpt handling

- Store chaptered paragraphs in `transcript`.
- Replace any copy containing: `draft transcript`, `for typography and rhythm review only`, `temporary transcript`, `placeholder body for layout qa`.
- Captions: English WebVTT under `public/media/conversations/captions/`.

---

## 8. Metadata requirements

Handled by `lib/seo/conversations-metadata.ts`:

- Title tag, meta description, canonical `/conversations/{slug}`
- Open Graph title/description/image
- Twitter `summary_large_image`
- Drafts remain `noindex`
- Hub stays `noindex` until at least one publicly eligible episode exists

---

## 9. VideoObject requirements

Built by `lib/seo/schema/conversations.ts`.

Emitted on the episode page **only** when `episodeIsPubliclyEligible()` is true.

When playable:

- Mux → `contentUrl` + `embedUrl` (Mux stream/player)
- YouTube → watch `contentUrl` + nocookie `embedUrl` (no autoplay in schema)
- File → `contentUrl` only

When video is missing, do not invent URLs. Draft/incomplete pages omit JsonLd entirely.

---

## 10. Concierge attribution rules

Episode footer CTA must use:

```
/concierge?tool=conversations&content={slug}
```

Example for the first episode:

```
/concierge?tool=conversations&content=why-we-re-here
```

- `tool` identifies Conversations
- `content` identifies the episode slug
- No email, phone, or other PII in the URL
- Helper: `buildConversationConciergeHref(slug)`

---

## 11. Testing commands

```bash
npm run test:conversations
npx eslint lib/conversations app/conversations lib/seo/conversations-metadata.ts lib/seo/schema/conversations.ts lib/seo/schema/conversations.test.ts
npm run build
```

---

## 12. Preview workflow

1. Keep `status: "draft"` while reviewing.
2. Run `npm run dev` and open `/conversations` and `/conversations/why-we-re-here`.
3. Production builds continue to 404 drafts (intentional).
4. Confirm poster, copy, Concierge link, and missing-video note as needed.

---

## 13. Deploy checklist

- [ ] Real YouTube video ID **or** Mux playback ID inserted (not invented)
- [ ] Final transcript (no draft markers)
- [ ] Photo poster + optional captions
- [ ] `status: "published"`
- [ ] `npm run test:conversations` passes
- [ ] `npm run build` passes
- [ ] Desktop + mobile hub and episode QA
- [ ] Concierge link shows `tool=conversations&content={slug}`
- [ ] Sitemap includes hub + episode after deploy
- [ ] Optional: YouTube distribution packaging + social UTMs landing on the Hourglass episode URL

---

## 14. Common failure states

| Symptom | Likely cause |
|---|---|
| Hub/episode 404 in production | Draft status, missing video, or draft transcript |
| No sitemap entry | Not publicly eligible |
| Player shows poster only | `video` unset or invalid YouTube ID |
| Schema missing embed URLs | No playable source (correct behavior) |
| Publish rejected in tests | Draft transcript markers still present |

---

## 15. Exact steps to add the next episode

1. Export the finished conversation (website-clean + optional YouTube distribution copy).
2. Publish to YouTube (or upload website master to Mux).
3. Copy the **real** 11-character YouTube video ID (or Mux playback ID).
4. Add a 16:9 poster to `public/media/conversations/`.
5. Optionally add `public/media/conversations/captions/{slug}.en.vtt`.
6. Append a new object to `CONVERSATION_EPISODES` in `lib/conversations/episodes.ts`.
7. Fill required editorial + SEO fields.
8. Set `video: { provider: "youtube", youtubeVideoId: "..." }`.
9. Paste the final transcript sections.
10. Wire `relatedArticle` / `relatedTool` when relevant.
11. Set `status: "published"`.
12. Run `npm run test:conversations` and `npm run build`.
13. Preview locally, then merge/deploy through the normal review path.

### First episode — operator input still required

`why-we-re-here` is prepared as a draft with copy, SEO, related links, and Concierge attribution wiring.

Still required before public publish:

1. Production YouTube video ID (or Mux playback ID)
2. Final transcript (replace draft markers)
3. Photo poster (replace SVG placeholder)
4. Optional English WebVTT captions
5. Flip `status` to `"published"`
