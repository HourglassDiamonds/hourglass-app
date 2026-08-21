import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { SITE_URL } from "@/lib/seo/site-metadata";
import { studioViewEmailedHasPii } from "@/app/diamond-studio/analytics";
import {
  DIAMOND_STUDIO_CONFIGURATION_DEFAULTS,
  configurationSharePath,
} from "@/lib/diamond-studio/configuration";
import type { StudioSnapshotResult } from "@/lib/diamond-studio/snapshot";
import type { StudioPersistResult } from "./store";
import type { StudioViewEmailedRecord } from "./types";
import { handleEmailStudioView } from "./handle";
import { renderStudioViewEmail, studioViewEmailContainsMarketingLanguage } from "./render-email";
import { createFakeStudioViewEmailSender } from "./send";
import { emailCompositionContainsLocalhost, studioPublicOrigin } from "./origin";
import { resetStudioEmailRateLimits } from "./rate-limit";
import {
  listStudioViewEmailedFromMemory,
  resetStudioIdentifiedEventStore,
} from "./store";
import { resetStudioOperationalSignals } from "@/lib/agent-os/diamond-studio/operational";
import { STUDIO_VIEW_EMAIL_CTA, STUDIO_VIEW_EMAIL_SUBJECT } from "./types";

const CONFIG = DIAMOND_STUDIO_CONFIGURATION_DEFAULTS;

const TEST_ENV = {
  RESEND_API_KEY: "re_test",
  STUDIO_VIEW_EMAIL_FROM: "Hourglass Diamonds <concierge@hourglassdiamonds.com>",
  NODE_ENV: "test",
} as NodeJS.ProcessEnv;

const JPEG: StudioSnapshotResult = {
  mimeType: "image/jpeg",
  width: 1200,
  height: 1640,
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  variant: "card",
};

async function fakeCompose(): Promise<StudioSnapshotResult> {
  return JPEG;
}

function payload(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    email: "visitor@example.com",
    configuration: CONFIG,
    ...overrides,
  });
}

async function submit(
  rawBody: string,
  extras?: {
    sender?: ReturnType<typeof createFakeStudioViewEmailSender>;
    ip?: string;
    env?: NodeJS.ProcessEnv;
    persist?: (
      record: StudioViewEmailedRecord,
    ) => Promise<StudioPersistResult>;
  },
) {
  const sender = extras?.sender ?? createFakeStudioViewEmailSender();
  const persisted: unknown[] = [];
  const result = await handleEmailStudioView({
    rawBody,
    ip: extras?.ip ?? "203.0.113.10",
    deps: {
      sender,
      composeCard: fakeCompose,
      env: extras?.env ?? TEST_ENV,
      persist:
        extras?.persist ??
        (async (record) => {
          persisted.push(record);
          return {
            ok: true,
            adapter: "memory",
            durable: false,
            status: "memory",
          };
        }),
    },
  });
  return { result, sender, persisted };
}

beforeEach(() => {
  resetStudioEmailRateLimits();
  resetStudioIdentifiedEventStore();
  resetStudioOperationalSignals();
});

afterEach(() => {
  resetStudioEmailRateLimits();
  resetStudioIdentifiedEventStore();
  resetStudioOperationalSignals();
});

