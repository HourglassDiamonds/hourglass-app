/**
 * Playwright interaction checks for Diamond Studio V2.
 * Requires dev server: npm run dev -- -p 3005
 *
 * Asserts real state changes — not elementFromPoint alone.
 */
import { chromium } from "playwright";

const BASE = process.env.DIAMOND_STUDIO_URL ?? "http://localhost:3005";

const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900, sideBySide: true },
  { name: "desktop-1280", width: 1280, height: 900, sideBySide: true },
  { name: "desktop-1024", width: 1024, height: 900, sideBySide: true },
  { name: "split-900", width: 900, height: 900, viewerMinHeight: 400 },
  { name: "ipad-820", width: 820, height: 1180, viewerMinHeight: 400 },
  { name: "mobile-390", width: 390, height: 844 },
];

const STAGE_LAYER_SELECTORS = [
  ".dts-stage-canvas",
  ".dts-viewer",
  ".dts-layer-finger",
  ".dts-layer-diamond",
  ".dts-diamond-stack",
  ".dts-diamond-cad-frame",
  ".dts-cad-base",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readState(page) {
  return page.evaluate(() => {
    const selectedTone =
      document.querySelector("button.dts-tone-swatch.is-selected")?.textContent?.trim() ??
      null;
    const bandVal =
      document.querySelector(".dts-card--band-width .dts-card-subhead-val")?.textContent?.trim() ??
      null;
    const ringVal =
      document.querySelector(".dts-card--finger .dts-step-val")?.textContent?.trim() ?? null;
    const caratVal =
      document.querySelector(".dts-card--carat .dts-step-val")?.textContent?.trim() ?? null;
    const fingerImg =
      document.querySelector(".dts-layer-finger img")?.getAttribute("src") ?? null;
    const cadBase = document.querySelector("img.dts-cad-base")?.getAttribute("src") ?? null;
    const rail = document.querySelector(".dts-control-rail");
    const viewer = document.querySelector(".dts-viewer");
    return {
      selectedTone,
      bandVal,
      ringVal,
      caratVal,
      fingerImg,
      cadBase,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      railClientHeight: rail?.clientHeight ?? 0,
      railScrollHeight: rail?.scrollHeight ?? 0,
      viewerClientHeight: viewer?.clientHeight ?? 0,
    };
  });
}

async function testViewport(browser, vp) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const label = `${vp.name} (${vp.width}×${vp.height})`;

  await page.goto(`${BASE}/diamond-studio`, { waitUntil: "networkidle" });
  await page.waitForSelector("img.dts-cad-base", { timeout: 30000 });

  const initial = await readState(page);
  assert(initial.cadBase?.includes("diamonds-v2"), `${label}: expected V2 cad base, got ${initial.cadBase}`);
  assert(
    initial.innerWidth === vp.width && initial.innerHeight === vp.height,
    `${label}: viewport mismatch ${initial.innerWidth}×${initial.innerHeight}`,
  );

  if (vp.viewerMinHeight) {
    assert(
      initial.viewerClientHeight >= vp.viewerMinHeight,
      `${label}: viewer clientHeight=${initial.viewerClientHeight}, expected >= ${vp.viewerMinHeight}`,
    );
  }

  if (vp.sideBySide) {
    for (const sel of STAGE_LAYER_SELECTORS) {
      const count = await page.locator(sel).count();
      if (count === 0) continue;
      const pe = await page.$eval(sel, (el) => getComputedStyle(el).pointerEvents);
      assert(pe === "none", `${label}: ${sel} pointer-events=${pe}, expected none`);
    }
  }

  // Skin tone — pick a tone different from current
  const toneOrder = ["Light", "Medium", "Dark"];
  const targetTone =
    initial.selectedTone === "Light"
      ? "Medium"
      : initial.selectedTone === "Medium"
        ? "Dark"
        : "Light";
  const toneBtn = page.locator("button.dts-tone-swatch", { hasText: targetTone });
  await toneBtn.scrollIntoViewIfNeeded();
  const fingerBefore = initial.fingerImg;
  await toneBtn.click();
  await page.waitForTimeout(250);
  const afterTone = await readState(page);
  assert(
    afterTone.selectedTone === targetTone,
    `${label}: skin tone expected ${targetTone}, got ${afterTone.selectedTone}`,
  );
  assert(
    (await toneBtn.getAttribute("aria-checked")) === "true",
    `${label}: ${targetTone} aria-checked not true`,
  );
  assert(
    afterTone.fingerImg !== fingerBefore,
    `${label}: finger src unchanged after tone (${fingerBefore} → ${afterTone.fingerImg})`,
  );
  assert(
    afterTone.fingerImg?.includes(`finger-${targetTone.toLowerCase()}`),
    `${label}: finger src ${afterTone.fingerImg} missing tone ${targetTone}`,
  );

  // Band width
  const bwTrack = page.locator(".dts-slider--band .dts-track");
  await bwTrack.scrollIntoViewIfNeeded();
  const bandBefore = afterTone.bandVal;
  const bwBox = await bwTrack.boundingBox();
  assert(bwBox, `${label}: band track missing bounding box`);
  await page.mouse.click(bwBox.x + bwBox.width * 0.05, bwBox.y + bwBox.height / 2);
  await page.waitForTimeout(250);
  const afterBand = await readState(page);
  assert(
    afterBand.bandVal !== bandBefore,
    `${label}: band width unchanged (${bandBefore})`,
  );
  assert(
    afterBand.bandVal?.includes("2mm"),
    `${label}: expected 2mm band, got ${afterBand.bandVal}`,
  );

  // Ring size
  const ringPlus = page.locator('.dts-card--finger button[aria-label="Larger ring size"]');
  await ringPlus.scrollIntoViewIfNeeded();
  const ringBefore = afterBand.ringVal;
  await ringPlus.click();
  await page.waitForTimeout(200);
  const afterRing = await readState(page);
  assert(
    afterRing.ringVal !== ringBefore,
    `${label}: ring size unchanged (${ringBefore})`,
  );

  // Carat weight
  const caratPlus = page.locator('.dts-card--carat button[aria-label="Larger"]');
  if (await caratPlus.count()) {
    await caratPlus.scrollIntoViewIfNeeded();
    const caratBefore = afterRing.caratVal;
    await caratPlus.click();
    await page.waitForTimeout(200);
    const afterCarat = await readState(page);
    assert(
      afterCarat.caratVal !== caratBefore,
      `${label}: carat unchanged (${caratBefore})`,
    );
  }

  // Top nav hrefs + navigation
  for (const [navLabel, expectedPath] of [
    ["Shape Comparison", "/diamond-shape-studio"],
    ["Light Performance", "/diamond-intelligence"],
  ]) {
    await page.goto(`${BASE}/diamond-studio`, { waitUntil: "networkidle" });
    await page.waitForSelector("img.dts-cad-base");
    const link = page.locator("a.dts-topnav-label", { hasText: navLabel });
    assert(
      (await link.getAttribute("href")) === expectedPath,
      `${label}: ${navLabel} href mismatch`,
    );
    await Promise.all([
      page.waitForURL((url) => url.pathname === expectedPath, { timeout: 10000 }),
      link.click(),
    ]);
    assert(
      new URL(page.url()).pathname === expectedPath,
      `${label}: ${navLabel} navigation failed`,
    );
  }

  await page.close();
  console.log(`  ok ${label}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  console.log("verify-diamond-studio-interactions");
  for (const vp of VIEWPORTS) {
    await testViewport(browser, vp);
  }
  await browser.close();
  console.log("verify-diamond-studio-interactions: all viewports passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
