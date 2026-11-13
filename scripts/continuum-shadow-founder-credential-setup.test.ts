import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("shadow founder credential helper", () => {
  const source = readFileSync(
    "scripts/continuum-shadow-founder-credential-setup.ps1",
    "utf8",
  );
  const hashSource = readFileSync(
    "scripts/hash-executive-dashboard-password.mjs",
    "utf8",
  );
  const transportSource = readFileSync(
    "scripts/continuum-shadow-founder-credential-transport.ps1",
    "utf8",
  );

  it("uses hidden password input, the existing scrypt implementation, and stdin-only Vercel writes", () => {
    assert.match(source, /Read-Host[^\n]+-AsSecureString/);
    assert.match(source, /node --no-warnings \$hashScript/);
    assert.match(source, /continuum-shadow-founder-credential-transport\.ps1/);
    assert.match(transportSource, /--input - --raw/);
    assert.match(transportSource, /ConvertTo-Json -Depth 5 -Compress/);
    assert.doesNotMatch(transportSource, /@\(\s*\[ordered\]@\{/);
    assert.doesNotMatch(source, /--value/);
    assert.doesNotMatch(transportSource, /--value/);
    assert.doesNotMatch(source, /Write-Output[^\n]*(password|hash|username)\s*\+/i);
    assert.match(
      hashSource,
      /import \{ hashExecutiveDashboardPassword \} from/,
    );
  });

  it("creates unique Production-only variables and arms exact cleanup before prompting", () => {
    assert.match(
      source,
      /CONTINUUM_PRODUCTION_SHADOW_FOUNDER_USERNAME/,
    );
    assert.match(
      source,
      /CONTINUUM_PRODUCTION_SHADOW_FOUNDER_PASSWORD_HASH/,
    );
    assert.match(transportSource, /target = @\('production'\)/);
    assert.match(source, /Start-Process[\s\S]+Read-Host/);
    assert.match(source, /createdAt[^\n]+startedAtMs/);
    assert.match(source, /env\/\$\(\$entry\.id\)/);
    assert.match(source, /cleanup\.complete/);
    assert.match(source, /Write-Manifest \$created[\s\S]+Write-Manifest \$created/);
    assert.match(source, /catch \{[\s\S]+env\/\$\(\$entry\.id\)/);
    assert.doesNotMatch(source, /--force/);
  });
});
