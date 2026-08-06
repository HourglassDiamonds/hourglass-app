import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSessionMetaRevisionId,
  isSessionMetaRevisionId,
  selectNewestSessionMetaRevisionName,
  sessionMetaObjectPath,
  sessionMetaRevisionObjectPath,
  sessionMetaRevisionPrefix,
} from "./session-capture-delete";

const SESSION = "a1b2c3d4-e5f6-4789-a012-3456789abcde";

describe("shape-studio session meta paths", () => {
  it("keeps the legacy flat meta path for cleanup listing", () => {
    assert.equal(sessionMetaObjectPath(SESSION), `sessions/${SESSION}.json`);
  });

  it("builds unique revision keys under the session folder", () => {
    assert.equal(sessionMetaRevisionPrefix(SESSION), `sessions/${SESSION}`);
    const id = buildSessionMetaRevisionId(1_786_029_416_134, 42);
    assert.equal(
      sessionMetaRevisionObjectPath(SESSION, id),
      `sessions/${SESSION}/${id}.json`,
    );
  });
});

describe("shape-studio session meta revision ordering", () => {
  it("zero-pads revision ids so lexicographic order matches time order", () => {
    const older = buildSessionMetaRevisionId(1_000, 999_999);
    const newer = buildSessionMetaRevisionId(1_001, 0);
    assert.ok(newer > older);
    assert.equal(
      selectNewestSessionMetaRevisionName([`${older}.json`, `${newer}.json`]),
      `${newer}.json`,
    );
  });

  it("does not let a same-ms lower tie-break beat a higher one", () => {
    const a = buildSessionMetaRevisionId(5_000, 9);
    const b = buildSessionMetaRevisionId(5_000, 100_000);
    assert.equal(
      selectNewestSessionMetaRevisionName([`${a}.json`, `${b}.json`]),
      `${b}.json`,
    );
  });

  it("never selects an older revision over a newer one from mixed lists", () => {
    const names = [
      `${buildSessionMetaRevisionId(10, 1)}.json`,
      `${buildSessionMetaRevisionId(50, 2)}.json`,
      `${buildSessionMetaRevisionId(20, 999_999)}.json`,
    ];
    assert.equal(
      selectNewestSessionMetaRevisionName(names),
      `${buildSessionMetaRevisionId(50, 2)}.json`,
    );
  });

  it("accepts legacy unpadded revision ids for read compatibility", () => {
    assert.equal(isSessionMetaRevisionId("1786029416134-42"), true);
    assert.equal(
      selectNewestSessionMetaRevisionName([
        "1786029416134-42.json",
        `${buildSessionMetaRevisionId(1_786_029_416_200, 1)}.json`,
      ]),
      `${buildSessionMetaRevisionId(1_786_029_416_200, 1)}.json`,
    );
  });
});
