import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { InMemoryGmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import {
  ACHEDEKAL_KNOWN_ARTIFACT_BYTE_CAP,
  ACHEDEKAL_KNOWN_ARTIFACT_FILENAME,
  ACHEDEKAL_KNOWN_ARTIFACT_MIME,
  ACHEDEKAL_KNOWN_ARTIFACT_PATH,
  ACHEDEKAL_PROJECT_ID,
} from "./achedekal-acceptance";
import {
  executeAchedekalKnownArtifactPreview,
  failedAchedekalKnownArtifact,
  selectAchedekalKnownArtifact,
  type AchedekalKnownArtifactInput,
} from "./achedekal-known-artifact";
import { ALEA_KNOWN_THREAD_ID } from "./alea-known-thread-fixture";
import {
  connectFounderMailbox,
  InMemoryGmailConnectionStore,
  type GmailConnectionStore,
} from "./connection";
import { InMemoryGmailAttachmentStore } from "./attachments";
import type { ExactProjectThreadLookup, ExactProjectThreadPointer } from "./exact-thread";
import {
  createLiveKnownArtifactGmailApi,
  MockKnownArtifactGmailApi,
  type KnownArtifactGmailApi,
} from "./known-artifact-gmail";
import type { GmailAccessTokenRefresh } from "./oauth";
import { decryptRefreshToken, encryptRefreshToken } from "./token-crypto";
import {
  GMAIL_READONLY_SCOPE,
  type GmailAttachmentMeta,
  type GmailConnection,
} from "./types";
import type {
  GmailIndexInput,
  IndexGmailMessageResult,
} from "@/lib/continuum/client-memory/gmail/types";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const KEY = Buffer.from("c".repeat(64), "hex");
const NOW = "2026-08-29T16:00:00.000Z";
const ACCESS = "access-in-memory-only";
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xd9, 0x01, 0x02, 0x03]);
const JPEG_DATA = JPEG_BYTES.toString("base64url");
const MSG_CAD = "msg-alea-known-2";
const ATT_CAD = "att-h017-cbr";
const OTHER_PROJECT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const OTHER_THREAD_ID = "18aaa111bbb222cc";

class RecordingLookup implements ExactProjectThreadLookup {
  requested: string[] = [];

  constructor(private readonly rows: Map<string, ExactProjectThreadPointer>) {}

  getByProjectId(projectId: string) {
    this.requested.push(projectId);
    return Promise.resolve(this.rows.get(projectId) ?? null);
  }
}

class RecordingIndex extends InMemoryGmailIndexStore {
  listCalls = 0;
  indexCalls = 0;

  async indexMessage(
    input: GmailIndexInput,
    indexedAt: string,
  ): Promise<IndexGmailMessageResult> {
    this.indexCalls += 1;
    return super.indexMessage(input, indexedAt);
  }

  async listMessagesByThread(threadId: string) {
    this.listCalls += 1;
    return super.listMessagesByThread(threadId);
  }
}

class RecordingAttachments extends InMemoryGmailAttachmentStore {
  puts = 0;

  async putAttachment(row: GmailAttachmentMeta) {
    this.puts += 1;
    return super.putAttachment(row);
  }
}

class RecordingConnections implements GmailConnectionStore {
  writes = 0;

  constructor(private readonly inner: InMemoryGmailConnectionStore) {}

  getFounderConnection() {
    return this.inner.getFounderConnection();
  }

  async putConnection(row: GmailConnection) {
    this.writes += 1;
    return this.inner.putConnection(row);
  }
}

function pointer(gmailThreadId: string | null): ExactProjectThreadPointer {
  return {
    projectId: ACHEDEKAL_PROJECT_ID,
    gmailThreadId,
    fingerSize: "141",
    orderNumber: "140",
    cadJobNumber: "CBR2000037",
    metal: null,
    centerStone: null,
  };
}

async function connectedStore() {
  const store = new InMemoryGmailConnectionStore();
  const wrapped = encryptRefreshToken("refresh-keep", KEY);
  await store.putConnection({
    ...connectFounderMailbox({
      existing: null,
      mailboxEmailHash: "ab".repeat(32),
      refreshToken: wrapped,
      grantedScope: GMAIL_READONLY_SCOPE,
      providerTokenType: "Bearer",
      now: NOW,
    }),
    lastSyncAt: null,
  });
  return store;
}

