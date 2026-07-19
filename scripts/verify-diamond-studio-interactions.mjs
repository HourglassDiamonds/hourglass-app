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

  // Slider keyboard accessibility (WCAG 2.1.1) — carat track
  const ctTrack = page.locator(".dts-slider--carat .dts-track");
  if (await ctTrack.count()) {
    await ctTrack.scrollIntoViewIfNeeded();
    assert(
      (await ctTrack.getAttribute("role")) === "slider",
      `${label}: carat track missing role=slider`,
    );
    const kbBefore = await readState(page);
    await ctTrack.focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(200);
    const kbAfter = await readState(page);
    assert(
      kbAfter.caratVal !== kbBefore.caratVal,
      `${label}: carat unchanged after ArrowRight (${kbBefore.caratVal})`,
    );
    const valuenow = await ctTrack.getAttribute("aria-valuenow");
    assert(
      Number(valuenow) === Number(kbAfter.caratVal),
      `${label}: carat aria-valuenow=${valuenow} != displayed ${kbAfter.caratVal}`,
    );
    await page.keyboard.press("Home");
    await page.waitForTimeout(200);
    const kbHome = await readState(page);
    assert(
      Number(kbHome.caratVal) === 1,
      `${label}: carat Home expected 1.00, got ${kbHome.caratVal}`,
    );
  }

  // Slider keyboard accessibility — ring size track
  const fsTrack = page.locator(".dts-slider--ring .dts-track");
  if (await fsTrack.count()) {
    await fsTrack.scrollIntoViewIfNeeded();
    const kbBefore = await readState(page);
    await fsTrack.focus();
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(200);
    const kbAfter = await readState(page);
    assert(
      kbAfter.ringVal !== kbBefore.ringVal,
      `${label}: ring size unchanged after ArrowLeft (${kbBefore.ringVal})`,
    );
  }

  // Slider keyboard accessibility — band width track
  const bwTrackKb = page.locator(".dts-slider--band .dts-track");
  if (await bwTrackKb.count()) {
    await bwTrackKb.scrollIntoViewIfNeeded();
    const kbBefore = await readState(page);
    await bwTrackKb.focus();
    await page.keyboard.press("End");
    await page.waitForTimeout(200);
    const kbAfter = await readState(page);
    assert(
      kbAfter.bandVal !== kbBefore.bandVal && kbAfter.bandVal?.includes("5mm"),
      `${label}: band width End expected 5mm, got ${kbAfter.bandVal}`,
    );
  }

  // Top nav hrefs + navigation
  for (const [navLabel, expectedPath] of [
    ["See It On Your Hand", "/diamond-shape-studio"],
    ["Analyze Sparkle", "/diamond-intelligence"],
  ]) {
    await page.goto(`${BASE}/diamond-studio`, { waitUntil: "networkidle" });
    await page.waitForSelector("img.dts-cad-base");
    const link = page.locator("a.dts-topnav-hit", { hasText: navLabel });
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
