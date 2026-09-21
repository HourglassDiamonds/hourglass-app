import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InMemoryCandidateStore } from "@/lib/continuum/candidates/store";
import {
  classifyTodayCommunication,
  isClientPersonLabel,
  isFounderIdentityName,
  isNakedDateText,
  isPlatformOrSystemName,
  isVendorOrganizationLabel,
} from "@/lib/continuum/candidates/founder-attention";
import { ChiefOfStaffToday } from "../../../../app/executive-dashboard/concierge/components/chief-of-staff-today";
import { composeCosOperatingLoop } from "./compose";
import { COS_DOCKET_VISIBLE_LIMIT, composeTodayDocket } from "./docket";
import { disposeDocketItem } from "./disposition";
import { selectFounderControls } from "./founder-actions";
import {
  COS_LOOP_NOW,
  COS_LOOP_PROJECT_A,
  fixtureCandidate,
} from "./fixtures";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { CosProjectContext } from "./types";

const PERSON_BEE = "77777777-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PERSON_JUSTIN = "99999999-cccc-4ccc-8ccc-cccccccccccc";
const BEE_THREAD = "bee1thread01";
const SUPABASE_THREAD = "supabaseThread1";
const STAMP_THREAD = "stamprintsThrd1";

function todayOf(candidates: ContinuumCandidate[], projects?: Map<string, CosProjectContext>) {
  return composeTodayDocket(
    composeCosOperatingLoop({
      jobs: [],
      candidates,
      projects: projects ?? new Map(),
      nowIso: COS_LOOP_NOW,
    }),
  );
}

function staleNakedDate(extra: Partial<ContinuumCandidate> & Pick<ContinuumCandidate, "candidateId">): ContinuumCandidate {
  return fixtureCandidate({
    sourceSystem: "gmail",
    sourceRef: `gc1|${BEE_THREAD}|${extra.candidateId}`,
    candidateType: "date",
    proposedTarget: { kind: "none" },
    payload: {
      kind: "date",
      raw: "September 9, 2026",
      isoDate: "2026-09-09",
      precision: "day",
      role: "deadline",
      sourceTimestamp: COS_LOOP_NOW,
      resolutionCalendar: "source-timestamp-utc-date",
    },
    evidenceBasis: {
      ruleIds: ["explicit_date"],
      matchedText: "September 9, 2026",
    },
    ...extra,
  });
}