function attachment(row: Partial<GmailAttachmentMeta> & Pick<GmailAttachmentMeta, "attachmentId" | "messageId">): GmailAttachmentMeta {
  return {
    threadId: ALEA_KNOWN_THREAD_ID,
    filename: ACHEDEKAL_KNOWN_ARTIFACT_FILENAME,
    mimeType: ACHEDEKAL_KNOWN_ARTIFACT_MIME,
    sizeBytes: 1_540_698,
    indexedAt: NOW,
    ...row,
  };
}

async function seedKnownIndex(index: InMemoryGmailIndexStore, threadId = ALEA_KNOWN_THREAD_ID) {
  await index.indexMessage(
    {
      messageId: "msg-alea-known-1",
      threadId,
      sentAt: "2026-08-06T15:12:00.000Z",
      subject: "RE: HGD - A. Achedekal-CBR2000037",
      fromEmail: "vendor@example.com",
      toEmails: ["founder@hourglass.example"],
      direction: "inbound",
      hasAttachments: true,
    },
    NOW,
  );
  await index.indexMessage(
    {
      messageId: MSG_CAD,
      threadId,
      sentAt: "2026-08-07T11:04:00.000Z",
      subject: "RE: HGD - A. Achedekal-CBR2000037",
      fromEmail: "vendor@example.com",
      toEmails: ["founder@hourglass.example"],
      direction: "inbound",
      hasAttachments: true,
    },
    NOW,
  );
}

async function seedKnownAttachments(
  attachments: InMemoryGmailAttachmentStore,
  extras: GmailAttachmentMeta[] = [],
) {
  await attachments.putAttachment(
    attachment({
      attachmentId: "att-image001-a",
      messageId: "msg-alea-known-1",
      filename: "image001.jpg",
      sizeBytes: 2048,
    }),
  );
  await attachments.putAttachment(
    attachment({
      attachmentId: "att-image001-b",
      messageId: MSG_CAD,
      filename: "image001.jpg",
      sizeBytes: 1800,
    }),
  );
  await attachments.putAttachment(
    attachment({
      attachmentId: ATT_CAD,
      messageId: MSG_CAD,
    }),
  );
  for (const row of extras) await attachments.putAttachment(row);
}

async function runPreview(
  overrides: Partial<AchedekalKnownArtifactInput> & {
    api?: MockKnownArtifactGmailApi;
    refresh?: (refreshToken: string) => Promise<GmailAccessTokenRefresh>;
    createApiCalls?: { count: number };
  } = {},
) {
  const index = overrides.index ?? new InMemoryGmailIndexStore();
  const attachments = overrides.attachments ?? new InMemoryGmailAttachmentStore();
  if (!overrides.index) await seedKnownIndex(index as InMemoryGmailIndexStore);
  if (!overrides.attachments) {
    await seedKnownAttachments(attachments as InMemoryGmailAttachmentStore);
  }
  const api = overrides.api ?? new MockKnownArtifactGmailApi();
  if (!overrides.api) {
    api.setAttachment(MSG_CAD, ATT_CAD, { data: JPEG_DATA, size: JPEG_BYTES.length });
  }
  const createApiCalls = overrides.createApiCalls ?? { count: 0 };
  const refreshCalls = { count: 0 };
  const connections = overrides.connections ?? (await connectedStore());
  const projects =
    overrides.projects ??
    new RecordingLookup(
      new Map([[ACHEDEKAL_PROJECT_ID, pointer(ALEA_KNOWN_THREAD_ID)]]),
    );

  const result = await executeAchedekalKnownArtifactPreview({
    founderSessionOk: overrides.founderSessionOk ?? true,
    requestedProjectId: overrides.requestedProjectId,
    requestedThreadId: overrides.requestedThreadId,
    requestedMessageId: overrides.requestedMessageId,
    requestedAttachmentId: overrides.requestedAttachmentId,
    requestedFilename: overrides.requestedFilename,
    requestedQuery: overrides.requestedQuery,
    projects,
    index,
    attachments,
    connections,
    decryptRefreshToken:
      overrides.decryptRefreshToken ?? ((wrapped) => decryptRefreshToken(wrapped, KEY)),
    refreshAccessToken:
      overrides.refresh ??
      (async () => {
        refreshCalls.count += 1;
        return { ok: true, accessToken: ACCESS };
      }),
    createApi: (token) => {
      createApiCalls.count += 1;
      assert.equal(token, ACCESS);
      return api;
    },
  });
  return { result, api, createApiCalls, refreshCalls, projects };
}

