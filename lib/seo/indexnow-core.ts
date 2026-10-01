import { SITE_URL } from "./site-metadata";
import { isPrivateOrInternalPath } from "./public-indexing";

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const INDEXNOW_MAX_URLS_PER_SUBMISSION = 100;

const INDEXNOW_KEY_PATTERN = /^[A-Za-z0-9-]{8,128}$/;
const PUBLIC_ORIGIN = new URL(SITE_URL).origin;

export type IndexNowPayload = {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
};

export function isValidIndexNowKey(value: string): boolean {
  return INDEXNOW_KEY_PATTERN.test(value);
}

export function indexNowKeyLocation(key: string): string {
  if (!isValidIndexNowKey(key)) {
    throw new Error("INDEXNOW_KEY must be 8-128 letters, numbers, or hyphens.");
  }

  return `${PUBLIC_ORIGIN}/indexnow-key.txt`;
}

export function normalizeIndexNowUrls(urls: readonly string[]): string[] {
  if (urls.length > INDEXNOW_MAX_URLS_PER_SUBMISSION) {
    throw new Error(
      `IndexNow submissions are limited to ${INDEXNOW_MAX_URLS_PER_SUBMISSION} explicit URLs per run.`,
    );
  }

  const normalized = new Set<string>();

  for (const input of urls) {
    const value = input.trim();
    if (!value) continue;

    const url = value.startsWith("/")
      ? new URL(value, PUBLIC_ORIGIN)
      : new URL(value);

    if (url.origin !== PUBLIC_ORIGIN) {
      throw new Error(`IndexNow URL must belong to ${PUBLIC_ORIGIN}.`);
    }
    if (url.protocol !== "https:") {
      throw new Error("IndexNow URLs must use HTTPS.");
    }
    if (url.username || url.password || url.search || url.hash) {
      throw new Error(
        "IndexNow URLs must be bare canonical URLs without credentials, query state, or fragments.",
      );
    }
    if (isPrivateOrInternalPath(url.pathname)) {
      throw new Error(`IndexNow cannot submit private or internal URL: ${url.pathname}`);
    }

    normalized.add(url.toString());
  }

  return [...normalized];
}

export function buildIndexNowPayload(
  key: string,
  urls: readonly string[],
): IndexNowPayload {
  const urlList = normalizeIndexNowUrls(urls);
  return {
    host: new URL(PUBLIC_ORIGIN).host,
    key,
    keyLocation: indexNowKeyLocation(key),
    urlList,
  };
}