describe("Email This View — validation", () => {
  it("accepts a valid email and typed configuration", async () => {
    const { result, sender, persisted } = await submit(payload());
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.accepted, true);
    assert.equal(sender.calls.length, 1);
    assert.equal(persisted.length, 1);
  });

  it("rejects an invalid email", async () => {
    const { result, sender, persisted } = await submit(
      payload({ email: "not-an-email" }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "invalid_email");
    assert.equal(sender.calls.length, 0);
    assert.equal(persisted.length, 0);
  });

  it("rejects CRLF header injection in email", async () => {
    const { result, sender } = await submit(
      payload({ email: "visitor@example.com\r\nBcc: other@example.com" }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "invalid_email");
    assert.equal(sender.calls.length, 0);
  });

  it("rejects invalid shape, metal, band width, and ring size", async () => {
    for (const configuration of [
      { ...CONFIG, shape: "hexagon" },
      { ...CONFIG, metal: "platinum" },
      { ...CONFIG, bandWidth: 9 },
      { ...CONFIG, ringSize: 99 },
    ]) {
      const { result, sender } = await submit(payload({ configuration }));
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.code, "unsupported_configuration");
      assert.equal(sender.calls.length, 0);
    }
  });

  it("soft-succeeds honeypot without sending or storing", async () => {
    const { result, sender, persisted } = await submit(
      payload({ company_website: "https://bot.example" }),
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.accepted, false);
    assert.equal(sender.calls.length, 0);
    assert.equal(persisted.length, 0);
  });

  it("rate-limits after three successful sends per minute", async () => {
    const sender = createFakeStudioViewEmailSender();
    for (let i = 0; i < 3; i += 1) {
      const { result } = await submit(payload({ email: `v${i}@example.com` }), {
        sender,
        ip: "198.51.100.9",
      });
      assert.equal(result.ok, true);
    }
    const fourth = await submit(payload({ email: "v3@example.com" }), {
      sender,
      ip: "198.51.100.9",
    });
    assert.equal(fourth.result.ok, false);
    if (!fourth.result.ok) assert.equal(fourth.result.code, "rate_limited");
    assert.equal(sender.calls.length, 3);
  });
});

