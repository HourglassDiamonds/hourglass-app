/**
 * P0-4 — WCAG 2.2 AA accessibility remediation regression tests.
 *
 * Guards the specific fixes shipped in the P0-4 pass (skip navigation,
 * mobile-nav semantics, contrast tokens, Diamond Studio selection semantics,
 * DI error announcements, Shape Studio QR equivalent + hidden input, guide
 * byline distinction, homepage link purpose, Whispered Praise reduced
 * motion). Source-string assertions by repo convention — no DOM snapshots.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = dirname(fileURLToPath(import.meta.url));

const layout = readFileSync(join(root, "layout.tsx"), "utf8");
const header = readFileSync(join(root, "shared-components/Header.tsx"), "utf8");
const globals = readFileSync(join(root, "globals.css"), "utf8");
const studioPage = readFileSync(join(root, "diamond-studio/page.tsx"), "utf8");
const uploadDock = readFileSync(
  join(root, "diamond-intelligence/components/ReportUploadDock.tsx"),
  "utf8",
);
const qrPanel = readFileSync(
  join(root, "diamond-shape-studio/components/qr-capture-panel.tsx"),
  "utf8",
);
const dssStyles = readFileSync(
  join(root, "diamond-shape-studio/components/shape-studio-styles.tsx"),
  "utf8",
);
const handPanel = readFileSync(
  join(root, "diamond-shape-studio/components/hand-photo-panel.tsx"),
  "utf8",
);
const byline = readFileSync(
  join(root, "diamond-guide/components/ArticleAuthorByline.tsx"),
  "utf8",
);
const homePage = readFileSync(join(root, "home-page-client.tsx"), "utf8");
const whispered = readFileSync(join(root, "whispered-praise/page.tsx"), "utf8");

/* ── WCAG contrast math ─────────────────────────────────────────────── */

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  return (
    0.2126 * channel(parseInt(h.slice(0, 2), 16)) +
    0.7152 * channel(parseInt(h.slice(2, 4), 16)) +
    0.0722 * channel(parseInt(h.slice(4, 6), 16))
  );
}

function contrast(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function token(name: string): string {
  const m = globals.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `token ${name} not found as a hex literal in globals.css`);
  return m[1];
}

/* ── AA-1: skip navigation / landmark structure ─────────────────────── */

