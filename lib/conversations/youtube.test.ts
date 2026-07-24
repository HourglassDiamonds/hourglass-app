/**
 * YouTube URL helpers for Conversations — unit tests.
 * Fixture IDs below are synthetic 11-char tokens for format tests only.
 * They must never be copied into production episode records.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildYouTubeEmbedUrl,
  buildYouTubeIframeTitle,
  buildYouTubeWatchUrl,
  isValidYouTubeVideoId,
  normalizeYouTubeVideoId,
} from "./youtube";

/** Synthetic fixture — not a real Hourglass upload. */
const FIXTURE_YOUTUBE_ID = "AbCdefGh_12";

describe("YouTube conversation helpers", () => {
  it("accepts only standard 11-character video IDs", () => {
    assert.equal(isValidYouTubeVideoId(FIXTURE_YOUTUBE_ID), true);
    assert.equal(isValidYouTubeVideoId(" short "), false);
    assert.equal(isValidYouTubeVideoId("toolongvideoid"), false);
    assert.equal(isValidYouTubeVideoId(""), false);
    assert.equal(isValidYouTubeVideoId(undefined), false);
    assert.equal(normalizeYouTubeVideoId(` ${FIXTURE_YOUTUBE_ID} `), FIXTURE_YOUTUBE_ID);
  });

  it("builds the approved privacy-enhanced embed URL without autoplay by default", () => {
    const url = buildYouTubeEmbedUrl(FIXTURE_YOUTUBE_ID);
    assert.equal(
      url.startsWith(
        `https://www.youtube-nocookie.com/embed/${FIXTURE_YOUTUBE_ID}?`,
      ),
      true,
    );
    assert.equal(url.includes("autoplay="), false);
    assert.equal(url.includes("rel=0"), true);
    assert.equal(url.includes("playsinline=1"), true);
    assert.equal(url.includes("modestbranding=1"), true);
  });

  it("adds autoplay only when explicitly requested after user gesture", () => {
    const url = buildYouTubeEmbedUrl(FIXTURE_YOUTUBE_ID, { autoplay: true });
    assert.equal(url.includes("autoplay=1"), true);
  });

  it("builds watch URLs and accessible iframe titles", () => {
    assert.equal(
      buildYouTubeWatchUrl(FIXTURE_YOUTUBE_ID),
      `https://www.youtube.com/watch?v=${FIXTURE_YOUTUBE_ID}`,
    );
    assert.equal(
      buildYouTubeIframeTitle("Why We’re Here"),
      "Why We’re Here — Hourglass Conversations",
    );
  });

  it("refuses to build URLs from invalid IDs", () => {
    assert.throws(() => buildYouTubeEmbedUrl("bad"), /Invalid YouTube video ID/);
    assert.throws(() => buildYouTubeWatchUrl(""), /Invalid YouTube video ID/);
  });
});
