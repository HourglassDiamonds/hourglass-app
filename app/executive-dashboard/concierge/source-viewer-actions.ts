"use server";

import { parseGmailWebHref } from "@/lib/continuum/chief-of-staff/operating-loop/evidence";
import {
  founderSafeText,
  presentIndexedSourceViewer,
  presentSourceViewer,
  sourceViewerPreviewFromView,
  type CosEmailCardView,
  type CosSourceViewerRequest,
  type CosSourceViewerView,
} from "@/lib/continuum/chief-of-staff/operating-loop/email-viewer";
import {
  getContinuumGmailFounderEmail,
  getContinuumGmailInternalAddresses,
} from "@/lib/continuum/gmail/env";
import { getAuthenticatedGmailHistoryStores } from "@/lib/continuum/gmail/load";
import { executeLiveSourceViewerFetch } from "@/lib/continuum/gmail/source-viewer-run";
import type { SourceViewerErrorCode } from "@/lib/continuum/gmail/source-viewer";

export type SourceViewerActionFailure = {
  ok: false;
  safeErrorCode: SourceViewerErrorCode;
};

export type SourceViewerActionSuccess = {
  ok: true;
  safeErrorCode: null;
  view: CosSourceViewerView;
};

export type SourceViewerPreviewSuccess = {
  ok: true;
  safeErrorCode: null;
  preview: CosEmailCardView;
};

function internalEmails(): string[] {
  const founder = getContinuumGmailFounderEmail();
  return [...getContinuumGmailInternalAddresses(), ...(founder ? [founder] : [])];
}

function emptyRequest(): CosSourceViewerRequest {
  return {
    sources: [],
    personLabel: null,
    projectTitle: null,
    why: null,
    facts: [],
    beats: [],
  };
}

async function indexedSubjectPreview(href: string): Promise<CosEmailCardView | null> {
  const parsed = parseGmailWebHref(href);
  if (!parsed) return null;
  const stores = await getAuthenticatedGmailHistoryStores();
  if (!stores.ok) return null;
  try {
    const focused = parsed.messageId
      ? await stores.index.getMessage(parsed.messageId)
      : null;
    const listed = await stores.index.listMessagesByThread(parsed.threadId);
    listed.sort((left, right) => left.sentAt.localeCompare(right.sentAt));
    const row =
      focused && focused.threadId === parsed.threadId
        ? focused
        : listed[listed.length - 1] ?? null;
    const subject = founderSafeText(row?.subject ?? null);
    if (!subject) return null;
    return {
      senderDisplayName: null,
      senderEmail: null,
      subject,
      excerpt: null,
      hydrateHref: href,
    };
  } catch {
    return null;
  }
}

function viewerRequest(
  href: string,
  input: CosSourceViewerRequest | null | undefined,
): CosSourceViewerRequest {
  return {
    sources: input?.sources?.length ? input.sources : [{ href, label: "Source email" }],
    personLabel: founderSafeText(input?.personLabel) ?? null,
    projectTitle: founderSafeText(input?.projectTitle) ?? null,
    why: founderSafeText(input?.why) ?? null,
    facts: (input?.facts ?? [])
      .map((fact) => ({
        label: founderSafeText(fact.label) ?? "",
        value: founderSafeText(fact.value) ?? "",
      }))
      .filter((fact) => fact.label && fact.value),
    beats: input?.beats ?? [],
    provenanceLimited: input?.provenanceLimited === true,
    provenanceLabel: founderSafeText(input?.provenanceLabel) ?? null,
    relatedSources: (input?.relatedSources ?? [])
      .map((source) => ({
        href: source.href.trim(),
        label: founderSafeText(source.label) ?? "Related email",
      }))
      .filter((source) => source.href.length > 0),
  };
}

export async function loadSourceViewerAction(input: {
  href: string;
  request?: CosSourceViewerRequest | null;
}): Promise<SourceViewerActionSuccess | SourceViewerActionFailure> {
  const href = input.href.trim();
  const parsed = parseGmailWebHref(href);
  if (!parsed) return { ok: false, safeErrorCode: "blank-pointer" };
  const auth = await getAuthenticatedGmailHistoryStores();
  if (!auth.ok) {
    return {
      ok: false,
      safeErrorCode: auth.reason === "unauthorized" ? "unauthorized" : "unavailable",
    };
  }
  const request = viewerRequest(href, input.request);
  const fetched = await executeLiveSourceViewerFetch({
    founderSessionOk: true,
    threadId: parsed.threadId,
    messageId: parsed.messageId,
  });
  if (fetched.ok) {
    const view = presentSourceViewer({
      href,
      threadId: fetched.threadId,
      messages: fetched.messages,
      request,
      internalEmails: internalEmails(),
    });
    if (view) return { ok: true, safeErrorCode: null, view };
  } else if (fetched.safeErrorCode === "unauthorized") {
    return fetched;
  }
  const indexed = await indexedSubjectPreview(href);
  const degraded = presentIndexedSourceViewer({
    href,
    indexedSubject: indexed?.subject ?? null,
    request,
  });
  if (degraded) return { ok: true, safeErrorCode: null, view: degraded };
  return {
    ok: false,
    safeErrorCode: fetched.ok ? "thread-fetch-failed" : fetched.safeErrorCode,
  };
}

export async function loadSourceViewerPreviewAction(input: {
  href: string;
}): Promise<SourceViewerPreviewSuccess | SourceViewerActionFailure> {
  const href = input.href.trim();
  const parsed = parseGmailWebHref(href);
  if (!parsed) return { ok: false, safeErrorCode: "blank-pointer" };
  const auth = await getAuthenticatedGmailHistoryStores();
  if (!auth.ok) {
    return {
      ok: false,
      safeErrorCode: auth.reason === "unauthorized" ? "unauthorized" : "unavailable",
    };
  }
  const fetched = await executeLiveSourceViewerFetch({
    founderSessionOk: true,
    threadId: parsed.threadId,
    messageId: parsed.messageId,
  });
  if (fetched.ok) {
    const view = presentSourceViewer({
      href,
      threadId: fetched.threadId,
      messages: fetched.messages,
      request: emptyRequest(),
      internalEmails: internalEmails(),
    });
    if (view) {
      const preview = sourceViewerPreviewFromView(view, internalEmails());
      return {
        ok: true,
        safeErrorCode: null,
        preview: {
          senderDisplayName: preview.senderDisplayName,
          senderEmail: preview.senderEmail,
          subject: preview.subject ?? founderSafeText(fetched.indexedSubject),
          excerpt: preview.excerpt,
          hydrateHref: href,
        },
      };
    }
  }
  const indexed = await indexedSubjectPreview(href);
  if (indexed) {
    return { ok: true, safeErrorCode: null, preview: indexed };
  }
  return {
    ok: false,
    safeErrorCode: fetched.ok ? "thread-fetch-failed" : fetched.safeErrorCode,
  };
}
