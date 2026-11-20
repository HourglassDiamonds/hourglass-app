import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { SourceNote } from "@/lib/continuum/client-memory/types";
import { sterlingFounderDirectiveFromNote } from "./founder-directive";
import type { SterlingFounderDirectiveRecord } from "./types";

const JACKIE_NOTE_ID = "2483ad06-6858-4e1f-8545-2bc88f2b431a";
const SARAH_NOTE_ID = "4314cae8-a87c-4972-b675-978652a9cc69";
const NATALIE_NOTE_ID = "d1c0fc35-070e-41ee-b20f-7803a906e444";
const NATE_NOTE_ID = "ad0c86d8-e93f-4faa-9ab2-599371f75705";
const ZANE_NOTE_ID = "57d6edba-fa16-4a87-916a-9290ee0ad0e3";

export const AUTHORIZED_SUPERVISED_TRIAL_NOTE_IDS = [
  JACKIE_NOTE_ID,
  SARAH_NOTE_ID,
  NATALIE_NOTE_ID,
  NATE_NOTE_ID,
  ZANE_NOTE_ID,
] as const;

const STRUCTURED_DIRECTIVES = new Map<string, SterlingFounderDirectiveRecord>([
  [SARAH_NOTE_ID, {
    directiveId: "c4699b8c-a6b3-4826-83be-b6ab1934adf8",
    workUnitId: "project:18e9ef2b-5b22-453e-8be8-e54dab0d86b1",
    projectId: "18e9ef2b-5b22-453e-8be8-e54dab0d86b1",
    personId: "ec712796-90cf-48ce-bba9-bf943a934109",
    sourceRefs: [
      "gmail:thread:1a0881b53067a9e6",
      "gmail:thread:1a1c7b0f7f034115",
      "founder-confirmation:2026-11-20:sarah-c026143",
    ],
    recordedAt: "2026-11-20T17:17:29-05:00",
    recordedBy: "founder:justin-smith",
    lifecycleStage: "production",
    lifecycleEffectiveOn: "2026-11-20",
    operationalSubstage: "In production; shop timing check November 25–27",
    productionEstimate: { status: "pending", sourceRef: null, completionOn: null, quotedLeadTime: null },
    waitingOn: "vendor_shop",
    attentionPriority: "monitor",
    relationshipRole: "client",
    disposition: "active",
    obligationUpdates: [
      {
        obligationId: "sarah-final-cad-approval",
        description: "Sarah approved the final CAD; close the Mod11 review.",
        status: "fulfilled",
        responsibleParty: "client",
      },
      {
        obligationId: "shop-arrival-check-nov-25-27",
        description: "Justin checks with the shop November 25–27 whether the ring will arrive before December 5. December 5 is requested timing, not a confirmed ETA.",
        status: "open",
        responsibleParty: "founder",
      },
    ],
    reason: "Sarah C026143 / RN08577 is in production after her final-CAD approval. Keep only the dated shop timing check; do not treat December 5 as a confirmed ETA.",
  }],
  [NATE_NOTE_ID, {
    directiveId: "f5f259b4-58b2-41a3-bf28-44d8971b01b8",
    workUnitId: "project:41281e54-0639-4183-82d5-17028b313681",
    projectId: "41281e54-0639-4183-82d5-17028b313681",
    personId: "9084ec73-d81a-456a-8c6a-e74ba8771a6b",
    sourceRefs: [
      "gmail:thread:1a09120d797337d9",
      "gmail:thread:1a121c53e4587a98",
      "gmail:thread:1a1a6cc69999c55b",
      "founder-confirmation:2026-11-20:nate-c026176",
    ],
    recordedAt: "2026-11-20T17:17:29-05:00",
    recordedBy: "founder:justin-smith",
    lifecycleStage: "completed",
    lifecycleEffectiveOn: "2026-11-20",
    operationalSubstage: "Complete and delivered to Nate",
    attentionPriority: "no_attention",
    relationshipRole: "client",
    disposition: "completed",
    obligationUpdates: [
      {
        obligationId: "shop-finish-return-c026176",
        description: "The finished dagger pendant/necklace was returned for client delivery.",
        status: "fulfilled",
        responsibleParty: "vendor_shop",
      },
      {
        obligationId: "founder-ship-c026176-to-nate",
        description: "Justin shipped the finished dagger pendant/necklace to Nate.",
        status: "fulfilled",
        responsibleParty: "founder",
      },
      {
        obligationId: "client-receipt-c026176",
        description: "Nate received the finished piece.",
        status: "fulfilled",
        responsibleParty: "client",
      },
    ],
    reason: "C026176 / RN08419 is complete and delivered. Retire both watches and remove Nate from Waiting.",
  }],
  [ZANE_NOTE_ID, {
    directiveId: "4d83e554-3a01-44dd-b1c9-02bad89dbc0d",
    workUnitId: "project:12359010-1e95-4296-aa44-a7de7e70aa11",
    projectId: "12359010-1e95-4296-aa44-a7de7e70aa11",
    personId: "0a405703-0f30-4b1e-9a7a-4d0e001fb101",
    sourceRefs: [
      "gmail:thread:1a1212396a8ac111",
      "gmail:thread:1a1847d9ad49e7a4",
      "founder-confirmation:2026-11-20:zane-c026732",
    ],
    recordedAt: "2026-11-20T17:17:29-05:00",
    recordedBy: "founder:justin-smith",
    lifecycleStage: "completed",
    lifecycleEffectiveOn: "2026-11-20",
    operationalSubstage: "Complete and delivered to Zane",
    attentionPriority: "no_attention",
    relationshipRole: "client",
    disposition: "completed",
    resolvedJobIds: ["e8e8c50e-c010-4c09-b6dc-5926ecc98a8b"],
    obligationUpdates: [
      {
        obligationId: "shop-finish-return-c026732",
        description: "The shop finished and returned the wedding band.",
        status: "fulfilled",
        responsibleParty: "vendor_shop",
      },
      {
        obligationId: "founder-client-handoff-c026732",
        description: "Justin delivered the finished wedding band to Zane.",
        status: "fulfilled",
        responsibleParty: "founder",
      },
      {
        obligationId: "client-receipt-c026732",
        description: "Zane received the finished wedding band.",
        status: "fulfilled",
        responsibleParty: "client",
      },
    ],
    reason: "C026732 / SP13895 is complete and delivered to Zane. Retire the shop-return and client-handoff watches for this commission.",
  }],
]);

