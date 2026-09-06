"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef } from "react";
import {
  copyGmailProjectArtifact,
  type CopyGmailProjectArtifactState,
} from "../project-artifact-gmail-copy-actions";
import { conciergeProjectPath } from "@/lib/continuum/client-memory/read/presentation";
import { GMAIL_COPY_APPROVAL } from "@/lib/continuum/client-memory/project-artifact-gmail-copy/constants";
import { PROJECT_ARTIFACT_KINDS } from "@/lib/continuum/client-memory/project-artifacts/types";
import { PROJECT_ARTIFACT_KIND_LABELS } from "@/lib/continuum/client-memory/project-artifacts/present";
import type { GmailCopyPreview } from "@/lib/continuum/client-memory/project-artifact-gmail-copy/preview";

export function CopyGmailAttachmentToProjectForm({
  projectId,
  projectTitle,
  mutationId,
  preview,
}: {
  projectId: string;
  projectTitle: string;
  mutationId: string;
  preview: Extract<GmailCopyPreview, { ok: true }>;
}) {
  const groupId = useId();
  const [state, formAction, pending] = useActionState(
    copyGmailProjectArtifact,
    null as CopyGmailProjectArtifactState,
  );
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state?.message) errorRef.current?.focus();
  }, [state?.message]);

  return (
    <form action={formAction} className="flex min-h-[70vh] flex-col" noValidate>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="mutationId" value={mutationId} />
      <input type="hidden" name="messageId" value={preview.messageId} />
      <input type="hidden" name="attachmentId" value={preview.attachmentId} />

      <p className="text-[15px] leading-relaxed text-[#c4b7aa]">{projectTitle}</p>
      <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
        Destination project
      </p>

      <p className="mt-8 break-words text-[15px] leading-relaxed text-[#e7ddd2]">
        {preview.filename}
      </p>
      <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
        Attachment
      </p>
      <p className="mt-4 text-[15px] leading-relaxed text-[#c4b7aa]">
        {preview.subject?.trim() ? preview.subject : "Indexed Gmail message"}
        {preview.sentAt ? ` · ${preview.sentAt}` : ""}
      </p>
      <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
        Source email
      </p>

      <fieldset className="mt-8" aria-describedby={groupId}>
        <legend
          id={groupId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          Kind
        </legend>
        <div className="hg-project-kind-choice mt-3">
          {PROJECT_ARTIFACT_KINDS.map((kind) => (
            <label key={kind}>
              <input
                type="radio"
                name="kind"
                value={kind}
                defaultChecked={kind === "other"}
              />
              <span className="min-w-0 break-words text-[15px] leading-relaxed">
                {PROJECT_ARTIFACT_KIND_LABELS[kind]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-8 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Title
        </span>
        <input
          name="title"
          required
          maxLength={160}
          defaultValue={preview.filename.replace(/\.[^.]+$/, "")}
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </label>

      {state?.message ? (
        <p
          ref={errorRef}
          tabIndex={-1}
          role={state.ok ? "status" : "alert"}
          className="mt-6 text-[14px] leading-relaxed text-[#d2b8a8] outline-none"
        >
          {state.message}
        </p>
      ) : null}

      <div className="hg-concierge-savebar sticky bottom-0 z-10 mt-8 -mx-5 flex gap-3 bg-[#14110f] px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="submit"
          name="approval"
          value={GMAIL_COPY_APPROVAL}
          disabled={pending || preview.mimePreview === "unsupported-mime"}
          className="min-h-12 flex-1 rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none hover:border-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:opacity-50"
        >
          {pending ? "Copying…" : "Copy to project"}
        </button>
        <Link
          href={conciergeProjectPath(projectId)}
          className="inline-flex min-h-12 min-w-[6.5rem] items-center justify-center rounded-[18px] px-4 text-[11px] uppercase tracking-[0.22em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
