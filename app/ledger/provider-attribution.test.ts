import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const ledgerRoot = join(process.cwd(), "app", "ledger");
const shell = readFileSync(join(ledgerRoot, "components", "ledger-shell.tsx"), "utf8");
const terms = readFileSync(join(process.cwd(), "app", "terms", "page.tsx"), "utf8");

describe("Ledger provider attribution", () => {
  it("shows the required BEA and FRED non-endorsement notices on every Ledger route", () => {
    assert.match(
      shell,
      /This product uses the Bureau of Economic Analysis \(BEA\) Data API but is not[\s\S]*endorsed or certified by BEA\./,
    );
    assert.match(
      shell,
      /This product uses the FRED® API but is not[\s\S]*endorsed or certified by the Federal Reserve Bank of St\. Louis\./,
    );
  });

  it("identifies EIA and links all provider terms without implying endorsement", () => {
    assert.match(shell, /U\.S\. Energy Information Administration/);
    assert.match(shell, /https:\/\/apps\.bea\.gov\/API\/_pdf\/bea_api_tos\.pdf/);
    assert.match(shell, /https:\/\/www\.eia\.gov\/opendata\/terms-of-service\.php/);
    assert.match(shell, /https:\/\/fred\.stlouisfed\.org\/docs\/api\/terms_of_use\.html/);
    assert.match(shell, /no provider endorses Hourglass Diamonds or the Ledger/);
  });

  it("places the FRED user agreement and third-party rights notice in site terms", () => {
    assert.match(terms, /By using the Ledger, you agree to be bound by/);
    assert.match(terms, /FRED® API Terms of Use/);
    assert.match(terms, /rights and restrictions[\s\S]*originating providers/);
  });
});
