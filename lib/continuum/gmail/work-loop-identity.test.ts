import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canonicalWorkLoopId,
  clientLabelFromIdentityHay,
  currentCadTokensFromIdentityHay,
  parseHgdClientLabel,
  parseShopCadFilename,
} from "./work-loop-identity";

describe("work-loop identity parsers", () => {
  it("parses spaced and parenthetical HGD subjects without treating vendor names as clients", () => {
    const spaced = parseHgdClientLabel("RE: HGD x Dylon D.-C025610");
    assert.equal(spaced?.cadId, "C025610");
    assert.match(spaced?.name ?? "", /Dylon/i);

    const parenthetical = parseHgdClientLabel("RE: HGD x Nate P. (Dagger Ring)-C026176");
    assert.equal(parenthetical?.cadId, "C026176");
    assert.match(parenthetical?.name ?? "", /Nate/i);
    assert.doesNotMatch(parenthetical?.name ?? "", /Dagger Ring/i);

    const compact = parseHgdClientLabel("RE: HGD x Abbey-C026137");
    assert.equal(compact?.cadId, "C026137");
    assert.equal(compact?.name, "Abbey");

    const vendorNamed = parseHgdClientLabel("RE: HGD x Vlora-C026137");
    assert.equal(vendorNamed?.cadId, "C026137");
    assert.equal(vendorNamed?.name, "C026137");
  });

  it("parses current shop CAD filenames and ignores unrelated image names", () => {
    const shop = parseShopCadFilename("NL-H017-Abbey-C026137.jpg");
    assert.equal(shop?.cadId, "C026137");
    assert.equal(shop?.name, "Abbey");
    assert.equal(parseShopCadFilename("image001.jpg"), null);
    assert.equal(parseShopCadFilename("featured-ring-paint.png"), null);
  });

  it("collects current CAD tokens only from HGD subjects and shop filenames", () => {
    const tokens = currentCadTokensFromIdentityHay([
      "RE: HGD x Sarah-C026143",
      "NL-H017-Abbey-C026137.jpg",
      "quoted historical C021479 from an old job",
    ]);
    assert.deepEqual(tokens, ["C026143", "C026137"]);
  });

  it("prefers HGD client labels over shop filenames when both are present", () => {
    const label = clientLabelFromIdentityHay([
      "Re: A new piece",
      "NL-H017-Abbey-C026137.jpg",
      "RE: HGD x Abbey-C026137",
    ]);
    assert.equal(label?.cadId, "C026137");
    assert.equal(label?.name, "Abbey");
  });

  it("canonical workLoopId prefers project, then CAD, then thread", () => {
    assert.equal(
      canonicalWorkLoopId({
        projectId: "project-1",
        cadId: "C026137",
        threadId: "thread-1",
        fallbackId: "seed-1",
      }),
      "project:project-1",
    );
    assert.equal(
      canonicalWorkLoopId({
        projectId: null,
        cadId: "C026137",
        threadId: "thread-1",
        fallbackId: "seed-1",
      }),
      "cad:C026137",
    );
    assert.equal(
      canonicalWorkLoopId({
        projectId: null,
        cadId: null,
        threadId: "thread-1",
        fallbackId: "seed-1",
      }),
      "thread:thread-1",
    );
  });
});
