"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  OPEN_IN_GMAIL_LABEL,
  RELATED_EMAIL_LABEL,
  VIEW_EMAIL_LABEL,
  presentEvidenceOnlySourceViewer,
  type CosSourceViewerRequest,
  type CosSourceViewerView,
} from "@/lib/continuum/chief-of-staff/operating-loop/email-viewer";
import type { CosOpenEmailSource } from "@/lib/continuum/chief-of-staff/operating-loop/email-source";

function viewerErrorCopy(code: string | null): string {
  if (code === "unauthorized") return "Sign in to continue.";
  if (code === "gmail-not-connected") return "Gmail is not connected.";
  if (code === "not-indexed") return "This email is not in Continuum yet.";
  return "Unable to load this email.";
}

function MessageBlock({
  view,
  kind,
}: {
  view: CosSourceViewerView["focused"] | CosSourceViewerView["earlier"][number];
  kind: "focused" | "context";
}) {
  const sender = view.fromDisplayName ?? view.fromEmail;
  return (
    <article
      data-cos-source-message={kind}
      className={kind === "focused" ? "min-w-0" : "min-w-0 border-t border-white/[0.06] pt-4"}
    >
      {sender ? (
        <p className="break-words text-[15px] text-[#efe8de]">{sender}</p>
      ) : null}
      {view.fromDisplayName && view.fromEmail ? (
        <p className="mt-1 break-words text-[13px] text-[#9a8e82]">{view.fromEmail}</p>
      ) : null}
      {view.sentAtLabel ? (
        <p className="mt-1 text-[12px] text-[#6f675f]">{view.sentAtLabel}</p>
      ) : null}
      {kind === "focused" && view.to.length > 0 ? (
        <p className="mt-2 break-words text-[13px] text-[#9a8e82]">
          To {view.to.join(", ")}
        </p>
      ) : null}
      {kind === "focused" && view.cc.length > 0 ? (
        <p className="mt-1 break-words text-[13px] text-[#9a8e82]">
          Cc {view.cc.join(", ")}
        </p>
      ) : null}
      {view.body ? (
        <p
          data-cos-source-body={kind}
          className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#d8cfc4]"
        >
          {view.body}
        </p>
      ) : (
        <p className="mt-4 text-[14px] text-[#9a8e82]">
          {view.snippetFallback ? "Full message text is not available." : "No message text."}
        </p>
      )}
      {kind === "focused" && view.attachments.length > 0 ? (
        <ul data-cos-source-attachments="" className="mt-5 border-t border-white/[0.06] pt-4">
          {view.attachments.map((attachment) => (
            <li
              key={`${attachment.filename}:${attachment.mimeType ?? ""}`}
              className="break-words text-[13px] text-[#9a8e82]"
            >
              {attachment.filename}
              {attachment.mimeType ? ` · ${attachment.mimeType}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function CosViewEmailControl({
  sources,
  request,
}: {
  sources: readonly CosOpenEmailSource[];
  request: CosSourceViewerRequest;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const requestRef = useRef(request);
  requestRef.current = request;
  const [open, setOpen] = useState(false);
  const [activeHref, setActiveHref] = useState(sources[0]?.href ?? "");
  const [view, setView] = useState<CosSourceViewerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!activeHref) {
      if (requestRef.current.provenanceLimited) {
        setLoading(false);
        setError(null);
        setView(presentEvidenceOnlySourceViewer(requestRef.current));
      }
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void import("../source-viewer-actions").then(({ loadSourceViewerAction }) =>
      loadSourceViewerAction({ href: activeHref, request: requestRef.current }),
    ).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setView(null);
        setError(result.safeErrorCode);
        return;
      }
      setView(result.view);
    }).catch(() => {
      if (cancelled) return;
      setLoading(false);
      setView(null);
      setError("unavailable");
    });
    return () => {
      cancelled = true;
    };
  }, [open, activeHref]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (sources.length === 0 && !request.provenanceLimited) return null;
  const active = view;
  const person = active?.personLabel ?? request.personLabel;
  const project = active?.projectTitle ?? request.projectTitle;
  const primaryHref = sources[0]?.href ?? "";

  return (
    <>
      <button
        type="button"
        data-cos-view-email=""
        data-cos-gmail-href={primaryHref}
        data-cos-source-limited={request.provenanceLimited ? "" : undefined}
        onClick={() => {
          setActiveHref(primaryHref);
          setOpen(true);
        }}
        className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#ad9164] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        {VIEW_EMAIL_LABEL}
      </button>
      {open ? (
        <div
          className="hg-cos-source-viewer"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          data-cos-source-viewer=""
        >
          <button
            type="button"
            className="hg-cos-source-viewer-backdrop"
            aria-label="Close email"
            onClick={() => setOpen(false)}
          />
          <div className="hg-cos-source-viewer-panel">
            <header className="hg-cos-source-viewer-head">
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#ad9164] outline-none hover:text-[#efe8de]"
              >
                Close
              </button>
              <h2 id={titleId} className="min-w-0 break-words font-serif text-[1.35rem] tracking-[-0.03em] text-[#efe8de]">
                {active?.focused.subject ?? "Email"}
              </h2>
            </header>
            <div className="hg-cos-source-viewer-body">
              {sources.length > 1 ? (
                <div className="mb-5 flex min-w-0 flex-col gap-1" data-cos-source-switcher="">
                  {sources.map((source) => (
                    <button
                      key={source.href}
                      type="button"
                      onClick={() => setActiveHref(source.href)}
                      className={`min-h-11 text-left text-[12px] ${
                        source.href === activeHref ? "text-[#efe8de]" : "text-[#ad9164]"
                      }`}
                    >
                      {source.label}
                    </button>
                  ))}
                </div>
              ) : null}
              {request.provenanceLabel ? (
                <p
                  data-cos-source-provenance=""
                  className="mb-4 break-words text-[13px] text-[#c4b7aa]"
                >
                  {request.provenanceLabel}
                </p>
              ) : null}
              {person || project ? (
                <p className="mb-4 break-words text-[13px] text-[#9a8e82]">
                  {[person, project].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              {loading ? (
                <p className="text-[14px] text-[#9a8e82]">Loading email…</p>
              ) : error ? (
                <p className="text-[14px] text-[#d2b8a8]">{viewerErrorCopy(error)}</p>
              ) : active ? (
                <>
                  {active.hiddenEarlierCount > 0 ? (
                    <p className="mb-4 text-[12px] text-[#6f675f]">
                      {active.hiddenEarlierCount} earlier
                      {active.hiddenEarlierCount === 1 ? " message" : " messages"} in this thread
                    </p>
                  ) : null}
                  {active.earlier.map((message) => (
                    <MessageBlock key={message.messageId} view={message} kind="context" />
                  ))}
                  <MessageBlock view={active.focused} kind="focused" />
                  {active.later.map((message) => (
                    <MessageBlock key={message.messageId} view={message} kind="context" />
                  ))}
                  {active.why || active.facts.length > 0 || active.beats.length > 0 ? (
                    <section data-cos-source-why="" className="mt-6 border-t border-white/[0.06] pt-4">
                      {active.why ? (
                        <p className="break-words text-[13px] text-[#c4b7aa]">{active.why}</p>
                      ) : null}
                      {active.facts.map((fact) => (
                        <p key={fact.label} className="mt-2 break-words text-[13px] text-[#9a8e82]">
                          {fact.label}: {fact.value}
                        </p>
                      ))}
                      {active.beats.map((beat) => (
                        <p key={beat.candidateId} className="mt-2 break-words text-[13px] text-[#9a8e82]">
                          {beat.label}: {beat.summary}
                        </p>
                      ))}
                    </section>
                  ) : null}
                  {(request.relatedSources ?? []).length > 0 ? (
                    <section data-cos-related-email="" className="mt-6 border-t border-white/[0.06] pt-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-[#6f675f]">
                        {RELATED_EMAIL_LABEL}
                      </p>
                      {(request.relatedSources ?? []).map((source) => (
                        <a
                          key={source.href}
                          href={source.href}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex min-h-11 items-center break-words text-[13px] text-[#ad9164] outline-none hover:text-[#efe8de]"
                        >
                          {source.label}
                        </a>
                      ))}
                    </section>
                  ) : null}
                </>
              ) : null}
            </div>
            <div className="hg-cos-source-viewer-foot">
              {activeHref ? (
                <a
                  href={activeHref}
                  target="_blank"
                  rel="noreferrer"
                  data-cos-open-in-gmail=""
                  className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#8d8073] outline-none hover:text-[#ad9164]"
                >
                  {OPEN_IN_GMAIL_LABEL}
                </a>
              ) : (
                <p className="text-[11px] uppercase tracking-[0.2em] text-[#6f675f]">
                  No Gmail source
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