const PLAIN_NOTES: ReadonlyMap<string, { gmailThreadId: string; checksumMd5: string }> = new Map([
  [JACKIE_NOTE_ID, {
    gmailThreadId: "1a1474ed83440aa0",
    checksumMd5: "60541e7586677f5a834310423883720c",
  }],
  [NATALIE_NOTE_ID, {
    gmailThreadId: "1a1a324788df8460",
    checksumMd5: "78d84e53175e7f22cf22bdf689cac5e8",
  }],
] as const);

/** Exact reviewed directive payloads, exported for regression fixtures only. */
export const AUTHORIZED_SUPERVISED_TRIAL_STRUCTURED_DIRECTIVES =
  STRUCTURED_DIRECTIVES as ReadonlyMap<string, SterlingFounderDirectiveRecord>;

export type AuthorizedSupervisedTrialInputReadback = {
  noteId: string;
  kind: "structured_directive" | "kept_plain_note";
  personId: string | null;
  projectId: string | null;
  gmailThreadId: string | null;
  directiveId: string | null;
  checksumVerified: boolean;
};

function readableBase(note: SourceNote): boolean {
  return note.sourceSystem === "concierge-manual" && note.lifecycleStatus === "kept" &&
    note.deletedAt === null;
}

/** Exact trial authority check. It reads existing notes and performs no writes. */
export function matchAuthorizedSupervisedTrialInputReadback(
  notes: readonly SourceNote[],
): AuthorizedSupervisedTrialInputReadback[] | null {
  const byId = new Map(notes.map((note) => [note.id, note] as const));
  const matched: AuthorizedSupervisedTrialInputReadback[] = [];
  for (const noteId of AUTHORIZED_SUPERVISED_TRIAL_NOTE_IDS) {
    const note = byId.get(noteId);
    if (!note || !readableBase(note)) return null;
    const expectedDirective = STRUCTURED_DIRECTIVES.get(noteId);
    if (expectedDirective) {
      const directive = sterlingFounderDirectiveFromNote(note);
      if (!directive || !isDeepStrictEqual(directive, expectedDirective)) return null;
      matched.push({
        noteId,
        kind: "structured_directive",
        personId: note.personId,
        projectId: note.projectId,
        gmailThreadId: note.gmailThreadId,
        directiveId: directive.directiveId,
        checksumVerified: true,
      });
      continue;
    }
    const expectedPlain = PLAIN_NOTES.get(noteId);
    const checksum = createHash("md5").update(note.noteText, "utf8").digest("hex");
    if (!expectedPlain || note.personId !== null || note.projectId !== null ||
        note.gmailThreadId !== expectedPlain.gmailThreadId || checksum !== expectedPlain.checksumMd5) {
      return null;
    }
    matched.push({
      noteId,
      kind: "kept_plain_note",
      personId: null,
      projectId: null,
      gmailThreadId: note.gmailThreadId,
      directiveId: null,
      checksumVerified: true,
    });
  }
  return matched;
}
