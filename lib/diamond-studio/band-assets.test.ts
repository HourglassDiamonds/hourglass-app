import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  BAND_ASSETS,
  BAND_ASSET_PUBLIC_DIR,
  BAND_METALS,
  BAND_WIDTHS,
  CANONICAL_BAND_ASSET_NAME,
  DEFAULT_BAND_METAL,
  DEFAULT_BAND_WIDTH,
  SKIN_TONES,
  adjacentBandWidths,
  bandAssetFileName,
  expectedBandAssetCount,
  getBandAssetSrc,
} from "./band-assets";

const DIR = path.join(
  process.cwd(),
  "public",
  "diamond-tech-suite",
  "finger",
  "band-widths",
);

describe("band asset registry", () => {
  it("exposes three skins, seven widths, and three metals", () => {
    assert.deepEqual([...SKIN_TONES], ["light", "medium", "dark"]);
    assert.deepEqual([...BAND_WIDTHS], [2, 2.5, 3, 3.5, 4, 4.5, 5]);
    assert.deepEqual([...BAND_METALS], ["yellow-gold", "white-gold", "rose-gold"]);
    assert.equal(DEFAULT_BAND_METAL, "yellow-gold");
    assert.equal(DEFAULT_BAND_WIDTH, 2);
  });

  it("covers every skin × width × metal combination once", () => {
    const expected = expectedBandAssetCount();
    assert.equal(expected, SKIN_TONES.length * BAND_WIDTHS.length * BAND_METALS.length);

    const paths: string[] = [];
    for (const skin of SKIN_TONES) {
      for (const width of BAND_WIDTHS) {
        for (const metal of BAND_METALS) {
          paths.push(getBandAssetSrc(skin, width, metal));
        }
      }
    }
    assert.equal(paths.length, expected);
    assert.equal(new Set(paths).size, expected);
  });

  it("uses canonical filenames and unique public paths", () => {
    const names = new Set<string>();
    for (const skin of SKIN_TONES) {
      for (const width of BAND_WIDTHS) {
        for (const metal of BAND_METALS) {
          const fileName = bandAssetFileName(skin, metal, width);
          assert.match(fileName, CANONICAL_BAND_ASSET_NAME);
          assert.equal(
            BAND_ASSETS[skin][width][metal],
            `${BAND_ASSET_PUBLIC_DIR}/${fileName}`,
          );
          assert.equal(names.has(fileName), false, `duplicate ${fileName}`);
          names.add(fileName);
        }
      }
    }
    assert.equal(names.size, expectedBandAssetCount());
  });

  it("has every registry path on disk and no extra canonical band PNGs", () => {
    const disk = fs
      .readdirSync(DIR)
      .filter((f) => f.toLowerCase().endsWith(".png"));
    const canonicalOnDisk = disk.filter((f) => CANONICAL_BAND_ASSET_NAME.test(f));
    assert.equal(canonicalOnDisk.length, expectedBandAssetCount());
    assert.deepEqual(
      disk.filter((f) => !CANONICAL_BAND_ASSET_NAME.test(f)),
      [],
    );

    for (const skin of SKIN_TONES) {
      for (const width of BAND_WIDTHS) {
        for (const metal of BAND_METALS) {
          const fileName = bandAssetFileName(skin, metal, width);
          assert.ok(
            fs.existsSync(path.join(DIR, fileName)),
            `missing ${fileName}`,
          );
        }
      }
    }
  });

  it("lists adjacent widths without wrapping", () => {
    assert.deepEqual(adjacentBandWidths(2), [2.5]);
    assert.deepEqual(adjacentBandWidths(2.5), [2, 3]);
    assert.deepEqual(adjacentBandWidths(5), [4.5]);
  });
});
