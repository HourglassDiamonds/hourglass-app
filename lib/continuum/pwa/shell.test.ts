import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  CONTINUUM_APPLE_TOUCH_ICON,
  CONTINUUM_APP_NAME,
  CONTINUUM_APP_SHORT_NAME,
  CONTINUUM_BACKGROUND_COLOR,
  CONTINUUM_DESCRIPTION,
  CONTINUUM_DISPLAY,
  CONTINUUM_ICON_192,
  CONTINUUM_ICON_512,
  CONTINUUM_ICON_MASKABLE_512,
  CONTINUUM_MANIFEST_PATH,
  CONTINUUM_SCOPE,
  CONTINUUM_START_URL,
  CONTINUUM_THEME_COLOR,
  continuumManifest,
} from "./config";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function walk(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, found);
    else found.push(path);
  }
  return found;
}

describe("Continuum private PWA shell", () => {
  const manifestPath = join(ROOT, "public", "continuum", "manifest.webmanifest");
  const manifestJson = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<
    string,
    unknown
  >;
  const expected = continuumManifest();

  it("publishes a valid standalone Continuum manifest", () => {
    assert.equal(manifestJson.name, CONTINUUM_APP_NAME);
    assert.equal(manifestJson.short_name, CONTINUUM_APP_SHORT_NAME);
    assert.equal(manifestJson.description, CONTINUUM_DESCRIPTION);
    assert.equal(manifestJson.start_url, CONTINUUM_START_URL);
    assert.equal(manifestJson.scope, CONTINUUM_SCOPE);
    assert.equal(manifestJson.display, CONTINUUM_DISPLAY);
    assert.equal(manifestJson.background_color, CONTINUUM_BACKGROUND_COLOR);
    assert.equal(manifestJson.theme_color, CONTINUUM_THEME_COLOR);
    assert.equal(CONTINUUM_START_URL, "/executive-dashboard/concierge");
    assert.equal(CONTINUUM_SCOPE, "/executive-dashboard/");
    assert.equal(CONTINUUM_DISPLAY, "standalone");
    assert.deepEqual(manifestJson, expected);
  });

  it("keeps manifest metadata generic with no Client Memory PII", () => {
    const raw = readFileSync(manifestPath, "utf8");
    assert.doesNotMatch(raw, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    assert.doesNotMatch(
      raw,
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    assert.doesNotMatch(raw, /note_text|displayName|phone|email/i);
    assert.doesNotMatch(raw, /Hourglass Diamonds geometric|sand dissolving/i);
  });

  it("ships replaceable icon files at the required sizes", () => {
    const files = [
      ["public/continuum/icon-192.png", 8_000],
      ["public/continuum/icon-512.png", 20_000],
      ["public/continuum/icon-maskable-512.png", 16_000],
      ["public/continuum/apple-touch-icon.png", 8_000],
    ] as const;
    for (const [rel, minBytes] of files) {
      const path = join(ROOT, rel);
      assert.equal(existsSync(path), true, rel);
      assert.ok(statSync(path).size >= minBytes, rel);
    }
    assert.equal(CONTINUUM_ICON_192, "/continuum/icon-192.png");
    assert.equal(CONTINUUM_ICON_512, "/continuum/icon-512.png");
    assert.equal(CONTINUUM_ICON_MASKABLE_512, "/continuum/icon-maskable-512.png");
    assert.equal(CONTINUUM_APPLE_TOUCH_ICON, "/continuum/apple-touch-icon.png");
  });

  it("attaches PWA metadata only on the private executive-dashboard layout", () => {
    const layout = read(join("app", "executive-dashboard", "layout.tsx"));
    const rootLayout = read(join("app", "layout.tsx"));
    assert.match(layout, /manifest:\s*CONTINUUM_MANIFEST_PATH/);
    assert.match(layout, /appleWebApp/);
    assert.match(layout, /black-translucent/);
    assert.match(layout, /viewportFit:\s*"cover"/);
    assert.match(layout, /data-continuum-app/);
    assert.match(layout, /force-dynamic/);
    assert.match(layout, /index:\s*false/);
    assert.doesNotMatch(rootLayout, /CONTINUUM_MANIFEST_PATH/);
    assert.doesNotMatch(rootLayout, /appleWebApp/);
    assert.equal(CONTINUUM_MANIFEST_PATH, "/continuum/manifest.webmanifest");
  });

  it("does not introduce a service worker or protected-data cache", () => {
    const privateTree = walk(join(ROOT, "app", "executive-dashboard"));
    const pwaLib = walk(join(ROOT, "lib", "continuum", "pwa"));
    for (const file of [...privateTree, ...pwaLib]) {
      if (file.endsWith(".test.ts")) continue;
      if (!/\.(ts|tsx|js|mjs|css|webmanifest)$/.test(file)) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /navigator\.serviceWorker|workbox|precacheManifest/i);
      assert.doesNotMatch(source, /caches\.open|cache\.addAll/);
    }
    assert.equal(existsSync(join(ROOT, "public", "sw.js")), false);
    assert.equal(existsSync(join(ROOT, "public", "service-worker.js")), false);
  });

  it("hides the marketing footer from the private app shell without changing public Footer.tsx", () => {
    const appCss = read(join("app", "executive-dashboard", "continuum-app.css"));
    const footer = read(join("app", "shared-components", "Footer.tsx"));
    const login = read(join("app", "executive-dashboard", "login", "page.tsx"));
    const addNote = read(
      join(
        "app",
        "executive-dashboard",
        "concierge",
        "client",
        "[personId]",
        "note",
        "new",
        "page.tsx",
      ),
    );
    assert.match(appCss, /body:has\(\[data-continuum-app\]\) footer/);
    assert.match(footer, /Hourglass Diamonds/);
    assert.match(footer, /Whispered Praise/);
    assert.doesNotMatch(login, /Footer/);
    assert.doesNotMatch(addNote, /Footer/);
  });

  it("keeps founder session, Add Note auth, and public /concierge unchanged", () => {
    const conciergeLayout = read(
      join("app", "executive-dashboard", "concierge", "layout.tsx"),
    );
    const addNote = read(
      join(
        "app",
        "executive-dashboard",
        "concierge",
        "client",
        "[personId]",
        "note",
        "new",
        "page.tsx",
      ),
    );
    const actions = read(join("app", "executive-dashboard", "concierge", "actions.ts"));
    const publicConcierge = read(join("app", "concierge", "page.tsx"));
    const session = read(join("lib", "executive-dashboard", "session.ts"));
    assert.match(conciergeLayout, /requireInternalClientMemorySession/);
    assert.match(addNote, /getAuthenticatedClientMemoryReader/);
    assert.match(actions, /getAuthenticatedClientMemoryNoteWriter/);
    assert.match(publicConcierge, /path: "\/concierge"/);
    assert.match(publicConcierge, /Begin with a simple concierge conversation/);
    assert.match(session, /EXECUTIVE_DASHBOARD_SESSION_MAX_AGE_SEC = 60 \* 60 \* 12/);
    assert.match(session, /httpOnly: true/);
    assert.match(session, /sameSite: "lax"/);
    assert.match(session, /EXECUTIVE_DASHBOARD_SESSION_PATH/);
  });

  it("does not place a site-wide Continuum PWA on public marketing pages", () => {
    const publicConcierge = read(join("app", "concierge", "page.tsx"));
    const rootLayout = read(join("app", "layout.tsx"));
    assert.doesNotMatch(publicConcierge, /manifest.webmanifest/);
    assert.doesNotMatch(rootLayout, /\/continuum\/manifest/);
    assert.match(rootLayout, /<Footer/);
  });
});