describe("AA-1 skip navigation & landmark structure (WCAG 2.4.1, 1.3.1)", () => {
  it("layout renders exactly one <main>", () => {
    assert.equal((layout.match(/<main\b/g) ?? []).length, 1);
  });

  it("layout no longer carries the skip link (it lives in the Header)", () => {
    assert.ok(!layout.includes('href="#main-content"'));
  });

  it("Header renders the skip link before the <header> element", () => {
    const skipIdx = header.indexOf('href="#hg-page-content"');
    const headerIdx = header.indexOf("<header");
    assert.ok(skipIdx > -1, "skip link missing");
    assert.ok(headerIdx > -1);
    assert.ok(skipIdx < headerIdx, "skip link must precede the header");
    assert.ok(header.includes("Skip to main content"));
  });

  it("skip-link target is a focusable anchor rendered after the header", () => {
    const target = header.indexOf('id="hg-page-content"');
    const headerClose = header.indexOf("</header>");
    assert.ok(target > -1, "skip target missing");
    assert.ok(target > headerClose, "target must come after the header");
    assert.match(header, /id="hg-page-content" tabIndex=\{-1\}/);
  });

  it("globals suppress the focus ring on skip-link targets only", () => {
    assert.match(globals, /#hg-page-content:focus/);
  });
});

/* ── AA-2: mobile navigation semantics ──────────────────────────────── */

describe("AA-2 mobile navigation semantics (WCAG 4.1.2)", () => {
  it("no ARIA menu/menuitem misuse anywhere in the Header", () => {
    assert.ok(!header.includes('role="menu"'));
    assert.ok(!header.includes('role="menuitem"'));
  });

  it("mobile nav is a labelled <nav> with a list of links", () => {
    assert.match(
      header,
      /<nav\s+id="hg-mobile-nav"\s+aria-label="Mobile navigation"/,
    );
    const navStart = header.indexOf('id="hg-mobile-nav"');
    const nav = header.slice(navStart, header.indexOf("</nav>", navStart));
    assert.ok(nav.includes("<ul"), "mobile nav should use a list");
    assert.ok(nav.includes("<li"), "mobile nav should use list items");
  });

  it("toggle keeps its disclosure wiring", () => {
    assert.match(header, /aria-expanded=\{mobileMenuOpen\}/);
    assert.match(header, /aria-controls="hg-mobile-nav"/);
  });

  it("Escape closes the menu and returns focus to the toggle", () => {
    assert.match(header, /ref=\{menuButtonRef\}/);
    const esc = header.slice(
      header.indexOf('event.key === "Escape"'),
      header.indexOf("window.addEventListener"),
    );
    assert.ok(esc.includes("setMobileMenuOpen(false)"));
    assert.ok(esc.includes("menuButtonRef.current?.focus()"));
  });
});

/* ── AA-3: contrast tokens ──────────────────────────────────────────── */

describe("AA-3 contrast tokens (WCAG 1.4.3)", () => {
  const ivory = token("--hg-ivory");
  const body = token("--hg-body");
  const surface = token("--hg-surface");

  it("muted ink holds >=4.5:1 on every light brand surface", () => {
    const muted = token("--hg-muted");
    for (const bg of [ivory, body, surface]) {
      assert.ok(
        contrast(muted, bg) >= 4.5,
        `--hg-muted ${muted} on ${bg} = ${contrast(muted, bg).toFixed(2)}`,
      );
    }
  });

  it("eyebrow ink holds >=4.5:1 on every light brand surface", () => {
    const eyebrow = token("--hg-eyebrow");
    for (const bg of [ivory, body, surface]) {
      assert.ok(
        contrast(eyebrow, bg) >= 4.5,
        `--hg-eyebrow ${eyebrow} on ${bg} = ${contrast(eyebrow, bg).toFixed(2)}`,
      );
    }
  });

  it("standardized muted literals hold >=4.5:1 on their darkest audited surface", () => {
    // #6d655e (sitewide muted family) appears down to #ede6dc (engagement
    // rings panel); #756a5f (DI fine print) only appears on DI surfaces
    // (#f8f3ea and lighter).
    assert.ok(
      contrast("#6d655e", "#ede6dc") >= 4.5,
      `#6d655e on #ede6dc = ${contrast("#6d655e", "#ede6dc").toFixed(2)}`,
    );
    assert.ok(
      contrast("#756a5f", "#f8f3ea") >= 4.5,
      `#756a5f on #f8f3ea = ${contrast("#756a5f", "#f8f3ea").toFixed(2)}`,
    );
  });

  it("protected passing values are unchanged", () => {
    assert.equal(token("--hg-ink"), "#1c1b1a");
    assert.equal(token("--hg-gold-deep"), "#987648"); // focus ring source
    assert.match(globals, /--hg-focus:\s*var\(--hg-gold-deep\)/);
    // Focus indicator >=3:1 on both ivory and charcoal (WCAG 1.4.11).
    assert.ok(contrast("#987648", ivory) >= 3);
    assert.ok(contrast("#987648", token("--hg-charcoal")) >= 3);
  });

  it("luxury-reveal no longer dims text while waiting for the observer", () => {
    const reveal = globals.slice(
      globals.indexOf(".luxury-reveal {"),
      globals.indexOf(".luxury-reveal--visible"),
    );
    assert.match(reveal, /opacity:\s*1;/);
    const stagger = globals.slice(
      globals.indexOf(".luxury-reveal--stagger > * {"),
      globals.indexOf(".luxury-reveal--stagger > :nth-child(2)"),
    );
    assert.match(stagger, /opacity:\s*1;/);
  });
});

/* ── AA-4: Diamond Studio selection semantics ───────────────────────── */

describe("AA-4 Diamond Studio selection semantics (WCAG 4.1.2)", () => {
  it("shape strip is a radiogroup, not a tablist", () => {
    assert.ok(!studioPage.includes('role="tablist"'));
    assert.match(studioPage, /role="radiogroup"\s+aria-label="Diamond shape"/);
  });

  it("shape chips expose radio state with a roving tabindex", () => {
    assert.match(studioPage, /role="radio"\s+aria-checked=\{s === shape\}/);
    assert.match(studioPage, /tabIndex=\{s === shape \? 0 : -1\}/);
  });

  it("orientation is a radiogroup of two mutually exclusive radios", () => {
    assert.match(
      studioPage,
      /role="radiogroup"\s+aria-label="Stone orientation"/,
    );
    assert.match(
      studioPage,
      /aria-checked=\{stoneOrientation === "ns"\}/,
    );
    assert.match(
      studioPage,
      /aria-checked=\{stoneOrientation === "ew"\}/,
    );
  });

  it("arrow-key model moves selection and focus within the group", () => {
    assert.match(studioPage, /function handleRadioGroupKeyDown/);
    for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) {
      assert.ok(studioPage.includes(`"${key}"`), `missing ${key}`);
    }
    assert.match(studioPage, /closest\('\[role="radiogroup"\]'\)/);
    assert.ok(
      (studioPage.match(/handleRadioGroupKeyDown\(/g) ?? []).length >= 3,
      "shape strip and both orientation buttons wire the handler",
    );
  });

  it("skin-tone and band-metal swatches keep accessible names without visible labels", () => {
    assert.match(studioPage, /aria-label="Skin tone"/);
    assert.match(studioPage, /aria-label="Band metal"/);
    assert.match(studioPage, /data-skin=\{id\}/);
    assert.match(studioPage, /data-metal=\{id\}/);
    assert.match(studioPage, /aria-label=\{label\}/);
    assert.doesNotMatch(studioPage, /className="dts-tone-swatch-label"/);
  });
});

/* ── AA-5: Diamond Intelligence error announcements ─────────────────── */

describe("AA-5 Diamond Intelligence error announcements (WCAG 4.1.3)", () => {
  it("both error blocks expose alert semantics", () => {
    assert.equal(
      (uploadDock.match(/role="alert"/g) ?? []).length,
      2,
      "pdf rejection block and server error block",
    );
    assert.match(uploadDock, /role="alert" className="mt-3 space-y-2"/);
  });

  it("routine progress/status copy is not an alert", () => {
    const statusBlock = uploadDock.slice(
      uploadDock.indexOf("statusNote && !showServerError"),
      uploadDock.indexOf("showPdfOnlyRejection ?"),
    );
    assert.ok(!statusBlock.includes('role="alert"'));
    const progress = uploadDock.slice(
      uploadDock.indexOf("const statusLine"),
      uploadDock.indexOf("statusNote &&"),
    );
    assert.ok(!progress.includes('role="alert"'));
  });
});

/* ── AA-6: Shape Studio QR equivalent ───────────────────────────────── */

describe("AA-6 Shape Studio QR text equivalent (WCAG 1.1.1)", () => {
  it("a real link carries the same capture-session URL as the QR code", () => {
    assert.match(qrPanel, /href=\{captureUrl\}/);
    assert.ok(qrPanel.includes("Open phone capture link"));
    // New tab so the desktop panel keeps polling the session.
    const link = qrPanel.slice(
      qrPanel.indexOf('className="dss-qr-link"'),
      qrPanel.indexOf("Open phone capture link"),
    );
    assert.ok(link.includes('target="_blank"'));
    assert.ok(link.includes('rel="noopener"'));
  });

  it("the link has visible styling (not sr-only)", () => {
    assert.match(dssStyles, /\.dss-qr-link\{/);
    assert.ok(!qrPanel.includes('className="dss-qr-link sr-only"'));
  });
});

/* ── AA-7: Shape Studio hidden file input ───────────────────────────── */

describe("AA-7 Shape Studio hidden file input (WCAG 2.4.7 / 2.1.1)", () => {
  it("the programmatic input is out of the keyboard order and hidden from AT", () => {
    const input = handPanel.slice(handPanel.indexOf("<input"));
    assert.ok(input.includes('aria-hidden="true"'));
    assert.ok(input.includes("tabIndex={-1}"));
    assert.ok(input.includes('className="sr-only"'));
  });

  it("the programmatic open hook remains for visible triggers", () => {
    assert.match(handPanel, /openDevicePicker: \(\) => \{/);
    assert.match(handPanel, /inputRef\.current\?\.click\(\)/);
  });

  it("direct-mobile-entry reference pattern still holds", () => {
    const dme = readFileSync(
      join(root, "diamond-shape-studio/components/direct-mobile-entry.tsx"),
      "utf8",
    );
    assert.ok(dme.includes('aria-hidden="true"'));
    assert.ok(dme.includes("tabIndex={-1}"));
  });
});

/* ── AA-8: guide byline distinction ─────────────────────────────────── */

describe("AA-8 guide byline link distinction (WCAG 1.4.1)", () => {
  it("byline link is underlined (non-color distinction)", () => {
    const link = byline.slice(byline.indexOf("<Link"), byline.indexOf("</Link>"));
    assert.ok(link.includes("underline"));
    assert.ok(link.includes("underline-offset"));
  });
});

/* ── AA-9: homepage link purpose ────────────────────────────────────── */

describe("AA-9 homepage repeated link purpose (WCAG 2.4.4)", () => {
  it("Explore in Motion links carry hidden per-card context", () => {
    assert.ok(
      homePage.includes('<span className="sr-only"> — {title}</span>'),
      "hidden card-title context missing from the repeated link",
    );
  });
});

/* ── Advisory: Whispered Praise reduced motion ──────────────────────── */

describe("Whispered Praise reduced motion (advisory, WCAG 2.3.3 AAA)", () => {
  it("reduced-motion media query lands content in its final state", () => {
    const idx = whispered.indexOf("@media (prefers-reduced-motion: reduce)");
    assert.ok(idx > -1, "reduced-motion rule missing");
    const block = whispered.slice(idx, idx + 400);
    assert.ok(block.includes(".whispered-enter"));
    assert.ok(block.includes(".whispered-enter-delay"));
    assert.match(block, /animation:\s*none/);
    assert.match(block, /opacity:\s*1/);
  });
});
