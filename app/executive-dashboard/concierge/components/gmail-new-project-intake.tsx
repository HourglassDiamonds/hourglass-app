"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { approveGmailNewProject } from "../founder-project-actions";
import { scanGmailNewProjectIntake, type ScanGmailIntakeState } from "../gmail-intake-actions";
import type { GmailNewProjectIntakeCard } from "@/lib/continuum/client-memory/founder-project/intake-present";
import {
  PROJECT_KIND_LABELS,
  PROJECT_KINDS,
} from "@/lib/continuum/client-memory/project-kind";
import {
  CUSTOM_LIFECYCLE_STAGE_LABELS,
  CUSTOM_LIFECYCLE_STAGES,
} from "@/lib/continuum/client-memory/project-lifecycle";

export function GmailIntakeScanForm() {
  const [state, formAction, pending] = useActionState(
    scanGmailNewProjectIntake,
    null as ScanGmailIntakeState,
  );
  const noticeRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state) noticeRef.current?.focus();
  }, [state]);
  return (
    <form action={formAction} className="mt-6">
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none hover:border-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:opacity-50"
      >
        {pending ? "Reading indexed mail…" : "Scan indexed mail"}
      </button>
      {state && !state.ok ? (
        <p
          ref={noticeRef}
          tabIndex={-1}
          role="alert"
          className="mt-4 text-[14px] text-[#d2b8a8] outline-none"
        >
          {state.message}
        </p>
      ) : null}
      {state && state.ok ? (
        <p
          ref={noticeRef}
          tabIndex={-1}
          className="mt-4 text-[14px] text-[#c4b7aa] outline-none"
        >
          {state.inserted === 0
            ? "No new project proposals from this scan."
            : `${state.inserted} new proposal${state.inserted === 1 ? "" : "s"} ready for review.`}
        </p>
      ) : null}
    </form>
  );
}

export function GmailNewProjectIntakeList({
  cards,
}: {
  cards: GmailNewProjectIntakeCard[];
}) {
  if (cards.length === 0) {
    return (
      <p className="mt-8 max-w-[46ch] text-[15px] leading-relaxed text-[#9a8e82]">
        No new-project proposals yet. Scan indexed mail to read thread bodies
        transiently. Nothing here becomes a Project until you approve it.
      </p>
    );
  }
  return (
    <ul className="mt-8 divide-y divide-white/[0.06]">
      {cards.map((card) => (
        <li key={card.candidateId} className="py-8">
          <GmailNewProjectApproveForm card={card} />
        </li>
      ))}
    </ul>
  );
}

function GmailNewProjectApproveForm({ card }: { card: GmailNewProjectIntakeCard }) {
  const [state, formAction, pending] = useActionState(approveGmailNewProject, null);
  const [mutationId] = useState(() => crypto.randomUUID());
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state?.message) errorRef.current?.focus();
  }, [state?.message]);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="candidateId" value={card.candidateId} />
      <input type="hidden" name="mutationId" value={mutationId} />
      {card.personId ? (
        <input type="hidden" name="personId" value={card.personId} />
      ) : null}

      <p className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
        New project proposal
      </p>
      <p className="font-serif text-[1.45rem] text-[#efe8de]">{card.title}</p>
      {card.personName ? (
        <p className="text-[15px] text-[#c4b7aa]">
          {card.personName}
          {card.personId ? "" : " — Continuum identity unresolved"}
        </p>
      ) : (
        <p className="text-[14px] text-[#d2b8a8]">
          Person could not be resolved from Continuum identity. Do not approve
          from display name. Use Create Action after searching People.
        </p>
      )}
      {card.giftContext ? (
        <p className="text-[14px] text-[#b7aa9c]">Context: {card.giftContext}</p>
      ) : null}
      {card.designBasis ? (
        <p className="text-[14px] text-[#b7aa9c]">Basis: {card.designBasis}</p>
      ) : null}
      {card.proposedSpecs.length > 0 ? (
        <ul className="text-[14px] text-[#b7aa9c]">
          {card.proposedSpecs.map((spec) => (
            <li key={spec}>{spec}</li>
          ))}
        </ul>
      ) : null}
      {card.structuredSpecs.map((spec) => (
        <p key={spec.fieldName} className="text-[14px] text-[#b7aa9c]">
          {spec.fieldName.replaceAll("_", " ")}: {spec.proposedValue}
        </p>
      ))}
      {card.attachmentFilenames.length > 0 ? (
        <p className="text-[13px] text-[#8d8073]">
          Attachments (filenames only): {card.attachmentFilenames.join(", ")}
        </p>
      ) : null}
      {card.waitingOnClient ? (
        <p className="text-[14px] leading-relaxed text-[#c4b7aa]">
          Proposed current state — waiting on client: {card.waitingOnClient}
        </p>
      ) : null}

      <label className="block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Project title
        </span>
        <input
          name="title"
          defaultValue={card.title}
          required
          maxLength={160}
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none"
        />
      </label>
      <label className="block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Project kind
        </span>
        <select
          name="projectKind"
          defaultValue="custom_new_jewelry"
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none"
        >
          {PROJECT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {PROJECT_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Lifecycle
        </span>
        <select
          name="lifecycleStage"
          defaultValue="discovery"
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none"
        >
          {CUSTOM_LIFECYCLE_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {CUSTOM_LIFECYCLE_STAGE_LABELS[stage]}
            </option>
          ))}
        </select>
      </label>
      <p className="text-[13px] leading-relaxed text-[#8d8073]">
        Waiting on the client is a proposed Project state. It is not a Top 5
        action. Leave Action empty unless you personally need to do something
        now.
      </p>
      <label className="block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Optional first action
        </span>
        <input
          name="subject"
          maxLength={160}
          placeholder="Leave blank while waiting on the client"
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none"
        />
      </label>
      {state?.message ? (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="text-[14px] text-[#d2b8a8] outline-none"
        >
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || !card.personId}
        className="min-h-12 rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none hover:border-[#ad9164] disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}