describe("Achedekal known-artifact preview security", () => {
  it("rejects an unauthenticated byte request before Gmail token use", async () => {
    const index = new RecordingIndex();
    await seedKnownIndex(index);
    const attachments = new RecordingAttachments();
    await seedKnownAttachments(attachments);
    const { result, api, createApiCalls, refreshCalls, projects } = await runPreview({
      founderSessionOk: false,
      index,
      attachments,
    });
    assert.deepEqual(result, failedAchedekalKnownArtifact("unauthorized"));
    assert.deepEqual(api.calls, []);
    assert.equal(createApiCalls.count, 0);
    assert.equal(refreshCalls.count, 0);
    assert.deepEqual((projects as RecordingLookup).requested, []);
    assert.equal(index.listCalls, 0);
    assert.equal(attachments.puts, 3);
  });

  it("rejects a non-founder caller before Gmail token use", async () => {
    const { result, api, createApiCalls, refreshCalls, projects } = await runPreview({
      founderSessionOk: false,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.safeErrorCode, "unauthorized");
    assert.deepEqual(api.calls, []);
    assert.equal(createApiCalls.count, 0);
    assert.equal(refreshCalls.count, 0);
    assert.deepEqual((projects as RecordingLookup).requested, []);
  });

  it("loads the exact known JPEG after founder-authenticated index validation", async () => {
    const { result, api } = await runPreview();
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.mimeType, ACHEDEKAL_KNOWN_ARTIFACT_MIME);
    assert.deepEqual(result.bytes, JPEG_BYTES);
    assert.equal(result.automaticApply, false);
    assert.deepEqual(api.calls, [
      { method: "getAttachment", messageId: MSG_CAD, attachmentId: ATT_CAD },
    ]);
  });

  it("ignores caller-supplied project, thread, message, attachment, filename, and query", async () => {
    const { result, api, projects } = await runPreview({
      requestedProjectId: OTHER_PROJECT_ID,
      requestedThreadId: OTHER_THREAD_ID,
      requestedMessageId: "msg-attacker",
      requestedAttachmentId: "att-attacker",
      requestedFilename: "image001.jpg",
      requestedQuery: "filename:secret.jpg",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual((projects as RecordingLookup).requested, [ACHEDEKAL_PROJECT_ID]);
    assert.deepEqual(api.calls, [
      { method: "getAttachment", messageId: MSG_CAD, attachmentId: ATT_CAD },
    ]);
    assert.equal(result.bytes.equals(JPEG_BYTES), true);
  });

  it("requires exactly one H017-CBR2000037.jpg and cannot target duplicate image001.jpg", async () => {
    const attachments = new InMemoryGmailAttachmentStore();
    await seedKnownAttachments(attachments);
    const indexed = await attachments.listByThread(ALEA_KNOWN_THREAD_ID);
    const selected = selectAchedekalKnownArtifact(
      ALEA_KNOWN_THREAD_ID,
      new Set(["msg-alea-known-1", MSG_CAD]),
      indexed,
    );
    assert.equal(selected?.filename, ACHEDEKAL_KNOWN_ARTIFACT_FILENAME);
    assert.equal(selected?.attachmentId, ATT_CAD);

    const onlyInline = new InMemoryGmailAttachmentStore();
    await onlyInline.putAttachment(
      attachment({
        attachmentId: "att-image001-a",
        messageId: "msg-alea-known-1",
        filename: "image001.jpg",
      }),
    );
    await onlyInline.putAttachment(
      attachment({
        attachmentId: "att-image001-b",
        messageId: MSG_CAD,
        filename: "image001.jpg",
      }),
    );
    const { result, api, createApiCalls } = await runPreview({
      attachments: onlyInline,
      index: await (async () => {
        const index = new InMemoryGmailIndexStore();
        await seedKnownIndex(index);
        return index;
      })(),
    });
    assert.deepEqual(result, failedAchedekalKnownArtifact("artifact-unavailable"));
    assert.deepEqual(api.calls, []);
    assert.equal(createApiCalls.count, 0);
  });

  it("fails closed for wrong MIME, wrong thread, missing attachment id, and oversize before Gmail", async () => {
    const cases: GmailAttachmentMeta[] = [
      attachment({
        attachmentId: ATT_CAD,
        messageId: MSG_CAD,
        mimeType: "application/pdf",
      }),
      attachment({
        attachmentId: ATT_CAD,
        messageId: MSG_CAD,
        threadId: OTHER_THREAD_ID,
      }),
      attachment({
        attachmentId: "   ",
        messageId: MSG_CAD,
      }),
      attachment({
        attachmentId: ATT_CAD,
        messageId: MSG_CAD,
        sizeBytes: ACHEDEKAL_KNOWN_ARTIFACT_BYTE_CAP + 1,
      }),
    ];
    for (const row of cases) {
      const attachments = new InMemoryGmailAttachmentStore();
      await attachments.putAttachment(
        attachment({
          attachmentId: "att-image001-a",
          messageId: "msg-alea-known-1",
          filename: "image001.jpg",
          sizeBytes: 2048,
        }),
      );
      await attachments.putAttachment(row);
      const index = new InMemoryGmailIndexStore();
      await seedKnownIndex(index);
      const { result, api, createApiCalls, refreshCalls } = await runPreview({ attachments, index });
      assert.equal(result.ok, false, JSON.stringify(row));
      assert.deepEqual(api.calls, []);
      assert.equal(createApiCalls.count, 0);
      assert.equal(refreshCalls.count, 0);
    }
  });

  it("fails closed when multiple exact filenames match", async () => {
    const attachments = new InMemoryGmailAttachmentStore();
    await seedKnownAttachments(attachments, [
      attachment({
        attachmentId: "att-h017-dup",
        messageId: "msg-alea-known-1",
      }),
    ]);
    const { result, api, createApiCalls } = await runPreview({ attachments });
    assert.deepEqual(result, failedAchedekalKnownArtifact("artifact-unavailable"));
    assert.deepEqual(api.calls, []);
    assert.equal(createApiCalls.count, 0);
  });

  it("returns a founder-safe failure when Gmail attachment bytes cannot be decoded", async () => {
    const api = new MockKnownArtifactGmailApi();
    api.setAttachment(MSG_CAD, ATT_CAD, { data: "", size: 0 });
    const { result } = await runPreview({ api });
    assert.deepEqual(result, failedAchedekalKnownArtifact("artifact-unavailable"));
    assert.deepEqual(api.calls, [
      { method: "getAttachment", messageId: MSG_CAD, attachmentId: ATT_CAD },
    ]);
    assert.equal(JSON.stringify(result).includes(ATT_CAD), false);
  });

  it("does not persist bytes, index writes, or connection writes", async () => {
    const index = new RecordingIndex();
    await seedKnownIndex(index);
    const attachments = new RecordingAttachments();
    await seedKnownAttachments(attachments);
    const connections = new RecordingConnections(await connectedStore());
    const indexCallsBefore = index.indexCalls;
    const putsBefore = attachments.puts;
    const { result, api } = await runPreview({ index, attachments, connections });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(index.indexCalls, indexCallsBefore);
    assert.equal(attachments.puts, putsBefore);
    assert.equal(connections.writes, 0);
    assert.deepEqual(
      api.calls.map((row) => row.attachmentId),
      [ATT_CAD],
    );
    const serialized = JSON.stringify({
      ok: result.ok,
      mimeType: result.mimeType,
      automaticApply: result.automaticApply,
      byteLength: result.bytes.length,
    });
    assert.equal(serialized.includes(ATT_CAD), false);
    assert.equal(serialized.includes(ALEA_KNOWN_THREAD_ID), false);
    assert.equal(serialized.includes("image001.jpg"), false);
  });

  it("fails closed when the exact JPEG is not on an indexed message in the stored thread", async () => {
    const index = new RecordingIndex();
    await index.indexMessage(
      {
        messageId: "msg-alea-known-1",
        threadId: ALEA_KNOWN_THREAD_ID,
        sentAt: "2026-08-06T15:12:00.000Z",
        subject: "RE: HGD - A. Achedekal-CBR2000037",
        fromEmail: "vendor@example.com",
        toEmails: ["founder@hourglass.example"],
        direction: "inbound",
        hasAttachments: true,
      },
      NOW,
    );
    const { result, api, createApiCalls, refreshCalls } = await runPreview({ index });
    assert.deepEqual(result, failedAchedekalKnownArtifact("artifact-unavailable"));
    assert.deepEqual(api.calls, []);
    assert.equal(createApiCalls.count, 0);
    assert.equal(refreshCalls.count, 0);
  });

  it("exposes only getAttachment on the known-artifact Gmail API", () => {
    const methods: (keyof KnownArtifactGmailApi)[] = ["getAttachment"];
    assert.deepEqual(methods, ["getAttachment"]);
    const live = createLiveKnownArtifactGmailApi.toString();
    assert.match(live, /attachments/);
    assert.doesNotMatch(live, /listMessages|getMessage\(|getThread\(/);
    assert.doesNotMatch(live, /[?&]q=/);
    assert.doesNotMatch(live, /users\.messages\.send|\/modify/);
  });

  it("keeps the private route founder-gated, click-only, and mutation-free", () => {
    const page = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/project-reconstruction/achedekal/page.tsx",
      ),
      "utf8",
    );
    const preview = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/components/achedekal-known-artifact.tsx",
      ),
      "utf8",
    );
    const route = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/project-reconstruction/achedekal/known-artifact/route.ts",
      ),
      "utf8",
    );
    const reviewForm = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/components/achedekal-review-form.tsx",
      ),
      "utf8",
    );
    const discoveryForm = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/components/achedekal-related-threads.tsx",
      ),
      "utf8",
    );
    const reviewActions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/achedekal-review-actions.ts"),
      "utf8",
    );
    const discoveryActions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/achedekal-discovery-actions.ts"),
      "utf8",
    );
    const execute = readFileSync(
      join(ROOT, "lib/continuum/gmail/achedekal-known-artifact.ts"),
      "utf8",
    );
    const gmail = readFileSync(
      join(ROOT, "lib/continuum/gmail/known-artifact-gmail.ts"),
      "utf8",
    );

    assert.match(page, /AchedekalKnownArtifactPreview/);
    assert.doesNotMatch(page, /fetch\(|getAttachment|createLiveKnownArtifactGmailApi/);
    assert.match(preview, /Preview known CAD artifact/);
    assert.match(preview, /TRANSIENT PREVIEW|Transient preview/);
    assert.match(preview, /NOT SAVED|Not saved/);
    assert.match(preview, /NO PROJECT CHANGES|No project changes/);
    assert.match(preview, /cache: "no-store"/);
    assert.match(preview, /createObjectURL/);
    assert.match(preview, /revokeObjectURL/);
    assert.match(preview, /onClick=\{\(\) => void loadKnownArtifact\(\)\}/);
    const effect = preview.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[previewUrl\]\);/);
    assert.ok(effect);
    assert.doesNotMatch(effect[0], /fetch\(|loadKnownArtifact/);
    assert.doesNotMatch(preview, /localStorage|indexedDB|prefetch/);
    assert.doesNotMatch(preview, /Apply|Approve CAD|Download all|Open Gmail|Fetch other/);
    assert.doesNotMatch(preview, /reviewAchedekalGmailEvidence|findAchedekalRelatedThreads/);
    assert.doesNotMatch(reviewForm, /Preview known CAD artifact|executeAchedekalKnownArtifactPreview/);
    assert.doesNotMatch(discoveryForm, /Preview known CAD artifact|executeAchedekalKnownArtifactPreview/);
    assert.doesNotMatch(reviewActions, /executeAchedekalKnownArtifactPreview|getAttachment/);
    assert.doesNotMatch(discoveryActions, /executeAchedekalKnownArtifactPreview|getAttachment/);

    assert.match(route, /getAuthenticatedGmailHistoryStores/);
    assert.match(route, /executeAchedekalKnownArtifactPreview/);
    assert.match(route, /ACHEDEKAL_PROJECT_ID/);
    assert.match(route, /Cache-Control": "private, no-store"/);
    assert.match(route, /X-Content-Type-Options": "nosniff"/);
    assert.match(route, /Content-Disposition": "inline"/);
    assert.match(route, /fetchCache = "force-no-store"/);
    assert.doesNotMatch(route, /Content-Disposition": "attachment/);
    assert.doesNotMatch(route, /searchParams\.get\(/);
    assert.doesNotMatch(route, /formData\.get\(/);
    assert.doesNotMatch(route, /listMessages|getMessage|getThread\(/);
    assert.doesNotMatch(route, /correctProjectSpec|insertProjectHistory|insertSourceNote/);
    assert.doesNotMatch(route, /createOpenJob|chief-of-staff|today-5/);

    assert.match(execute, /ACHEDEKAL_PROJECT_ID/);
    assert.match(execute, /selectAchedekalKnownArtifact/);
    assert.match(execute, /automaticApply: false/);
    assert.doesNotMatch(execute, /listMessages\(|getMessage\(|getThread\(/);
    assert.doesNotMatch(execute, /users\.messages\.send|modify|q:/);
    assert.doesNotMatch(execute, /correctProjectSpec|insertProjectHistory|writeFile|localStorage/);
    assert.doesNotMatch(execute, /console\.(log|info|debug|warn|error)/);
    assert.doesNotMatch(execute, /insertSourceNote|writeHumanIntake|createOpenJob|editPersonProfile/);
    assert.doesNotMatch(gmail, /listMessages\(|getMessage\(|getThread\(/);
    assert.doesNotMatch(gmail, /users\.messages\.send|[?&]q=/);
    assert.match(gmail, /getAttachment/);
    assert.equal(ACHEDEKAL_KNOWN_ARTIFACT_PATH.endsWith("/known-artifact"), true);
  });
});
