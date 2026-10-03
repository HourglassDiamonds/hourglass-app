import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("Continuum navigation and Today disclosure", () => {
  it("maps tracked project and client origins to contextual labels", () => {
    const destinations = read("lib/continuum/operating-shell/destinations.ts");
    assert.match(destinations, /export function contextualBackLabel/);
    assert.match(destinations, /current\.startsWith\(`\$\{previous\}\/`\).*"Project"/);
    assert.match(destinations, /current\.startsWith\(`\$\{previous\}\/`\).*"Client"/);
    assert.match(destinations, /destinationBackForPath\(previous\)\.label/);
    assert.match(destinations, /isConciergeInteriorPath\(previousPath\)/);
  });

  it("keeps a real fallback href while using browser history when safely tracked", () => {
    const back = read("app/executive-dashboard/concierge/components/concierge-back-link.tsx");
    const tracker = read("app/executive-dashboard/concierge/components/concierge-navigation-history.tsx");
    assert.match(back, /href=\{target\}/);
    assert.match(back, /window\.history\.back\(\)/);
    assert.match(back, /window\.history\.length <= 1/);
    assert.match(back, /data-concierge-history-back="true"/);
    assert.match(tracker, /CONCIERGE_PREVIOUS_PATH_KEY/);
    assert.match(tracker, /JSON\.stringify/);
    assert.match(back, /navigation\.to/);
    assert.match(tracker, /destination\.origin !== window\.location\.origin/);
  });

  it("keeps one Today action visible and discloses secondary controls", () => {
    const actions = read("app/executive-dashboard/concierge/components/cos-docket-actions.tsx");
    assert.match(actions, /const primaryAction =/);
    assert.match(actions, /data-cos-more-actions/);
    assert.match(actions, />\s*More\s*</);
    assert.match(actions, /min-h-11/);
  });

  it("surfaces understandable held states on Today with pending feedback", () => {
    const today = read("app/executive-dashboard/concierge/page.tsx");
    const panel = read("app/executive-dashboard/concierge/components/conditional-hold-panel.tsx");
    const controls = read("app/executive-dashboard/concierge/components/conditional-hold-controls.tsx");
    const loading = read("app/executive-dashboard/concierge/loading.tsx");

    assert.match(today, /ConditionalHoldPanel/);
    assert.match(today, /Suspense/);
    assert.match(panel, /Condition met/);
    assert.match(panel, /Waiting for/);
    assert.doesNotMatch(panel, /Waiting for:/);
    assert.match(controls, /Resuming…/);
    assert.match(controls, /Dismissing…/);
    assert.match(controls, /min-h-11/);
    assert.match(loading, /aria-busy="true"/);
  });
});
