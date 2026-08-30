/**
 * Generic Project artifact discovery tests.
 * Metadata only. Does not write production truth or call Gmail.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { InMemoryGmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import {
  GMAIL_SOURCE_SYSTEM,
  type GmailIndexedMessage,
} from "@/lib/continuum/client-memory/gmail/types";
import {
  ACHEDEKAL_KNOWN_ARTIFACT_FILENAME,
  ACHEDEKAL_KNOWN_ARTIFACT_MIME,
  ACHEDEKAL_PROJECT_ID,
} from "./achedekal-acceptance";
import {
  ALEA_VENDOR_FLOOD_COUNT,
  aleaVendorFloodCad,
  aleaVendorFloodThreadId,
} from "./alea-chedekal-fixture";
import {
  ALEA_KNOWN_ARTIFACT_FILENAME,
  ALEA_KNOWN_CAD,
  ALEA_KNOWN_THREAD_ID,
} from "./alea-known-thread-fixture";
import {
  ARTIFACT_HUNT_AMBIGUOUS_LIMIT,
  ARTIFACT_HUNT_EXACT_LIMIT,
  ARTIFACT_HUNT_UNASSIGNED_LIMIT,
  classifyArtifactMetadata,
  executeProjectArtifactHunt,
  failedArtifactHunt,
  sanitizeArtifactHuntFailure,
  type ArtifactHuntAttachments,
  type ArtifactHuntCatalog,
  type ArtifactHuntIndex,
  type ArtifactHuntProject,
} from "./artifact-hunt";
import { InMemoryGmailAttachmentStore } from "./attachments";
import type { ExistingProjectBook } from "./project-book-containment";
import type { GmailAttachmentMeta } from "./types";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const DIR = dirname(fileURLToPath(import.meta.url));
const PERSON_EMAIL = "client@example.com";
const PERSON_HASH = hashEmail(PERSON_EMAIL)!;
const VENDOR_EMAIL = "workshop@example.com";
const VENDOR_HASH = hashEmail(VENDOR_EMAIL)!;
const FOUNDER_EMAIL = "founder@hourglass.example";
const FOUNDER_HASH = hashEmail(FOUNDER_EMAIL)!;
const PERSON_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_A_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_B_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROJECT_A_CAD = "CAD-8821";
const PROJECT_B_CAD = "CAD-3308";
const PROJECT_A_THREAD = "19projectathread0001";
const PROJECT_B_THREAD = "19projectbthread0001";
const COLLISION_CAD = "CAD-9900";
const INDEXED_AT = "2026-08-30T00:00:00.000Z";

class RecordingAttachments extends InMemoryGmailAttachmentStore {
  puts = 0;
  filenameCalls = 0;
  threadIdCalls = 0;
  threadCalls = 0;

  async putAttachment(row: GmailAttachmentMeta) {
    this.puts += 1;
    return super.putAttachment(row);
  }

  async listByThread(threadId: string) {
    this.threadCalls += 1;
    return super.listByThread(threadId);
  }

  async listByThreadIds(threadIds: readonly string[]) {
    this.threadIdCalls += 1;
    return super.listByThreadIds(threadIds);
  }

  async listByFilenameTokens(tokens: readonly string[]) {
    this.filenameCalls += 1;
    return super.listByFilenameTokens(tokens);
  }
}

function book(input: {
  projectId: string;
  cadJobNumbers?: readonly string[];
  orderNumbers?: readonly string[];
  gmailThreadIds?: readonly string[];
  personId?: string;
  title?: string;
}): ExistingProjectBook {
  return {
    projectId: input.projectId,
    personId: input.personId ?? PERSON_ID,
    title: input.title ?? input.projectId,
    lifecycle: "historical_closed",
    items: [],
    cadJobNumbers: input.cadJobNumbers ?? [],
    orderNumbers: input.orderNumbers ?? [],
    gmailThreadIds: input.gmailThreadIds ?? [],
    artifactRefs: [],
    vendors: [],
    subjectTerms: [],
    dateRange: null,
  };
}

function projectOf(input: Partial<ArtifactHuntProject> & { projectId: string }): ArtifactHuntProject {
  return {
    title: input.title ?? "Project",
    gmailThreadId: input.gmailThreadId ?? null,
    cadJobNumber: input.cadJobNumber ?? null,
    orderNumber: input.orderNumber ?? null,
    fingerSize: input.fingerSize ?? null,
    metal: input.metal ?? null,
    centerStone: input.centerStone ?? null,
    personId: input.personId ?? PERSON_ID,
    personEmailHash: input.personEmailHash ?? PERSON_HASH,
    personEmailHashes: input.personEmailHashes ?? [PERSON_HASH],
    lifecycle: input.lifecycle ?? "historical_closed",
    ...input,
  };
}

function catalogOf(
  project: ArtifactHuntProject,
  books: readonly ExistingProjectBook[],
): ArtifactHuntCatalog {
  return {
    async getProject(projectId: string) {
      return project.projectId === projectId ? project : null;
    },
    async listProjectBooks() {
      return books;
    },
  };
}

function indexed(input: {
  messageId: string;
  threadId: string;
  sentAt?: string;
  subject?: string | null;
  fromHash?: string;
  toHash?: string;
  direction?: GmailIndexedMessage["direction"];
  hasAttachments?: boolean;
}): GmailIndexedMessage {
  return {
    messageId: input.messageId,
    threadId: input.threadId,
    sentAt: input.sentAt ?? "2026-08-07T11:04:00.000Z",
    indexedAt: INDEXED_AT,
    subject: input.subject ?? null,
    fromEmailHash: input.fromHash ?? PERSON_HASH,
    toEmailHashes: [input.toHash ?? FOUNDER_HASH],
    ccEmailHashes: [],
    bccEmailHashes: [],
    direction: input.direction ?? "inbound",
    labelIds: [],
    hasAttachments: input.hasAttachments ?? true,
    sourceSystem: GMAIL_SOURCE_SYSTEM,
  };
}

function attachment(input: {
  messageId: string;
  attachmentId: string;
  threadId: string;
  filename: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
}): GmailAttachmentMeta {
  return {
    messageId: input.messageId,
    attachmentId: input.attachmentId,
    threadId: input.threadId,
    filename: input.filename,
    mimeType: input.mimeType ?? "image/jpeg",
    sizeBytes: input.sizeBytes ?? 2048,
    indexedAt: INDEXED_AT,
  };
}

async function seedIndex(
  index: InMemoryGmailIndexStore,
  rows: readonly GmailIndexedMessage[],
): Promise<void> {
  for (const row of rows) {
    await index.indexMessage(
      {
        messageId: row.messageId,
        threadId: row.threadId,
        sentAt: row.sentAt,
        subject: row.subject,
        direction: row.direction,
        labelIds: row.labelIds,
        hasAttachments: row.hasAttachments,
        fromEmail:
          row.fromEmailHash === PERSON_HASH
            ? PERSON_EMAIL
            : row.fromEmailHash === VENDOR_HASH
              ? VENDOR_EMAIL
              : FOUNDER_EMAIL,
        toEmails: [FOUNDER_EMAIL],
      },
      row.indexedAt,
    );
  }
}

async function seedAttachments(
  store: InMemoryGmailAttachmentStore,
  rows: readonly GmailAttachmentMeta[],
): Promise<void> {
  for (const row of rows) await store.putAttachment(row);
}

async function hunt(input: {
  project: ArtifactHuntProject;
  books: readonly ExistingProjectBook[];
  messages: readonly GmailIndexedMessage[];
  attachments: readonly GmailAttachmentMeta[];
  founderSessionOk?: boolean;
  requestedProjectId?: string | null;
  attachmentStore?: RecordingAttachments;
}): Promise<{
  state: Awaited<ReturnType<typeof executeProjectArtifactHunt>>;
  attachments: RecordingAttachments;
}> {
  const index = new InMemoryGmailIndexStore();
  await seedIndex(index, input.messages);
  const attachments = input.attachmentStore ?? new RecordingAttachments();
  await seedAttachments(attachments, input.attachments);
  attachments.puts = 0;
  const state = await executeProjectArtifactHunt({
    founderSessionOk: input.founderSessionOk ?? true,
    projectId: input.project.projectId,
    requestedProjectId: input.requestedProjectId,
    catalog: catalogOf(input.project, input.books),
    index: index as ArtifactHuntIndex,
    attachments: attachments as ArtifactHuntAttachments,
    internalEmailHashes: [FOUNDER_HASH],
  });
  return { state, attachments };
}

function aleaProject(): ArtifactHuntProject {
  return projectOf({
    projectId: ACHEDEKAL_PROJECT_ID,
    title: "A. Achedekal",
    gmailThreadId: ALEA_KNOWN_THREAD_ID,
    cadJobNumber: ALEA_KNOWN_CAD,
    lifecycle: "historical_closed",
  });
}

function aleaBooks(): ExistingProjectBook[] {
  return [
    book({
      projectId: ACHEDEKAL_PROJECT_ID,
      cadJobNumbers: [ALEA_KNOWN_CAD],
      gmailThreadIds: [ALEA_KNOWN_THREAD_ID],
      title: "A. Achedekal",
    }),
  ];
}

function aleaKnownRows(): {
  messages: GmailIndexedMessage[];
  attachments: GmailAttachmentMeta[];
} {
  return {
    messages: [
      indexed({
        messageId: "msg-alea-known-2",
        threadId: ALEA_KNOWN_THREAD_ID,
        subject: "RE: HGD - A. Achedekal-CBR2000037",
        fromHash: VENDOR_HASH,
      }),
    ],
    attachments: [
      attachment({
        messageId: "msg-alea-known-2",
        attachmentId: "att-h017-cbr",
        threadId: ALEA_KNOWN_THREAD_ID,
        filename: ALEA_KNOWN_ARTIFACT_FILENAME,
        mimeType: ACHEDEKAL_KNOWN_ARTIFACT_MIME,
        sizeBytes: 1_540_698,
      }),
      attachment({
        messageId: "msg-alea-known-2",
        attachmentId: "att-image001-b",
        threadId: ALEA_KNOWN_THREAD_ID,
        filename: "image001.jpg",
      }),
    ],
  };
}

describe("artifact hunt classification", () => {
  it("classifies strong CAD filenames with image MIME as metadata CAD/render", () => {
    const row = classifyArtifactMetadata({
      filename: "H017-CBR2000037.jpg",
      mimeType: "image/jpeg",
      strongFilenameIdentifiers: ["CBR2000037"],
    });
    assert.equal(row.class, "cad_render");
    assert.equal(row.basis, "metadata-derived");
    assert.equal(row.visual, false);
    assert.equal(row.ocr, false);
    assert.equal(row.contentInspected, false);
  });

  it("accepts unknown for generic camera filenames even when JPEG", () => {
    const row = classifyArtifactMetadata({
      filename: "image001.jpg",
      mimeType: "image/jpeg",
      strongFilenameIdentifiers: [],
    });
    assert.equal(row.class, "unknown");
    assert.equal(row.visual, false);
  });

  it("classifies defensible GIA PDF filenames as certificate candidates", () => {
    const row = classifyArtifactMetadata({
      filename: "GIA-1234567890.pdf",
      mimeType: "application/pdf",
      strongFilenameIdentifiers: [],
    });
    assert.equal(row.class, "diamond_certificate");
    assert.equal(row.basis, "metadata-derived");
  });
});

describe("artifact hunt discovery", () => {
  it("attributes the Alea known JPEG as an exact Project CAD/render candidate", async () => {
    const rows = aleaKnownRows();
    const { state } = await hunt({
      project: aleaProject(),
      books: aleaBooks(),
      messages: rows.messages,
      attachments: rows.attachments,
    });
    assert.equal(state.ok, true);
    if (!state.ok) return;
    const target = state.likely.find(
      (row) => row.filename === ACHEDEKAL_KNOWN_ARTIFACT_FILENAME,
    );
    assert.ok(target);
    assert.equal(target.attribution, "exact_project");
    assert.equal(target.classification.class, "cad_render");
    assert.equal(target.classification.basis, "metadata-derived");
    assert.equal(target.automaticAttach, false);
    assert.equal(target.canonical, false);
    assert.equal(target.opened, false);
    assert.equal(target.bytesFetched, false);
    assert.equal(target.attachedProjectId, null);
    const generic = state.likely.find((row) => row.filename === "image001.jpg");
    assert.ok(generic);
    assert.equal(generic.attribution, "exact_project");
    assert.equal(generic.classification.class, "unknown");
    assert.notEqual(generic.classification.class, "cad_render");
  });

  it("attributes attachments on the exact stored thread without interpreting content", async () => {
    const { state } = await hunt({
      project: projectOf({
        projectId: PROJECT_A_ID,
        gmailThreadId: PROJECT_A_THREAD,
        cadJobNumber: PROJECT_A_CAD,
      }),
      books: [
        book({
          projectId: PROJECT_A_ID,
          cadJobNumbers: [PROJECT_A_CAD],
          gmailThreadIds: [PROJECT_A_THREAD],
        }),
      ],
      messages: [
        indexed({
          messageId: "msg-thread",
          threadId: PROJECT_A_THREAD,
          subject: "Files",
        }),
      ],
      attachments: [
        attachment({
          messageId: "msg-thread",
          attachmentId: "att-1",
          threadId: PROJECT_A_THREAD,
          filename: "notes.pdf",
          mimeType: "application/pdf",
        }),
      ],
    });
    assert.equal(state.ok, true);
    if (!state.ok) return;
    assert.equal(state.likely.length, 1);
    assert.equal(state.likely[0]?.attribution, "exact_project");
    assert.equal(state.likely[0]?.classification.class, "generic_document");
    assert.ok(
      state.likely[0]?.evidenceReasons.some(
        (reason) => reason.kind === "exact_gmail_thread_anchor",
      ),
    );
  });

  it("attributes a strong CAD filename to the owning Project", async () => {
    const { state } = await hunt({
      project: projectOf({
        projectId: PROJECT_A_ID,
        cadJobNumber: PROJECT_A_CAD,
      }),
      books: [book({ projectId: PROJECT_A_ID, cadJobNumbers: [PROJECT_A_CAD] })],
      messages: [
        indexed({
          messageId: "msg-cad-file",
          threadId: "19cadfilename00001",
          subject: "Renders",
        }),
      ],
      attachments: [
        attachment({
          messageId: "msg-cad-file",
          attachmentId: "att-cad",
          threadId: "19cadfilename00001",
          filename: `${PROJECT_A_CAD}-render.jpg`,
        }),
      ],
    });
    assert.equal(state.ok, true);
    if (!state.ok) return;
    assert.equal(state.likely.length, 1);
    assert.equal(state.likely[0]?.attribution, "exact_project");
    assert.equal(state.likely[0]?.classification.class, "cad_render");
    assert.ok(
      state.likely[0]?.evidenceReasons.some(
        (reason) => reason.kind === "bounded_filename_identifier",
      ),
    );
  });

  it("attributes a strong CAD subject on the attachment's message", async () => {
    const { state } = await hunt({
      project: projectOf({
        projectId: PROJECT_A_ID,
        cadJobNumber: PROJECT_A_CAD,
      }),
      books: [book({ projectId: PROJECT_A_ID, cadJobNumbers: [PROJECT_A_CAD] })],
      messages: [
        indexed({
          messageId: "msg-subject-cad",
          threadId: "19subjectcad000001",
          subject: `${PROJECT_A_CAD} presentation`,
        }),
      ],
      attachments: [
        attachment({
          messageId: "msg-subject-cad",
          attachmentId: "att-photo",
          threadId: "19subjectcad000001",
          filename: "photo.jpg",
        }),
      ],
    });
    assert.equal(state.ok, true);
    if (!state.ok) return;
    assert.equal(state.likely.length, 1);
    assert.equal(state.likely[0]?.attribution, "exact_project");
    assert.ok(
      state.likely[0]?.evidenceReasons.some(
        (reason) => reason.kind === "bounded_subject_identifier",
      ),
    );
  });

  it("does not attach from a weak numeric identifier alone", async () => {
    const { state } = await hunt({
      project: projectOf({
        projectId: PROJECT_A_ID,
        orderNumber: "555",
        cadJobNumber: PROJECT_A_CAD,
      }),
      books: [
        book({
          projectId: PROJECT_A_ID,
          cadJobNumbers: [PROJECT_A_CAD],
          orderNumbers: ["555"],
        }),
      ],
      messages: [
        indexed({
          messageId: "msg-weak",
          threadId: "19weaknumeric00001",
          subject: "Invoice 555",
        }),
      ],
      attachments: [
        attachment({
          messageId: "msg-weak",
          attachmentId: "att-weak",
          threadId: "19weaknumeric00001",
          filename: "555-invoice.pdf",
          mimeType: "application/pdf",
        }),
      ],
    });
    assert.equal(state.ok, true);
    if (!state.ok) return;
    assert.equal(
      state.likely.some((row) => row.filename === "555-invoice.pdf"),
      false,
    );
  });

  it("keeps weak short structured identifiers restricted", async () => {
    const { state } = await hunt({
      project: projectOf({
        projectId: PROJECT_A_ID,
        cadJobNumber: "CAD-1",
      }),
      books: [book({ projectId: PROJECT_A_ID, cadJobNumbers: ["CAD-1"] })],
      messages: [
        indexed({
          messageId: "msg-short",
          threadId: "19weakshort0000001",
          subject: "CAD-1 files",
        }),
      ],
      attachments: [
        attachment({
          messageId: "msg-short",
          attachmentId: "att-short",
          threadId: "19weakshort0000001",
          filename: "CAD-1-render.jpg",
        }),
      ],
    });
    assert.equal(state.ok, true);
    if (!state.ok) return;
    assert.equal(state.likely.length, 0);
  });

  it("requires bounded exact identifier matches and rejects superstrings", async () => {
    const { state } = await hunt({
      project: projectOf({
        projectId: PROJECT_A_ID,
        cadJobNumber: ALEA_KNOWN_CAD,
      }),
      books: [book({ projectId: PROJECT_A_ID, cadJobNumbers: [ALEA_KNOWN_CAD] })],
      messages: [
        indexed({
          messageId: "msg-super",
          threadId: "19superstring00001",
          subject: "Other file",
        }),
      ],
      attachments: [
        attachment({
          messageId: "msg-super",
          attachmentId: "att-super",
          threadId: "19superstring00001",
          filename: "CBR20000370.jpg",
        }),
      ],
    });
    assert.equal(state.ok, true);
    if (!state.ok) return;
    assert.equal(
      state.likely.some((row) => row.filename === "CBR20000370.jpg"),
      false,
    );
  });

  it("marks duplicate Project identifier ownership as ambiguous", async () => {
    const { state } = await hunt({
      project: projectOf({
        projectId: PROJECT_A_ID,
        cadJobNumber: COLLISION_CAD,
      }),
      books: [
        book({ projectId: PROJECT_A_ID, cadJobNumbers: [COLLISION_CAD] }),
        book({ projectId: PROJECT_B_ID, cadJobNumbers: [COLLISION_CAD] }),
      ],
      messages: [
        indexed({
          messageId: "msg-collision",
          threadId: "19collisioncad0001",
          subject: `${COLLISION_CAD} file`,
        }),
      ],
      attachments: [
        attachment({
          messageId: "msg-collision",
          attachmentId: "att-collision",
          threadId: "19collisioncad0001",
          filename: `${COLLISION_CAD}-render.jpg`,
        }),
      ],
    });
    assert.equal(state.ok, true);
    if (!state.ok) return;
    assert.equal(state.likely.length, 0);
    assert.equal(state.ambiguous.length, 1);
    assert.equal(state.ambiguous[0]?.attribution, "ambiguous_between_projects");
    assert.equal(state.ambiguous[0]?.attachedProjectId, null);
    assert.equal(state.ambiguous[0]?.requiresFounderReview, true);
  });

  it("still detects identifier collision beyond a 64-project catalog position", async () => {
    const farId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const books = [
      book({ projectId: PROJECT_A_ID, cadJobNumbers: [COLLISION_CAD] }),
      ...Array.from({ length: 70 }, (_, index) =>
        book({
          projectId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
          cadJobNumbers: [`CAD-${8000 + index}`],
        }),
      ),
      book({ projectId: farId, cadJobNumbers: [COLLISION_CAD] }),
    ];
    const { state } = await hunt({
      project: projectOf({
        projectId: PROJECT_A_ID,
        cadJobNumber: COLLISION_CAD,
      }),
      books,
      messages: [
        indexed({
          messageId: "msg-far",
          threadId: "19collisionbeyond64",
          subject: COLLISION_CAD,
        }),
      ],
      attachments: [
        attachment({
          messageId: "msg-far",
          attachmentId: "att-far",
          threadId: "19collisionbeyond64",
          filename: `${COLLISION_CAD}.jpg`,
        }),
      ],
    });
    assert.equal(state.ok, true);
    if (!state.ok) return;
    assert.equal(state.ambiguous.length, 1);
    assert.ok(state.ambiguous[0]?.spanningProjectIds.includes(farId));
  });

  it("does not cross-attach same Person / different Project artifacts", async () => {
    const { state } = await hunt({
      project: projectOf({
        projectId: PROJECT_A_ID,
        cadJobNumber: PROJECT_A_CAD,
        gmailThreadId: PROJECT_A_THREAD,
      }),
      books: [
        book({
          projectId: PROJECT_A_ID,
          cadJobNumbers: [PROJECT_A_CAD],
          gmailThreadIds: [PROJECT_A_THREAD],
        }),
        book({
          projectId: PROJECT_B_ID,
          cadJobNumbers: [PROJECT_B_CAD],
          gmailThreadIds: [PROJECT_B_THREAD],
        }),
      ],
      messages: [
        indexed({
          messageId: "msg-a",
          threadId: PROJECT_A_THREAD,
          subject: PROJECT_A_CAD,
        }),
        indexed({
          messageId: "msg-b",
          threadId: PROJECT_B_THREAD,
          subject: `${PROJECT_B_CAD} render`,
        }),
      ],
      attachments: [
        attachment({
          messageId: "msg-b",
          attachmentId: "att-b",
          threadId: PROJECT_B_THREAD,
          filename: `${PROJECT_B_CAD}-render.jpg`,
        }),
      ],
    });
    assert.equal(state.ok, true);
    if (!state.ok) return;
    assert.equal(
      state.likely.some((row) => row.filename === `${PROJECT_B_CAD}-render.jpg`),
      false,
    );
    assert.equal(
      state.unassigned.some((row) => row.filename === `${PROJECT_B_CAD}-render.jpg`),
      false,
    );
  });

  it("keeps Person-only artifacts unassigned", async () => {
    const { state } = await hunt({
      project: projectOf({
        projectId: PROJECT_A_ID,
        cadJobNumber: PROJECT_A_CAD,
        gmailThreadId: PROJECT_A_THREAD,
      }),
      books: [
        book({
          projectId: PROJECT_A_ID,
          cadJobNumbers: [PROJECT_A_CAD],
          gmailThreadIds: [PROJECT_A_THREAD],
        }),
      ],
      messages: [
        indexed({
          messageId: "msg-hello",
          threadId: "19persononlyhello01",
          subject: "Hello",
        }),
      ],
      attachments: [
        attachment({
          messageId: "msg-hello",
          attachmentId: "att-hello",
          threadId: "19persononlyhello01",
          filename: "hello.jpg",
        }),
      ],
    });
    assert.equal(state.ok, true);
    if (!state.ok) return;
    assert.equal(state.likely.length, 0);
    assert.equal(state.unassigned.length, 1);
    assert.equal(state.unassigned[0]?.attribution, "person_related_unassigned");
    assert.equal(state.unassigned[0]?.attachedProjectId, null);
  });

  it("excludes a vendor 50-job flood from the target candidate list", async () => {
    const vendorMessages: GmailIndexedMessage[] = [];
    const vendorAttachments: GmailAttachmentMeta[] = [];
    for (let index = 1; index <= ALEA_VENDOR_FLOOD_COUNT; index += 1) {
      const threadId = aleaVendorFloodThreadId(index);
      const cad = aleaVendorFloodCad(index);
      vendorMessages.push(
        indexed({
          messageId: `idx-vendor-flood-${index}`,
          threadId,
          subject: `Client ${index} ${cad}`,
          fromHash: VENDOR_HASH,
        }),
      );
      vendorAttachments.push(
        attachment({
          messageId: `idx-vendor-flood-${index}`,
          attachmentId: `att-vendor-${index}`,
          threadId,
          filename: `${cad}.jpg`,
        }),
      );
    }
    const rows = aleaKnownRows();
    const { state } = await hunt({
      project: aleaProject(),
      books: aleaBooks(),
      messages: [...rows.messages, ...vendorMessages],
      attachments: [...rows.attachments, ...vendorAttachments],
    });
    assert.equal(state.ok, true);
    if (!state.ok) return;
    assert.equal(
      state.likely.some((row) => (row.filename ?? "").startsWith("CAD-91")),
      false,
    );
    assert.equal(
      state.unassigned.some((row) => (row.filename ?? "").startsWith("CAD-91")),
      false,
    );
    assert.ok(
      state.likely.some((row) => row.filename === ACHEDEKAL_KNOWN_ARTIFACT_FILENAME),
    );
  });

  it("keeps duplicate filenames across messages as separate provenance", async () => {
    const { state } = await hunt({
      project: projectOf({
        projectId: PROJECT_A_ID,
        gmailThreadId: PROJECT_A_THREAD,
        cadJobNumber: PROJECT_A_CAD,
      }),
      books: [
        book({
          projectId: PROJECT_A_ID,
          cadJobNumbers: [PROJECT_A_CAD],
          gmailThreadIds: [PROJECT_A_THREAD],
        }),
      ],
      messages: [
        indexed({
          messageId: "msg-dup-1",
          threadId: PROJECT_A_THREAD,
          subject: "One",
          sentAt: "2026-01-01T00:00:00.000Z",
        }),
        indexed({
          messageId: "msg-dup-2",
          threadId: PROJECT_A_THREAD,
          subject: "Two",
          sentAt: "2026-01-02T00:00:00.000Z",
        }),
      ],
      attachments: [
        attachment({
          messageId: "msg-dup-1",
          attachmentId: "att-dup-1",
          threadId: PROJECT_A_THREAD,
          filename: "image001.jpg",
        }),
        attachment({
          messageId: "msg-dup-2",
          attachmentId: "att-dup-2",
          threadId: PROJECT_A_THREAD,
          filename: "image001.jpg",
        }),
      ],
    });
    assert.equal(state.ok, true);
    if (!state.ok) return;
    const dups = state.likely.filter((row) => row.filename === "image001.jpg");
    assert.equal(dups.length, 2);
    assert.equal(new Set(dups.map((row) => row.candidateId)).size, 2);
    assert.ok(
      state.duplicateGroups.some(
        (group) => group.filename === "image001.jpg" && group.candidateIds.length === 2,
      ),
    );
  });

  it("dedupes the exact source attachment identity", async () => {
    const row = attachment({
      messageId: "msg-once",
      attachmentId: "att-once",
      threadId: PROJECT_A_THREAD,
      filename: `${PROJECT_A_CAD}.jpg`,
    });
    const { state } = await hunt({
      project: projectOf({
        projectId: PROJECT_A_ID,
        gmailThreadId: PROJECT_A_THREAD,
        cadJobNumber: PROJECT_A_CAD,
      }),
      books: [
        book({
          projectId: PROJECT_A_ID,
          cadJobNumbers: [PROJECT_A_CAD],
          gmailThreadIds: [PROJECT_A_THREAD],
        }),
      ],
      messages: [
        indexed({
          messageId: "msg-once",
          threadId: PROJECT_A_THREAD,
          subject: PROJECT_A_CAD,
        }),
      ],
      attachments: [row, { ...row }],
    });
    assert.equal(state.ok, true);
    if (!state.ok) return;
    assert.equal(state.likely.filter((item) => item.filename === `${PROJECT_A_CAD}.jpg`).length, 1);
  });

  it("does not silently collapse revision filenames", async () => {
    const { state } = await hunt({
      project: projectOf({
        projectId: PROJECT_A_ID,
        cadJobNumber: PROJECT_A_CAD,
      }),
      books: [book({ projectId: PROJECT_A_ID, cadJobNumbers: [PROJECT_A_CAD] })],
      messages: [
        indexed({
          messageId: "msg-rev-1",
          threadId: "19revisionone00001",
          subject: PROJECT_A_CAD,
          sentAt: "2026-01-01T00:00:00.000Z",
        }),
        indexed({
          messageId: "msg-rev-2",
          threadId: "19revisiontwo00001",
          subject: PROJECT_A_CAD,
          sentAt: "2026-01-02T00:00:00.000Z",
        }),
      ],
      attachments: [
        attachment({
          messageId: "msg-rev-1",
          attachmentId: "att-rev-1",
          threadId: "19revisionone00001",
          filename: `${PROJECT_A_CAD}.jpg`,
        }),
        attachment({
          messageId: "msg-rev-2",
          attachmentId: "att-rev-2",
          threadId: "19revisiontwo00001",
          filename: `${PROJECT_A_CAD}-v2.jpg`,
        }),
      ],
    });
    assert.equal(state.ok, true);
    if (!state.ok) return;
    assert.equal(state.likely.length, 2);
    const revision = state.likely.find((row) => row.filename === `${PROJECT_A_CAD}-v2.jpg`);
    assert.equal(revision?.revisionHint, true);
  });

  it("keeps historical Projects unchanged and writes nothing canonical", async () => {
    const store = new RecordingAttachments();
    const { state, attachments } = await hunt({
      project: aleaProject(),
      books: aleaBooks(),
      messages: aleaKnownRows().messages,
      attachments: aleaKnownRows().attachments,
      attachmentStore: store,
    });
    assert.equal(state.ok, true);
    if (!state.ok) return;
    assert.equal(state.lifecycle, "historical_closed");
    assert.equal(state.historicalSafety.remainsHistorical, true);
    assert.equal(state.historicalSafety.createsOpenJobs, false);
    assert.equal(state.historicalSafety.createsToday5, false);
    assert.equal(state.historicalSafety.writesChiefOfStaff, false);
    assert.equal(state.historicalSafety.becomesActive, false);
    assert.equal(state.automaticAttach, false);
    assert.equal(state.canonical, false);
    assert.equal(state.fetchesGmail, false);
    assert.equal(state.fetchesAttachmentBytes, false);
    assert.equal(state.refreshesGmailToken, false);
    assert.equal(attachments.puts, 0);
    assert.equal(state.queryShape.fullTableScan, false);
  });

  it("applies independent result budgets per bucket", async () => {
    const messages: GmailIndexedMessage[] = [];
    const files: GmailAttachmentMeta[] = [];
    for (let index = 1; index <= 25; index += 1) {
      messages.push(
        indexed({
          messageId: `msg-exact-${index}`,
          threadId: PROJECT_A_THREAD,
          subject: PROJECT_A_CAD,
          sentAt: `2026-01-${String(index).padStart(2, "0")}T00:00:00.000Z`,
        }),
      );
      files.push(
        attachment({
          messageId: `msg-exact-${index}`,
          attachmentId: `att-exact-${index}`,
          threadId: PROJECT_A_THREAD,
          filename: `${PROJECT_A_CAD}-${index}.jpg`,
        }),
      );
    }
    for (let index = 1; index <= 15; index += 1) {
      messages.push(
        indexed({
          messageId: `msg-amb-${index}`,
          threadId: `19amb${String(index).padStart(10, "0")}`,
          subject: COLLISION_CAD,
        }),
      );
      files.push(
        attachment({
          messageId: `msg-amb-${index}`,
          attachmentId: `att-amb-${index}`,
          threadId: `19amb${String(index).padStart(10, "0")}`,
          filename: `${COLLISION_CAD}-${index}.jpg`,
        }),
      );
    }
    for (let index = 1; index <= 15; index += 1) {
      messages.push(
        indexed({
          messageId: `msg-un-${index}`,
          threadId: `19un${String(index).padStart(12, "0")}`,
          subject: "Hello",
        }),
      );
      files.push(
        attachment({
          messageId: `msg-un-${index}`,
          attachmentId: `att-un-${index}`,
          threadId: `19un${String(index).padStart(12, "0")}`,
          filename: `hello-${index}.jpg`,
        }),
      );
    }
    const { state } = await hunt({
      project: projectOf({
        projectId: PROJECT_A_ID,
        cadJobNumber: PROJECT_A_CAD,
        gmailThreadId: PROJECT_A_THREAD,
      }),
      books: [
        book({
          projectId: PROJECT_A_ID,
          cadJobNumbers: [PROJECT_A_CAD, COLLISION_CAD],
          gmailThreadIds: [PROJECT_A_THREAD],
        }),
        book({
          projectId: PROJECT_B_ID,
          cadJobNumbers: [COLLISION_CAD],
        }),
      ],
      messages,
      attachments: files,
    });
    assert.equal(state.ok, true);
    if (!state.ok) return;
    assert.equal(state.likely.length, ARTIFACT_HUNT_EXACT_LIMIT);
    assert.equal(state.ambiguous.length, ARTIFACT_HUNT_AMBIGUOUS_LIMIT);
    assert.equal(state.unassigned.length, ARTIFACT_HUNT_UNASSIGNED_LIMIT);
    assert.equal(state.resultsLimited, true);
    assert.equal(state.likely.every((row) => row.attribution === "exact_project"), true);
    assert.equal(
      state.ambiguous.every((row) => row.attribution === "ambiguous_between_projects"),
      true,
    );
  });

  it("rejects unauthorized sessions and sanitizes unknown failures", async () => {
    const { state } = await hunt({
      project: aleaProject(),
      books: aleaBooks(),
      messages: [],
      attachments: [],
      founderSessionOk: false,
    });
    assert.deepEqual(state, failedArtifactHunt("unauthorized"));
    assert.deepEqual(
      sanitizeArtifactHuntFailure({ ok: false, safeErrorCode: "nope" as never }),
      failedArtifactHunt("index-unavailable"),
    );
  });
});

describe("artifact hunt boundaries", () => {
  it("does not fetch Gmail bodies, bytes, or refresh tokens", () => {
    const engine = readFileSync(join(DIR, "artifact-hunt.ts"), "utf8");
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/artifact-hunt-actions.ts"),
      "utf8",
    );
    const ui = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/components/artifact-hunt.tsx"),
      "utf8",
    );
    for (const source of [engine, actions, ui]) {
      assert.doesNotMatch(source, /getAttachment|getThread\(|getMessage\(/);
      assert.doesNotMatch(source, /listMessages\(|users\.messages|users\.threads/);
      assert.doesNotMatch(source, /gmail\.googleapis|refreshAccessToken/);
      assert.doesNotMatch(source, /correctProjectSpec|applyProjectSpecCorrection/);
      assert.doesNotMatch(source, /editPersonProfile|createPersonAtomic/);
      assert.doesNotMatch(source, /insertObservation|continuum_observations/);
      assert.doesNotMatch(source, /createsOpenJobs:\s*true|writesChiefOfStaff:\s*true/);
    }
    assert.doesNotMatch(engine, /H017-CBR2000037|ACHEDEKAL_PROJECT_ID|df78419e/);
    assert.match(engine, /automaticAttach: false/);
    assert.match(engine, /canonical: false/);
    assert.match(actions, /listProjects\(\)/);
    assert.doesNotMatch(actions, /listProjects\(\{\s*limit:\s*64\s*\}\)/);
    assert.doesNotMatch(actions, /formData\.get\(/);
    assert.doesNotMatch(ui, />Open</);
    assert.doesNotMatch(ui, />Preview</);
    assert.doesNotMatch(ui, />Download</);
    assert.doesNotMatch(ui, />Attach</);
    assert.doesNotMatch(ui, />Apply</);
    assert.doesNotMatch(ui, />Save</);
    assert.doesNotMatch(ui, />Move</);
    assert.match(ui, /Not opened · Metadata only/);
    assert.match(ui, /Likely Project artifacts/);
  });
});
