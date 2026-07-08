/**
 * Generate normalized CAD assets + scintillation variants for Diamond Studio.
 *
 *   node scripts/generate-diamond-cad-assets.mjs
 *   node scripts/generate-diamond-cad-assets.mjs --shape=oval
 *   node scripts/generate-diamond-cad-assets.mjs --skip-round
 *
 * Round Brilliant assets (rbc-cad-*) are preserved by default; pass
 * --regenerate-round to rebuild them from rbc-cad.png using this pipeline.
 */
import fs from "fs";
import path from "path";
import {
  OUT_DIR,
  ROOT,
  SHAPE_SOURCES,
  enhanceFacetDefinition,
  generateSwitcher,
  loadPng,
  probeVisibleBounds,
  publicDiamondPath,
  writePng,
} from "./lib/diamond-cad-common.mjs";
import { generateScintillationVariants } from "./lib/diamond-cad-scintillation.mjs";

const args = process.argv.slice(2);
const shapeArg = args.find((a) => a.startsWith("--shape="));
const onlyShape = shapeArg ? shapeArg.split("=")[1] : null;
const regenerateRound = args.includes("--regenerate-round");
const skipExisting = args.includes("--skip-existing");

function assertDecodes(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} missing: ${filePath}`);
  }
  const png = loadPng(filePath);
  if (!png.width || !png.height) {
    throw new Error(`${label} failed to decode: ${filePath}`);
  }
  return png;
}

function boundsWithinTol(a, b, tol = 1) {
  return (
    Math.abs(a.minX - b.minX) <= tol &&
    Math.abs(a.minY - b.minY) <= tol &&
    Math.abs(a.maxX - b.maxX) <= tol &&
    Math.abs(a.maxY - b.maxY) <= tol
  );
}

async function processShape(cfg) {
  const shapeId = cfg.shapeId;
  console.log(`\n=== ${shapeId} (${cfg.profile}) ===`);

  const originalPath = path.join(OUT_DIR, cfg.originalFile);
  const popPath = path.join(OUT_DIR, cfg.popFile);
  const switcherPath = path.join(OUT_DIR, cfg.switcherFile);
  const legacyPath = path.join(OUT_DIR, cfg.legacyFile);
  const manifestPath = path.join(
    OUT_DIR,
    `${cfg.variantPrefix}-variants.json`,
  );

  const shouldGenerate =
    cfg.regenerate || (shapeId === "round" && regenerateRound);

  let sourceMeasurements = null;
  let originalPng;

  if (shouldGenerate) {
    if (!cfg.sourceFile) {
      originalPng = assertDecodes(originalPath, `${shapeId} original`);
    } else {
      const sourcePath = path.join(OUT_DIR, cfg.sourceFile);
      const sourcePng = assertDecodes(sourcePath, `${shapeId} vendor source`);
      sourceMeasurements = probeVisibleBounds(sourcePng);
      // Copy vendor source to stable canonical original name (binary-identical).
      fs.copyFileSync(sourcePath, originalPath);
      originalPng = assertDecodes(originalPath, `${shapeId} original`);
      console.log(
        `Copied source → ${cfg.originalFile} (${originalPng.width}x${originalPng.height})`,
      );
    }

    if (skipExisting && fs.existsSync(popPath)) {
      console.log(`Skip pop (exists): ${cfg.popFile}`);
    } else {
      const enhanced = enhanceFacetDefinition(originalPng);
      writePng(popPath, enhanced);
      console.log(`Wrote ${cfg.popFile}`);
    }
  } else {
    originalPng = assertDecodes(originalPath, `${shapeId} original`);
    assertDecodes(popPath, `${shapeId} pop`);
    console.log(`Preserving existing Round assets (${cfg.popFile})`);
  }

  const popPng = assertDecodes(popPath, `${shapeId} pop`);
  const popBounds = probeVisibleBounds(popPng);
  const originalBounds = probeVisibleBounds(originalPng);
  if (!boundsWithinTol(popBounds, originalBounds, 1)) {
    console.warn(
      `Warning: pop alpha bounds differ from original by >1px for ${shapeId}`,
    );
  }

  const legacyPng = assertDecodes(legacyPath, `${shapeId} legacy`);
  const legacyBounds = probeVisibleBounds(legacyPng);
  const visibleScale =
    legacyBounds.visibleFillRatio / popBounds.visibleFillRatio;

  if (shouldGenerate || regenerateRound) {
    if (skipExisting && fs.existsSync(switcherPath)) {
      console.log(`Skip switcher (exists): ${cfg.switcherFile}`);
    } else {
      const sw = await generateSwitcher(popPath, switcherPath);
      console.log(
        `Wrote ${cfg.switcherFile} (trim ${sw.trimmedWidth}x${sw.trimmedHeight}, pad ${sw.pad})`,
      );
    }

    if (skipExisting && fs.existsSync(manifestPath)) {
      console.log(`Skip scintillation (exists): ${path.basename(manifestPath)}`);
    } else {
      const scintManifest = generateScintillationVariants({
        shapeId,
        profile: cfg.profile,
        sourcePath: popPath,
        outDir: OUT_DIR,
        variantPrefix: cfg.variantPrefix,
      });
      fs.writeFileSync(manifestPath, JSON.stringify(scintManifest, null, 2));
      console.log(`Wrote ${path.basename(manifestPath)}`);
      for (const key of ["a", "b", "c", "d"]) {
        const p = scintManifest.patterns[key];
        console.log(
          `  ${key}: changed=${p.coverage.changedOpaquePercent}% totalCov=${p.coverage.totalPercent}%`,
        );
      }
    }
  } else {
    assertDecodes(switcherPath, `${shapeId} switcher`);
    for (const key of ["a", "b", "c", "d"]) {
      assertDecodes(
        path.join(OUT_DIR, `${cfg.variantPrefix}-${key}.png`),
        `${shapeId} variant ${key}`,
      );
    }
  }

  const switcherPng = assertDecodes(switcherPath, `${shapeId} switcher`);
  const switcherBounds = probeVisibleBounds(switcherPng);

  return {
    shapeId,
    profile: cfg.profile,
    shadow: cfg.shadow,
    sourceFile: cfg.sourceFile,
    assets: {
      src: publicDiamondPath(cfg.popFile),
      originalSrc: publicDiamondPath(cfg.originalFile),
      switcherSrc: publicDiamondPath(cfg.switcherFile),
      fallbackSrc: publicDiamondPath(cfg.legacyFile),
      variants: ["a", "b", "c", "d"].map((k) =>
        publicDiamondPath(`${cfg.variantPrefix}-${k}.png`),
      ),
      manifest: publicDiamondPath(`${cfg.variantPrefix}-variants.json`),
    },
    canvas: {
      width: popPng.width,
      height: popPng.height,
    },
    visibleBounds: {
      minX: popBounds.minX,
      minY: popBounds.minY,
      maxX: popBounds.maxX,
      maxY: popBounds.maxY,
      width: popBounds.boundsW,
      height: popBounds.boundsH,
    },
    centerX: popBounds.centerX,
    centerY: popBounds.centerY,
    visibleFillRatio: popBounds.visibleFillRatio,
    visibleFillRatioH: popBounds.visibleFillRatioH,
    legacyVisibleFillRatio: legacyBounds.visibleFillRatio,
    visibleScale,
    sourceMeasurements,
    switcher: {
      width: switcherPng.width,
      height: switcherPng.height,
      visibleBounds: {
        minX: switcherBounds.minX,
        minY: switcherBounds.minY,
        maxX: switcherBounds.maxX,
        maxY: switcherBounds.maxY,
        width: switcherBounds.boundsW,
        height: switcherBounds.boundsH,
      },
    },
  };
}

async function main() {
  const shapeIds = onlyShape
    ? [onlyShape]
    : Object.keys(SHAPE_SOURCES);

  for (const id of shapeIds) {
    if (!SHAPE_SOURCES[id]) {
      throw new Error(`Unknown shape: ${id}`);
    }
  }

  const shapes = {};
  for (const id of shapeIds) {
    shapes[id] = await processShape(SHAPE_SOURCES[id]);
  }

  // When generating a subset, merge into existing studio manifest if present.
  const studioManifestPath = path.join(OUT_DIR, "diamond-cad-manifest.json");
  let studioManifest = {
    generatedAt: new Date().toISOString(),
    alphaThreshold: 10,
    shapes: {},
  };
  if (fs.existsSync(studioManifestPath) && onlyShape) {
    studioManifest = JSON.parse(fs.readFileSync(studioManifestPath, "utf8"));
    studioManifest.generatedAt = new Date().toISOString();
  }

  for (const [id, entry] of Object.entries(shapes)) {
    studioManifest.shapes[id] = entry;
  }

  // If we only processed fancy shapes, still ensure Round entry exists from files.
  if (!studioManifest.shapes.round && fs.existsSync(path.join(OUT_DIR, "rbc-cad-pop.png"))) {
    studioManifest.shapes.round = await processShape(SHAPE_SOURCES.round);
  }

  fs.writeFileSync(studioManifestPath, JSON.stringify(studioManifest, null, 2));
  console.log(`\nStudio manifest: ${path.relative(ROOT, studioManifestPath)}`);

  // Emit typed constants snippet for diamond-cad-assets.ts (measurements).
  const measurementsPath = path.join(OUT_DIR, "diamond-cad-measurements.json");
  const measurements = {};
  for (const [id, entry] of Object.entries(studioManifest.shapes)) {
    measurements[id] = {
      visibleFillRatio: entry.visibleFillRatio,
      visibleFillRatioH: entry.visibleFillRatioH,
      centerX: entry.centerX,
      centerY: entry.centerY,
      visibleScale: entry.visibleScale,
      visibleBounds: entry.visibleBounds,
      canvas: entry.canvas,
      profile: entry.profile,
      shadow: entry.shadow,
    };
  }
  fs.writeFileSync(measurementsPath, JSON.stringify(measurements, null, 2));
  console.log(`Measurements: ${path.relative(ROOT, measurementsPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
