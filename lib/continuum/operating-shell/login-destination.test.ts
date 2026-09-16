import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  CONCIERGE_ASK_PATH,
  CONCIERGE_HOME_PATH,
  CONCIERGE_HUB_PATH,
  CONCIERGE_PROJECTS_PATH,
} from "./destinations";
import {
  assignFounderLoginDestination,
  CONTINUUM_DESKTOP_MEDIA_QUERY,
  founderDefaultLoginDestination,
  founderLoginPathWithNext,
  resolveFounderLoginDestination,
  safeFounderLoginDestination,
} from "./login-destination";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("Founder login destination", () => {
  it("uses the existing md breakpoint, not user-agent strings", () => {
    assert.equal(CONTINUUM_DESKTOP_MEDIA_QUERY, "(min-width: 768px)");
    assert.equal(founderDefaultLoginDestination("mobile"), CONCIERGE_HUB_PATH);
    assert.equal(founderDefaultLoginDestination("desktop"), CONCIERGE_HOME_PATH);
    assert.equal(
      resolveFounderLoginDestination({ viewport: "mobile" }),
      CONCIERGE_HUB_PATH,
    );
    assert.equal(
      resolveFounderLoginDestination({ viewport: "desktop" }),
      CONCIERGE_HOME_PATH,
    );
    assert.equal(resolveFounderLoginDestination({}), CONCIERGE_HUB_PATH);
  });

  it("returns a requested Continuum deep link instead of Home or Today", () => {
    const project = `${CONCIERGE_PROJECTS_PATH}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;
    assert.equal(safeFounderLoginDestination(project), project);
    assert.equal(
      resolveFounderLoginDestination({
        next: `${project}?view=past`,
        viewport: "mobile",
      }),
      `${project}?view=past`,
    );
    assert.equal(
      resolveFounderLoginDestination({
        next: CONCIERGE_HOME_PATH,
        viewport: "mobile",
      }),
      CONCIERGE_HOME_PATH,
    );
    assert.equal(
      resolveFounderLoginDestination({
        next: `${CONCIERGE_ASK_PATH}?q=${encodeURIComponent("Who has a birthday in November?")}`,
        viewport: "desktop",
      }),
      `${CONCIERGE_ASK_PATH}?q=Who has a birthday in November?`,
    );
  });

  it("rejects open redirects and non-Continuum destinations", () => {
    assert.equal(safeFounderLoginDestination("https://evil.example"), null);
    assert.equal(safeFounderLoginDestination("//evil.example"), null);
    assert.equal(safeFounderLoginDestination("/\\evil.example"), null);
    assert.equal(safeFounderLoginDestination("/executive-dashboard"), null);
    assert.equal(safeFounderLoginDestination("/executive-dashboard/login"), null);
    assert.equal(
      safeFounderLoginDestination("/executive-dashboard/security/passkeys/pair"),
      null,
    );
    assert.equal(
      safeFounderLoginDestination("/executive-dashboard/concierge/projects/../login"),
      null,
    );
    assert.equal(safeFounderLoginDestination("/concierge"), null);
    assert.equal(
      founderLoginPathWithNext(CONCIERGE_HUB_PATH),
      `/executive-dashboard/login?next=${encodeURIComponent(CONCIERGE_HUB_PATH)}`,
    );
    const dest = {
      pathname: "/executive-dashboard/login",
      search: "?next=x",
      hash: "#h",
    };
    assignFounderLoginDestination(
      dest,
      `${CONCIERGE_ASK_PATH}?q=${encodeURIComponent("Who has a birthday in November?")}`,
    );
    assert.equal(dest.pathname, CONCIERGE_ASK_PATH);
    assert.equal(
      dest.search,
      `?q=${encodeURIComponent("Who has a birthday in November?")}`,
    );
    assert.equal(dest.hash, "");
  });

  it("wires viewport and next through login, proxy, and layouts", () => {
    const form = readFileSync(
      join(ROOT, "app/executive-dashboard/login-form.tsx"),
      "utf8",
    );
    const passkey = readFileSync(
      join(ROOT, "app/executive-dashboard/passkey-login-button.tsx"),
      "utf8",
    );
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/actions.ts"),
      "utf8",
    );
    const passkeyActions = readFileSync(
      join(ROOT, "app/executive-dashboard/passkey-actions.ts"),
      "utf8",
    );
    const loginPage = readFileSync(
      join(ROOT, "app/executive-dashboard/login/page.tsx"),
      "utf8",
    );
    const landing = readFileSync(
      join(ROOT, "app/executive-dashboard/founder-session-landing.tsx"),
      "utf8",
    );
    const proxy = readFileSync(join(ROOT, "proxy.ts"), "utf8");
    const conciergeLayout = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/layout.tsx"),
      "utf8",
    );
    const securityLayout = readFileSync(
      join(ROOT, "app/executive-dashboard/security/layout.tsx"),
      "utf8",
    );
    assert.match(form, /CONTINUUM_DESKTOP_MEDIA_QUERY/);
    assert.match(form, /matchMedia/);
    assert.match(form, /name="viewport"/);
    assert.match(form, /name="next"/);
    assert.doesNotMatch(form, /userAgent|navigator\.userAgent/i);
    assert.match(passkey, /matchMedia/);
    assert.doesNotMatch(passkey, /userAgent|navigator\.userAgent/i);
    assert.match(actions, /resolveFounderLoginDestination/);
    assert.match(actions, /formData\.get\("next"\)/);
    assert.match(actions, /formData\.get\("viewport"\)/);
    assert.doesNotMatch(
      actions,
      /searchParams|URLSearchParams|\?password|\?secret/,
    );
    assert.match(passkeyActions, /resolveFounderLoginDestination/);
    assert.match(loginPage, /FounderSessionLanding/);
    assert.match(loginPage, /safeFounderLoginDestination/);
    assert.match(landing, /founderDefaultLoginDestination/);
    assert.match(landing, /matchMedia/);
    assert.match(proxy, /founderLoginPathWithNext/);
    assert.match(proxy, /safeFounderLoginDestination/);
    assert.doesNotMatch(proxy, /EXECUTIVE_DASHBOARD_CONCIERGE_PATH/);
    assert.match(conciergeLayout, /founderLoginPathWithNext/);
    assert.match(securityLayout, /founderLoginPathWithNext/);
  });

  it("does not import founder session or Google auth into client login modules", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "login-destination.ts"),
      "utf8",
    );
    assert.match(source, /executive-dashboard\/paths/);
    assert.doesNotMatch(source, /executive-dashboard\/access/);
    assert.doesNotMatch(
      source,
      /founder-sessions|google-oauth|google-auth-library/,
    );
  });
});
