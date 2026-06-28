import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { createMinimalBmpBuffer } from "./test-bmp-fixture";
import {
  detectBmpFromBytes,
  normalizeDiamondIntelligenceUpload,
  resolveUploadIngestMetadata,
  swapFilenameExtensionToPng,
} from "./upload-normalize";
import {
  detectUploadKindFromBytes,
  validateDiamondIntelligenceUpload,
} from "./upload-validation";

async function createTestBmpBuffer(): Promise<Buffer> {
  return createMinimalBmpBuffer(32, 32);
}

describe("detectBmpFromBytes", () => {
  it("detects BMP magic bytes", () => {
    const header = Buffer.alloc(4);
    header.write("BM", 0, "ascii");
    assert.equal(detectBmpFromBytes(header), true);
    assert.equal(detectBmpFromBytes(Buffer.from("%PDF", "ascii")), false);
  });
});

describe("swapFilenameExtensionToPng", () => {
  it("replaces .bmp with .png", () => {
    assert.equal(
      swapFilenameExtensionToPng("3436a87e-7086-4e81-b77d-45ad7f9f97f1.bmp"),
      "3436a87e-7086-4e81-b77d-45ad7f9f97f1.png",
    );
  });
});

describe("normalizeDiamondIntelligenceUpload", () => {
  it("converts BMP to PNG but rejects it on public PDF-only validation", async () => {
    const bmp = await createTestBmpBuffer();
    assert.equal(detectBmpFromBytes(bmp), true);

    const normalized = await normalizeDiamondIntelligenceUpload({
      bytes: bmp,
      declaredMime: "image/bmp",
      sourceFilename: "screenshot.bmp",
    });

    assert.equal(normalized.ok, true);
    if (!normalized.ok) return;

    assert.equal(normalized.mime, "image/png");
    assert.equal(normalized.sourceFilename, "screenshot.png");
    assert.equal(normalized.ingestMetadata.ingestKind, "bmp-converted");
    assert.equal(detectUploadKindFromBytes(normalized.bytes), "png");

    const validated = validateDiamondIntelligenceUpload({
      bytes: normalized.bytes,
      declaredMime: normalized.mime,
      sourceFilename: normalized.sourceFilename,
    });
    assert.equal(validated.ok, false);
    if (!validated.ok) {
      assert.equal(validated.code, "unsupported_extension");
    }
  });

  it("passes PDF bytes through unchanged", async () => {
    const pdf = Buffer.from("%PDF-1.4\n", "ascii");
    const normalized = await normalizeDiamondIntelligenceUpload({
      bytes: pdf,
      declaredMime: "application/pdf",
      sourceFilename: "report.pdf",
    });

    assert.equal(normalized.ok, true);
    if (!normalized.ok) return;
    assert.equal(normalized.bytes.toString("ascii"), "%PDF-1.4\n");
    assert.equal(normalized.mime, "application/pdf");
  });

  it("passes PNG bytes through unchanged", async () => {
    const png = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .png()
      .toBuffer();

    const normalized = await normalizeDiamondIntelligenceUpload({
      bytes: png,
      declaredMime: "image/png",
      sourceFilename: "report.png",
    });

    assert.equal(normalized.ok, true);
    if (!normalized.ok) return;
    assert.equal(normalized.bytes.equals(png), true);
    assert.equal(normalized.ingestMetadata.ingestKind, "screenshot");
  });

  it("passes JPEG bytes through unchanged", async () => {
    const jpeg = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .jpeg()
      .toBuffer();

    const normalized = await normalizeDiamondIntelligenceUpload({
      bytes: jpeg,
      declaredMime: "image/jpeg",
      sourceFilename: "report.jpg",
    });

    assert.equal(normalized.ok, true);
    if (!normalized.ok) return;
    assert.equal(normalized.bytes.equals(jpeg), true);
  });

  it("rejects corrupt BMP payloads", async () => {
    const corrupt = Buffer.alloc(54);
    corrupt.write("BM", 0, "ascii");

    const normalized = await normalizeDiamondIntelligenceUpload({
      bytes: corrupt,
      declaredMime: "image/bmp",
      sourceFilename: "broken.bmp",
    });

    assert.equal(normalized.ok, false);
    if (normalized.ok) return;
    assert.equal(normalized.code, "unknown_binary");
  });
});

describe("resolveUploadIngestMetadata", () => {
  it("preserves bmp-converted metadata after validation", () => {
    const meta = resolveUploadIngestMetadata({
      mime: "image/png",
      preNormalize: {
        ingestKind: "bmp-converted",
        convertedFrom: "bmp",
        normalizedMime: "image/png",
        originalFilename: "screenshot.bmp",
        originalMime: "image/bmp",
      },
    });

    assert.equal(meta.ingestKind, "bmp-converted");
    assert.equal(meta.convertedFrom, "bmp");
  });

  it("maps validated PDF mime to pdf ingestKind", () => {
    const meta = resolveUploadIngestMetadata({
      mime: "application/pdf",
      preNormalize: { ingestKind: "pdf", normalizedMime: "application/pdf" },
    });
    assert.equal(meta.ingestKind, "pdf");
  });

  it("maps validated image mime to screenshot ingestKind", () => {
    const meta = resolveUploadIngestMetadata({
      mime: "image/jpeg",
      preNormalize: { ingestKind: "screenshot", normalizedMime: "image/jpeg" },
    });
    assert.equal(meta.ingestKind, "screenshot");
  });
});
