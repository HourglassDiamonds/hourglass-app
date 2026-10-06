import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ConciergeIntakeDetail } from "../../../../app/executive-dashboard/concierge/components/concierge-intake-detail";
import type { ClientWebsiteIntake } from "./website-intake";
import {
  websiteIntakeFields,
  websiteIntakeSubmittedLabel,
  websiteIntakeWhatMatters,
} from "./website-intake-presentation";

const intake: ClientWebsiteIntake = {
  intakeId: "6c4d875a-77d0-4635-83d8-6249a0247559",
  jobId: "b42b9407-168a-41db-99ba-0374e3e1e9a1",
  status: "ready",
  identityStatus: "new",
  personId: "a1c31b9c-d4ea-4675-8ebf-0c756deeac38",
  fullName: "Justin Smith",
  email: "justin@example.test",
  phone: "19802599485",
  preferredContactMethod: "email",
  category: "engagement_ring",
  projectType: "Engagement Ring",
  shapeInterest: "Oval",
  designDirection: "Quiet Elegance",
  ringPresence: "Still Exploring",
  timeline: "0–2 months",
  budgetRange: "10–20k",
  inspirationNotes: "Founder smoke test.\nKeep the original wording.",
  attribution: {
    landing_path: "/diamond-studio",
    last_cta_location: "header:nav",
  },
  source: "hourglassdiamonds.com/concierge",
  submittedAt: "2026-10-05T14:10:11.233Z",
};

describe("Clients website intake presentation", () => {
  it("derives What matters only from the canonical intake", () => {
    assert.equal(
      websiteIntakeWhatMatters(intake),
      "Oval · Engagement Ring · Quiet Elegance · Still Exploring · 10–20k · 0–2 months",
    );
    assert.doesNotMatch(websiteIntakeWhatMatters(intake), /natural|lab|proposal/i);
  });

  it("preserves every submitted form field and arbitrary attribution context", () => {
    const fields = websiteIntakeFields(intake);
    const byKey = new Map(fields.map((field) => [field.key, field.value]));
    assert.equal(byKey.get("fullName"), "Justin Smith");
    assert.equal(byKey.get("email"), "justin@example.test");
    assert.equal(byKey.get("phone"), "19802599485");
    assert.equal(byKey.get("preferredContactMethod"), "email");
    assert.equal(byKey.get("category"), "engagement_ring");
    assert.equal(byKey.get("projectType"), "Engagement Ring");
    assert.equal(byKey.get("shapeInterest"), "Oval");
    assert.equal(byKey.get("designDirection"), "Quiet Elegance");
    assert.equal(byKey.get("ringPresence"), "Still Exploring");
    assert.equal(byKey.get("timeline"), "0–2 months");
    assert.equal(byKey.get("budgetRange"), "10–20k");
    assert.equal(
      byKey.get("inspirationNotes"),
      "Founder smoke test.\nKeep the original wording.",
    );
    assert.equal(byKey.get("attribution.landing_path"), "/diamond-studio");
    assert.equal(byKey.get("attribution.last_cta_location"), "header:nav");
    assert.equal(byKey.get("source"), "hourglassdiamonds.com/concierge");
  });

  it("renders a mobile-safe native accordion, exact evidence, and Eastern timestamp", () => {
    const html = renderToStaticMarkup(
      createElement(ConciergeIntakeDetail, { intake, defaultOpen: true }),
    );
    assert.match(html, /<details[^>]*open=""/);
    assert.match(html, /Concierge intake/);
    assert.match(html, /What matters/);
    assert.match(html, /Founder smoke test/);
    assert.match(html, /Landing Path/);
    assert.match(html, /Diamond shape/);
    assert.match(html, /Setting \/ style/);
    assert.match(html, /Oct 5, 2026/);
    assert.match(websiteIntakeSubmittedLabel(intake.submittedAt), /Oct 5, 2026/);
    assert.doesNotMatch(html, /\b(?:natural|lab|proposal)\b/i);
    assert.match(html, /min-w-0/);
    assert.match(html, /break-words/);
  });

  it("stays collapsed when the person is no longer a brand-new prospect", () => {
    const html = renderToStaticMarkup(
      createElement(ConciergeIntakeDetail, { intake }),
    );
    assert.doesNotMatch(html, /<details[^>]*open=""/);
  });

  it("uses the same canonical reader and presentation helpers on Today and Clients", () => {
    const root = process.cwd();
    const todayPage = readFileSync(
      join(root, "app", "executive-dashboard", "concierge", "page.tsx"),
      "utf8",
    );
    const todaySections = readFileSync(
      join(root, "app", "executive-dashboard", "concierge", "components", "today-operating-sections.tsx"),
      "utf8",
    );
    assert.match(todayPage, /loadActiveClientWebsiteIntakes/);
    assert.match(todaySections, /websiteIntakeFields/);
    assert.match(todaySections, /websiteIntakeWhatMatters/);
    assert.doesNotMatch(todayPage, /website-intake\/today/);
  });
});
