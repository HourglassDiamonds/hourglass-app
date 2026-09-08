"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  approveGmailNewProject,
  confirmGmailIntakePerson,
} from "../founder-project-actions";
import { scanGmailNewProjectIntake, type ScanGmailIntakeState } from "../gmail-intake-actions";
import { searchConciergeClients } from "../actions";
import type { GmailNewProjectIntakeCard } from "@/lib/continuum/client-memory/founder-project/intake-present";
import type { ClientSearchResult } from "@/lib/continuum/client-memory/read/types";
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
          {`Scanned ${state.threadCount} indexed thread${state.threadCount === 1 ? "" : "s"}.`}
          {state.inserted > 0
            ? ` ${state.inserted} need attention.`
            : " No new project proposals from this scan."}
          {state.unreadThreadCount > 0
            ? ` ${state.unreadThreadCount} thread${
                state.unreadThreadCount === 1 ? "" : "s"
              } could not be read.`
            : ""}
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
          <GmailNewProjectCard card={card} />
        </li>
      ))}
    </ul>
  );
}

function GmailNewProjectCard({ card }: { card: GmailNewProjectIntakeCard }) {
  return (
    <div className="space-y-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
        New project detected
      </p>
      <p className="font-serif text-[1.45rem] text-[#efe8de]">{card.title}</p>
      {card.identityConfirmed ? (
        <p className="text-[15px] text-[#c4b7aa]">
          {card.personName}
          {card.personEmail ? ` · ${card.personEmail}` : ""}
        </p>
      ) : (
        <div className="space-y-1">
          <p className="text-[15px] text-[#c4b7aa]">
            Possible client:
            {card.possiblePersonName ? ` ${card.possiblePersonName}` : " unresolved"}
          </p>
          {card.possiblePersonEmail ? (
            <p className="text-[14px] text-[#b7aa9c]">{card.possiblePersonEmail}</p>
          ) : null}
          <p className="text-[14px] text-[#d2b8a8]">Identity needs confirmation.</p>
        </div>
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
      {card.identityConfirmed ? (
        <GmailNewProjectApproveForm card={card} />
      ) : (
        <GmailConfirmPersonForm card={card} />
      )}
    </div>
  );
}

function GmailConfirmPersonForm({ card }: { card: GmailNewProjectIntakeCard }) {
  const [state, formAction, pending] = useActionState(confirmGmailIntakePerson, null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<{
    personId: string;
    displayName: string;
    email: string | null;
  } | null>(
    card.possiblePersonId
      ? {
          personId: card.possiblePersonId,
          displayName: card.possiblePersonName ?? "Possible client",
          email: card.possiblePersonEmail,
        }
      : null,
  );
  const [results, setPersonResults] = useState<ClientSearchResult[] | null>(null);
  const [searching, startSearch] = useTransition();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const requestIdRef = useRef(0);
  useEffect(() => {
    if (state?.message) errorRef.current?.focus();
  }, [state?.message]);
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || picked) {
      requestIdRef.current += 1;
      return;
    }
    const handle = window.setTimeout(() => {
      const requestId = ++requestIdRef.current;
      setPersonResults(null);
      startSearch(async () => {
        const result = await searchConciergeClients(trimmed);
        if (requestId !== requestIdRef.current) return;
        setPersonResults(result.ok ? result.results : []);
      });
    }, 180);
    return () => window.clearTimeout(handle);
  }, [query, picked]);
  if (!card.personAssociationCandidateId) {
    return (
      <p className="text-[14px] text-[#d2b8a8]">
        Person association is missing. Use Create Action after searching People.
      </p>
    );
  }
  return (
    <form action={formAction} className="space-y-4">
      <input
        type="hidden"
        name="personAssociationCandidateId"
        value={card.personAssociationCandidateId}
      />
      {picked ? <input type="hidden" name="personId" value={picked.personId} /> : null}
      {!picked ? (
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
            Search Continuum People
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name or email"
            className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none"
          />
        </label>
      ) : (
        <p className="text-[14px] text-[#c4b7aa]">
          Confirm {picked.displayName}
          {picked.email ? ` · ${picked.email}` : ""}
        </p>
      )}
      {!picked && results && results.length > 0 ? (
        <ul className="space-y-2">
          {results.map((row) => (
            <li key={row.personId}>
              <button
                type="button"
                onClick={() => {
                  setPicked({
                    personId: row.personId,
                    displayName: row.displayName,
                    email: row.email,
                  });
                  setQuery("");
                  setPersonResults(null);
                }}
                className="w-full rounded-[14px] border border-white/10 px-4 py-3 text-left text-[14px] text-[#efe8de]"
              >
                {row.displayName}
                {row.email ? ` · ${row.email}` : ""}
                {row.relationshipContext ? ` · ${row.relationshipContext}` : ""}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!picked && searching ? (
        <p className="text-[13px] text-[#8d8073]">Searching People…</p>
      ) : null}
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
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending || !picked}
          className="min-h-12 rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none hover:border-[#ad9164] disabled:opacity-50"
        >
          {pending ? "Confirming…" : "Confirm person"}
        </button>
        <span className="inline-flex min-h-12 items-center text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Review
        </span>
      </div>
    </form>
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
      {state?.message && /possible existing project/i.test(state.message) ? (
        <label className="flex items-start gap-3 text-[14px] text-[#c4b7aa]">
          <input type="checkbox" name="confirmPossibleExisting" value="1" className="mt-1" />
          Create another Project anyway
        </label>
      ) : null}
      <button
        type="submit"
        disabled={pending || !card.identityConfirmed}
        className="min-h-12 rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none hover:border-[#ad9164] disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}