describe("Today live cleanup", () => {
  it("A. Bee Engraving: stale date + founder identity never become a Today card or Person counterpart", () => {
    const projects = new Map<string, CosProjectContext>([
      [
        COS_LOOP_PROJECT_A,
        {
          projectId: COS_LOOP_PROJECT_A,
          title: "HGD x Bee Engraving",
          personName: null,
          people: [
            { personId: PERSON_JUSTIN, displayName: "Justin Smith", role: "client" },
            {
              personId: PERSON_BEE,
              displayName: "Bee Engraving",
              role: "vendor-contact",
            },
          ],
          isCurrent: true,
          gmailThreadId: BEE_THREAD,
        },
      ],
    ]);
    const stale = staleNakedDate({ candidateId: "bee-stale-date" });
    const shop = fixtureCandidate({
      candidateId: "bee-shop",
      sourceRef: `gc1|${BEE_THREAD}|bee-shop`,
      sourceTimestamp: "2026-09-06T15:00:00.000Z",
      candidateType: "project_context",
      proposedTarget: { kind: "project", projectId: COS_LOOP_PROJECT_A },
      payload: {
        kind: "project_context",
        topic: "design_refinement",
        value: "Re: HGD x Bee Engraving",
      },
      evidenceBasis: {
        ruleIds: ["vendor_shop_update"],
        matchedText: "Bee can start the engraving Monday.",
      },
    });
    const founderAssoc = fixtureCandidate({
      candidateId: "justin-assoc",
      sourceRef: `gc1|${BEE_THREAD}|justin-assoc`,
      candidateType: "person_association",
      confidence: "high",
      proposedTarget: { kind: "person", personId: PERSON_JUSTIN },
      payload: {
        kind: "person_association",
        displayName: "Justin Smith",
        emailHash: "hash",
        mintPerson: false,
        mergePersons: false,
      },
      evidenceBasis: {
        ruleIds: ["gmail_participant"],
        matchedText: "Justin Smith",
      },
    });
    assert.equal(isFounderIdentityName("Justin Smith"), true);
    assert.equal(isVendorOrganizationLabel("Bee Engraving"), true);
    assert.equal(isClientPersonLabel("Justin Smith"), false);
    assert.equal(isNakedDateText("September 9, 2026"), true);
    assert.equal(
      classifyTodayCommunication({
        candidates: [stale, shop, founderAssoc],
        people: projects.get(COS_LOOP_PROJECT_A)!.people.map((row) => ({
          displayName: row.displayName,
          roles: row.role ? [row.role] : [],
        })),
      }),
      "vendor",
    );
    const docket = todayOf([stale, shop, founderAssoc], projects);
    assert.equal(
      docket.items.some((item) => /september 9, 2026/i.test(`${item.headline} ${item.context ?? ""}`)),
      false,
    );
    assert.equal(
      docket.items.some((item) => /Justin/i.test(`${item.subject} ${item.headline} ${item.context ?? ""} ${item.brief?.personLabel ?? ""}`)),
      false,
    );
    const bee = docket.items.find((item) =>
      /Bee Engraving/i.test(`${item.subject} ${item.brief?.organizationLabel ?? ""} ${item.brief?.projectTitle ?? ""}`),
    );
    if (bee) {
      assert.notEqual(bee.subject, "Unassigned");
      assert.match(bee.subject, /Bee Engraving/i);
      const controls = selectFounderControls(bee);
      assert.equal(controls.confirmPerson, null);
      assert.equal(controls.family === "person_association", false);
    }
    for (const item of docket.items) {
      for (const beat of item.brief?.evidence ?? []) {
        assert.doesNotMatch(beat.label, /Justin/i);
      }
      assert.equal(
        item.brief?.actions.some((action) => action.kind === "confirm_person") ?? false,
        false,
      );
    }
  });

  it("B. Supabase platform/newsletter mail does not become client identification or recap", () => {
    const assoc = fixtureCandidate({
      candidateId: "supabase-person",
      sourceRef: `gc1|${SUPABASE_THREAD}|supabase-person`,
      candidateType: "person_association",
      payload: {
        kind: "person_association",
        displayName: "Supabase",
        emailHash: "supa",
        mintPerson: false,
        mergePersons: false,
      },
      evidenceBasis: {
        ruleIds: ["gmail_participant"],
        matchedText: "Supabase",
      },
    });
    const update = fixtureCandidate({
      candidateId: "supabase-update",
      sourceRef: `gc1|${SUPABASE_THREAD}|supabase-update`,
      sourceTimestamp: "2026-09-07T12:00:00.000Z",
      proposedTarget: { kind: "none" },
      payload: {
        kind: "project_context",
        topic: "design_refinement",
        value: "Product update: advisory on your organization",
      },
      evidenceBasis: {
        ruleIds: ["explicit_design_refinement"],
        matchedText: "Unsubscribe from this product update. What's new in Auth this week.",
      },
    });
    assert.equal(isPlatformOrSystemName("Supabase"), true);
    assert.equal(isClientPersonLabel("Supabase"), false);
    assert.equal(
      classifyTodayCommunication({ candidates: [assoc, update] }),
      "platform",
    );
    const docket = todayOf([assoc, update]);
    const hay = docket.items
      .map((item) => `${item.headline} ${item.context ?? ""} ${item.subject}`)
      .join("\n");
    assert.doesNotMatch(hay, /Identify the client/i);
    assert.doesNotMatch(hay, /send the recap/i);
    assert.equal(
      docket.items.some((item) =>
        item.brief?.actions.some((action) => action.kind === "confirm_person"),
      ),
      false,
    );
  });

  it("C. Stamprints vendor/support is not unknown client intake", () => {
    const assoc = fixtureCandidate({
      candidateId: "stamp-person",
      sourceRef: `gc1|${STAMP_THREAD}|stamp-person`,
      candidateType: "person_association",
      proposedTarget: { kind: "none" },
      payload: {
        kind: "person_association",
        displayName: "Stamprints",
        emailHash: "stamp",
        mintPerson: false,
        mergePersons: false,
      },
      evidenceBasis: {
        ruleIds: ["gmail_participant"],
        matchedText: "Stamprints Support",
      },
    });
    const ticket = fixtureCandidate({
      candidateId: "stamp-ticket",
      sourceRef: `gc1|${STAMP_THREAD}|stamp-ticket`,
      proposedTarget: { kind: "none" },
      payload: {
        kind: "project_context",
        topic: "design_refinement",
        value: "Re: order #4411",
      },
      evidenceBasis: {
        ruleIds: ["vendor_shop_update"],
        matchedText: "Your support ticket is in progress. We'll send tracking when ready.",
      },
    });
    assert.equal(isVendorOrganizationLabel("Stamprints"), true);
    assert.equal(isClientPersonLabel("Stamprints"), false);
    assert.equal(
      classifyTodayCommunication({ candidates: [assoc, ticket] }),
      "vendor",
    );
    const docket = todayOf([assoc, ticket]);
    const hay = [
      ...docket.items.map((item) => `${item.headline} ${item.context ?? ""} ${item.subject}`),
      ...docket.watching.map((row) => `${row.title} ${row.detail}`),
    ].join("\n");
    assert.doesNotMatch(hay, /Identify the client/i);
    const stampCard = docket.items[0] ?? docket.watching[0];
    assert.ok(stampCard);
    const stampSubject = "subject" in stampCard ? stampCard.subject : stampCard.title;
    assert.notEqual(stampSubject, "Unassigned");
    assert.match(stampSubject ?? "", /Stamprints/i);
    assert.equal(
      docket.items.some((item) =>
        item.brief?.actions.some((action) => action.kind === "confirm_person"),
      ),
      false,
    );
    if ("brief" in stampCard && stampCard.brief) {
      assert.equal(selectFounderControls(stampCard).confirmPerson, null);
    }
  });

  it("D/E. Dismiss removes the card, survives recomposition, and keeps source evidence", async () => {
    const store = new InMemoryCandidateStore();
    const person = fixtureCandidate({
      candidateId: "alex-assoc",
      sourceRef: "gc1|alexthread01|alex-assoc",
      candidateType: "person_association",
      payload: {
        kind: "person_association",
        displayName: "Alex Hale",
        emailHash: "alex",
        mintPerson: false,
        mergePersons: false,
      },
      evidenceBasis: {
        ruleIds: ["gmail_participant"],
        matchedText: "Alex Hale",
      },
    });
    const reply = fixtureCandidate({
      candidateId: "alex-reply",
      sourceRef: "gc1|alexthread01|alex-reply",
      proposedTarget: { kind: "none" },
      payload: {
        kind: "project_context",
        topic: "cad_revision",
        value: "Can we thin the band?",
      },
      evidenceBasis: {
        ruleIds: ["explicit_cad_revision"],
        matchedText: "Can we thin the band on the CAD revision?",
      },
    });
    await store.replace(person);
    await store.replace(reply);
    const before = todayOf(await store.list());
    assert.ok(before.items.length >= 1);
    const card = before.items[0]!;
    const controls = selectFounderControls(card);
    assert.ok(controls.actions.some((row) => row.verb === "dismiss"));
    const html = renderToStaticMarkup(
      createElement(ChiefOfStaffToday, {
        loop: composeCosOperatingLoop({
          jobs: [],
          candidates: await store.list(),
          nowIso: COS_LOOP_NOW,
        }),
      }),
    );
    assert.match(html, /Dismiss from Today/);
    assert.match(html, /Snooze/);
    const dismissed = await disposeDocketItem(
      { nowIso: () => COS_LOOP_NOW, candidates: store },
      {
        verb: "dismiss",
        origin: card.origin,
        itemId: card.id,
        projectId: card.brief?.projectId ?? null,
        jobId: null,
        candidateIds: card.brief?.candidateIds ?? [person.candidateId, reply.candidateId],
        mutationId: randomUUID(),
        actor: "justin",
      },
    );
    assert.equal(dismissed.ok, true);
    if (!dismissed.ok) return;
    assert.ok(dismissed.reviewedCandidateIds.length > 0);
    const after = todayOf(await store.list());
    assert.equal(after.items.some((item) => item.id === card.id), false);
    const recomposed = todayOf(await store.list());
    assert.equal(recomposed.items.some((item) => item.id === card.id), false);
    const storedReply = await store.get(reply.candidateId);
    assert.ok(storedReply);
    assert.equal(storedReply?.reviewStatus, "discarded");
    assert.equal(storedReply?.payload.kind, "project_context");

    const later = fixtureCandidate({
      candidateId: "alex-new-turn",
      sourceRef: "gc1|alexthread01|alex-new-turn",
      sourceTimestamp: "2026-09-08T16:00:00.000Z",
      proposedTarget: { kind: "none" },
      payload: {
        kind: "project_context",
        topic: "cad_revision",
        value: "Please also check the prongs.",
      },
      evidenceBasis: {
        ruleIds: ["explicit_cad_revision"],
        matchedText: "Please also check the prongs on this CAD revision.",
      },
    });
    await store.replace(later);
    const next = todayOf(await store.list());
    assert.ok(next.items.some((item) => item.brief?.candidateIds.includes(later.candidateId)));
    assert.equal(COS_DOCKET_VISIBLE_LIMIT, 3);
  });

  it("known vendor organization with unknown contact is not Unassigned or Confirm Person", () => {
    const assoc = fixtureCandidate({
      candidateId: "bee-org",
      sourceRef: `gc1|${BEE_THREAD}|bee-org`,
      candidateType: "person_association",
      proposedTarget: { kind: "none" },
      payload: {
        kind: "person_association",
        displayName: "Bee Engraving",
        emailHash: "bee",
        mintPerson: false,
        mergePersons: false,
      },
      evidenceBasis: {
        ruleIds: ["gmail_participant"],
        matchedText: "Bee Engraving",
      },
    });
    const update = fixtureCandidate({
      candidateId: "bee-update",
      sourceRef: `gc1|${BEE_THREAD}|bee-update`,
      sourceTimestamp: "2026-09-06T15:00:00.000Z",
      proposedTarget: { kind: "none" },
      candidateType: "project_context",
      payload: {
        kind: "project_context",
        topic: "design_refinement",
        value: "Re: HGD x Bee Engraving",
      },
      evidenceBasis: {
        ruleIds: ["vendor_shop_update"],
        matchedText: "Bee can start the engraving Monday.",
      },
    });
    assert.equal(
      classifyTodayCommunication({ candidates: [assoc, update] }),
      "vendor",
    );
    const docket = todayOf([assoc, update]);
    const card = docket.items[0];
    const watch = docket.watching[0];
    assert.ok(card || watch);
    assert.match((card?.subject ?? watch?.title) ?? "", /Bee Engraving/);
    assert.notEqual(card?.subject ?? watch?.title, "Unassigned");
    if (card) {
      assert.equal(card.brief?.personLabel ?? null, null);
      assert.equal(card.brief?.organizationLabel, "Bee Engraving");
      assert.equal(
        card.brief?.actions.some((action) => action.kind === "confirm_person") ?? false,
        false,
      );
      assert.equal(selectFounderControls(card).confirmPerson, null);
    }
    const html = renderToStaticMarkup(
      createElement(ChiefOfStaffToday, {
        loop: composeCosOperatingLoop({
          jobs: [],
          candidates: [assoc, update],
          nowIso: COS_LOOP_NOW,
        }),
      }),
    );
    assert.doesNotMatch(html, /Confirm person/);
    assert.doesNotMatch(html, />Unassigned</);
    assert.match(html, /Bee Engraving/);
  });

  it("known vendor contact is shown and is not client intake", () => {
    const personId = "88888888-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const projects = new Map<string, CosProjectContext>([
      [
        COS_LOOP_PROJECT_A,
        {
          projectId: COS_LOOP_PROJECT_A,
          title: "Vlora melee",
          personName: null,
          people: [
            {
              personId: personId,
              displayName: "Niurka Lulo",
              role: "vendor-contact",
              organizationName: "Vlora",
            },
          ],
          isCurrent: true,
          gmailThreadId: "vloraThread001",
        },
      ],
    ]);
    const assoc = fixtureCandidate({
      candidateId: "niurka-assoc",
      sourceRef: "gc1|vloraThread001|niurka-assoc",
      candidateType: "person_association",
      proposedTarget: { kind: "person", personId },
      payload: {
        kind: "person_association",
        displayName: "Niurka Lulo",
        emailHash: "niurka",
        mintPerson: false,
        mergePersons: false,
      },
      evidenceBasis: {
        ruleIds: ["gmail_participant"],
        matchedText: "Niurka Lulo",
      },
    });
    const update = fixtureCandidate({
      candidateId: "niurka-update",
      sourceRef: "gc1|vloraThread001|niurka-update",
      sourceTimestamp: "2026-09-06T15:00:00.000Z",
      proposedTarget: { kind: "project", projectId: COS_LOOP_PROJECT_A },
      candidateType: "project_context",
      payload: {
        kind: "project_context",
        topic: "design_refinement",
        value: "Stones are ready to ship.",
      },
      evidenceBasis: {
        ruleIds: ["vendor_shop_update"],
        matchedText: "We'll send tracking when ready.",
      },
    });
    const docket = todayOf([assoc, update], projects);
    const card =
      docket.items.find((item) => item.brief?.projectId === COS_LOOP_PROJECT_A) ??
      docket.items[0];
    const watch = docket.watching.find((row) => /Niurka|Vlora/i.test(row.title)) ?? docket.watching[0];
    assert.ok(card || watch);
    assert.match((card?.subject ?? watch?.title) ?? "", /Niurka Lulo|Vlora/i);
    assert.notEqual(card?.subject ?? watch?.title, "Unassigned");
    if (card) {
      assert.equal(card.brief?.personLabel ?? null, null);
      assert.equal(
        card.brief?.actions.some((action) => action.kind === "confirm_person") ?? false,
        false,
      );
      assert.equal(selectFounderControls(card).confirmPerson, null);
    }
  });

  it("genuine unknown client Person still offers Confirm Person", () => {
    const assoc = fixtureCandidate({
      candidateId: "alex-unknown",
      sourceRef: "gc1|alexthread02|alex-unknown",
      candidateType: "person_association",
      payload: {
        kind: "person_association",
        displayName: "Alex Hale",
        emailHash: "alex2",
        mintPerson: false,
        mergePersons: false,
      },
      evidenceBasis: {
        ruleIds: ["gmail_participant"],
        matchedText: "Alex Hale",
      },
    });
    const reply = fixtureCandidate({
      candidateId: "alex-unknown-reply",
      sourceRef: "gc1|alexthread02|alex-unknown-reply",
      proposedTarget: { kind: "none" },
      payload: {
        kind: "project_context",
        topic: "cad_revision",
        value: "Can we thin the band?",
      },
      evidenceBasis: {
        ruleIds: ["explicit_cad_revision"],
        matchedText: "Can we thin the band on the CAD revision?",
      },
    });
    assert.equal(
      classifyTodayCommunication({ candidates: [assoc, reply] }),
      "client",
    );
    const docket = todayOf([assoc, reply]);
    const card = docket.items[0];
    assert.ok(card);
    assert.equal(
      card?.brief?.actions.some((action) => action.kind === "confirm_person"),
      false,
    );
    const controls = selectFounderControls(card!);
    assert.equal(controls.confirmPerson, null);
    const html = renderToStaticMarkup(
      createElement(ChiefOfStaffToday, {
        loop: composeCosOperatingLoop({
          jobs: [],
          candidates: [assoc, reply],
          nowIso: COS_LOOP_NOW,
        }),
      }),
    );
    assert.doesNotMatch(html, /Confirm person/);
    assert.match(html, /Dismiss from Today/);
  });
});