describe("Email This View — content", () => {
  it("uses transactional subject, configuration text, and production origin", async () => {
    const identified = {
      ...CONFIG,
      carat: 3,
      skinTone: "dark" as const,
      metal: "white-gold" as const,
    };
    const { result, sender } = await submit(
      payload({
        email: "jane@example.com",
        configuration: identified,
      }),
      {
        env: {
          ...TEST_ENV,
          NODE_ENV: "production",
          VERCEL_ENV: "production",
          STUDIO_EMAIL_LOCAL_ORIGIN: "http://localhost:3000",
        },
      },
    );
    assert.equal(result.ok, true);
    const call = sender.calls[0]!;
    assert.equal(call.subject, STUDIO_VIEW_EMAIL_SUBJECT);
    assert.equal(
      call.from,
      "Hourglass Diamonds <concierge@hourglassdiamonds.com>",
    );
    assert.match(call.text, /3\.00 ct Round/);
    assert.match(call.text, /Size 6 · 2\.0 mm White Gold/);
    assert.match(call.text, new RegExp(STUDIO_VIEW_EMAIL_CTA));
    assert.match(call.html, /cid:studio-share-card/);
    assert.match(call.html, /max-width:640px/);
    assert.match(call.html, /The configuration you were comparing/);
    assert.match(call.html, /Diamond sizing shown at calibrated scale/);
    assert.match(call.text, /The configuration you were comparing/);
    assert.match(call.text, /Diamond sizing shown at calibrated scale/);
    assert.equal(call.attachmentCount, 1);
    assert.match(call.attachmentNames[0]!, /card\.jpg$/);
    assert.match(call.text, new RegExp(SITE_URL.replace("https://", "")));
    assert.equal(emailCompositionContainsLocalhost(call.html), false);
    assert.equal(emailCompositionContainsLocalhost(call.text), false);
    assert.doesNotMatch(call.html, /localhost/);
    assert.equal(
      studioViewEmailContainsMarketingLanguage({
        subject: call.subject,
        html: call.html,
        text: call.text,
        shareUrl: `${SITE_URL}${configurationSharePath(identified)}`,
        headline: "3.00 ct Round",
        detail: "Size 6 · 2.0 mm White Gold",
      }),
      false,
    );
  });

  it("places orientation only when Phase B already considers it meaningful", () => {
    const round = renderStudioViewEmail({
      configuration: CONFIG,
      sharePath: configurationSharePath(CONFIG),
    });
    assert.doesNotMatch(round.html, /orientation/i);

    const ovalEw = renderStudioViewEmail({
      configuration: {
        ...CONFIG,
        shape: "oval",
        carat: 2.75,
        metal: "rose-gold",
        orientation: "ew",
      },
      sharePath: "/diamond-studio",
    });
    assert.match(ovalEw.html, /E\/W orientation/);
    assert.match(ovalEw.text, /E\/W orientation/);
    assert.doesNotMatch(ovalEw.html, /skin|Light|Dark/i);
  });

  it("never composes localhost in production even if a local origin is set", () => {
    const origin = studioPublicOrigin({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      STUDIO_EMAIL_LOCAL_ORIGIN: "http://localhost:3000",
    });
    assert.equal(origin, SITE_URL);
    const rendered = renderStudioViewEmail({
      configuration: CONFIG,
      sharePath: configurationSharePath(CONFIG),
      env: {
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        STUDIO_EMAIL_LOCAL_ORIGIN: "http://localhost:9999",
      },
    });
    assert.match(rendered.shareUrl, /^https:\/\/www\.hourglassdiamonds\.com\//);
    assert.equal(emailCompositionContainsLocalhost(rendered.html), false);
    assert.match(rendered.html, /Your Diamond Studio view/);
    assert.match(rendered.html, /max-width:640px/);
    assert.match(rendered.html, /width="100%"/);
    assert.match(rendered.html, /width="640"/);
    assert.doesNotMatch(rendered.html, /Book now|Contact us|Begin the Conversation/i);
  });
});

describe("Email This View — privacy and events", () => {
  it("does not put email in the share path, snapshot path, or GA payload", async () => {
    const { result } = await submit(
      payload({ email: "secret.person@example.com" }),
    );
    assert.equal(result.ok, true);
    if (!result.ok || !result.record) return;
    assert.equal(result.record.studioSharePath.includes("@"), false);
    assert.equal(result.record.studioSharePath.includes("email"), false);
    const ga = {
      shape: result.record.configuration.shape,
      carat: result.record.configuration.carat,
      fingerSize: result.record.configuration.ringSize,
      skinTone: result.record.configuration.skinTone,
      metal: result.record.configuration.metal,
      bandWidth: result.record.configuration.bandWidth,
      orientation: result.record.configuration.orientation,
      snapshotVariant: "card",
    };
    assert.equal(studioViewEmailedHasPii(ga), false);
    assert.equal(
      studioViewEmailedHasPii({ ...ga, email: "secret.person@example.com" }),
      true,
    );
  });

  it("creates studio_view_emailed only after a successful send", async () => {
    const failSender = createFakeStudioViewEmailSender({ fail: true });
    const failed = await submit(payload(), { sender: failSender });
    assert.equal(failed.result.ok, false);
    if (!failed.result.ok) assert.equal(failed.result.code, "mail_failed");
    assert.equal(failed.persisted.length, 0);
    assert.equal(listStudioViewEmailedFromMemory().length, 0);

    const okSender = createFakeStudioViewEmailSender();
    const ok = await submit(payload({ email: "ok@example.com" }), {
      sender: okSender,
    });
    assert.equal(ok.result.ok, true);
    if (ok.result.ok) {
      assert.equal(ok.result.record?.event, "studio_view_emailed");
      assert.equal(ok.result.record?.status, "sent");
      assert.equal(ok.result.record?.marketingConsent, false);
      assert.equal(ok.result.record?.inquiryCreated, false);
    }
    assert.equal(ok.persisted.length, 1);
  });

  it("keeps customer success when persistence fails after send", async () => {
    const sender = createFakeStudioViewEmailSender();
    const { result } = await submit(payload({ email: "ok@example.com" }), {
      sender,
      env: {
        ...TEST_ENV,
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
      },
      persist: async () => ({
        ok: false,
        adapter: "supabase",
        durable: false,
        status: "failed",
        reason: "write_failed",
      }),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.accepted, true);
      assert.equal(result.message, "Sent. Check your inbox.");
      assert.equal(result.persistence?.status, "failed");
      assert.equal(result.persistence?.durable, false);
    }
    assert.equal(sender.calls.length, 1);
  });
});
