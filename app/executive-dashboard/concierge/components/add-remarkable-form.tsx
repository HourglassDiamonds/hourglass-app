"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import {
  loadLinkedProjectsForPerson,
  saveRemarkableHumanSource,
  searchConciergeClients,
  type LinkedProjectOption,
  type SavePlaudSourceState,
} from "../actions";
import { conciergeInboxPath } from "@/lib/continuum/client-memory/read/presentation";
import type { ClientSearchResult } from "@/lib/continuum/client-memory/read/types";

export function AddRemarkableForm() {
  const fileId = useId();
  const notesId = useId();
  const capturedId = useId();
  const projectFieldId = useId();
  const [state, formAction, pending] = useActionState(
    saveRemarkableHumanSource,
    null as SavePlaudSourceState | null,
  );
  const [person, setPerson] = useState<{
    personId: string;
    displayName: string;
  } | null>(null);
  const [projects, setProjects] = useState<LinkedProjectOption[]>([]);
  const [personQuery, setPersonQuery] = useState("");
  const [personResults, setPersonResults] = useState<ClientSearchResult[] | null>(
    null,
  );
  const [searching, startSearch] = useTransition();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (state?.message) errorRef.current?.focus();
  }, [state?.message]);

  useEffect(() => {
    const trimmed = personQuery.trim();
    if (!trimmed || person) {
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
  }, [personQuery, person]);

  useEffect(() => {
    if (!person) return;
    let cancelled = false;
    void loadLinkedProjectsForPerson(person.personId).then((result) => {
      if (cancelled || !result.ok) return;
      setProjects(result.projects);
    });
    return () => {
      cancelled = true;
    };
  }, [person]);

  const visiblePersonResults =
    !personQuery.trim() || person ? null : personResults;

  return (
    <form action={formAction} className="flex min-h-[70vh] flex-col" noValidate>
      {person ? <input type="hidden" name="personId" value={person.personId} /> : null}
      <input type="hidden" name="communicationType" value="handwritten" />

      <div>
        <label
          htmlFor={fileId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          reMarkable export
        </label>
        <input
          id={fileId}
          name="exportFile"
          type="file"
          required
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          className="mt-3 w-full text-[14px] text-[#c4b7aa] file:mr-4 file:rounded-[14px] file:border file:border-[#ad9164]/40 file:bg-[#1d1916] file:px-3 file:py-2 file:text-[11px] file:uppercase file:tracking-[0.18em] file:text-[#efe8de]"
        />
        <p className="mt-3 text-[13px] leading-relaxed text-[#9a8e82]">
          PDF, PNG, or JPEG. Handwriting is stored as a document. OCR is not
          enabled in V1 — paste associated text below if you want candidates.
        </p>
      </div>

      <div className="mt-8">
        <label
          htmlFor={capturedId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          Captured
        </label>
        <input
          id={capturedId}
          name="capturedAt"
          type="datetime-local"
          className="mt-3 min-h-12 w-full rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 text-[16px] text-[#efe8de] outline-none"
        />
      </div>

      <div className="mt-8">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Person
        </p>
        {person ? (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="font-serif text-[1.2rem] text-[#efe8de]">{person.displayName}</p>
            <button
              type="button"
              className="min-h-11 text-[11px] uppercase tracking-[0.22em] text-[#8d8073]"
              onClick={() => {
                setPerson(null);
                setPersonQuery("");
                setProjects([]);
              }}
            >
              Clear
            </button>
          </div>
        ) : (
          <>
            <label htmlFor={`${notesId}-person`} className="sr-only">
              Search people
            </label>
            <input
              id={`${notesId}-person`}
              type="search"
              value={personQuery}
              autoComplete="off"
              placeholder="Optional — search people"
              onChange={(event) => setPersonQuery(event.target.value)}
              className="mt-3 min-h-12 w-full rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 text-[16px] text-[#efe8de] outline-none placeholder:text-[#7d7268]"
            />
            <div className="mt-2" aria-live="polite">
              {searching && personQuery.trim() && !visiblePersonResults ? (
                <p className="text-[13px] text-[#9a8e82]">Searching…</p>
              ) : null}
              {visiblePersonResults && visiblePersonResults.length > 0 ? (
                <ul className="divide-y divide-white/[0.06]">
                  {visiblePersonResults.map((result) => (
                    <li key={result.personId}>
                      <button
                        type="button"
                        className="w-full py-3 text-left outline-none hover:text-[#ad9164]"
                        onClick={() => {
                          setPerson({
                            personId: result.personId,
                            displayName: result.displayName,
                          });
                          setPersonQuery("");
                          setPersonResults(null);
                          setProjects([]);
                        }}
                      >
                        <span className="font-serif text-[1.15rem] text-[#efe8de]">
                          {result.displayName}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </>
        )}
      </div>

      {person && projects.length > 0 ? (
        <div className="mt-6">
          <label
            htmlFor={projectFieldId}
            className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
          >
            Project
          </label>
          <select
            id={projectFieldId}
            name="projectId"
            defaultValue=""
            className="mt-3 min-h-12 w-full rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none"
          >
            <option value="">None</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="mt-8 flex-1">
        <label
          htmlFor={notesId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          Associated text
        </label>
        <textarea
          id={notesId}
          name="associatedText"
          rows={8}
          className="mt-3 min-h-[10rem] w-full resize-y rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 py-3 text-[16px] leading-relaxed text-[#efe8de] outline-none"
        />
      </div>

      {state?.message ? (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="mt-6 text-[14px] leading-relaxed text-[#d2b8a8] outline-none"
        >
          {state.message}
        </p>
      ) : null}

      <div className="hg-concierge-savebar sticky bottom-0 z-10 mt-8 -mx-5 flex gap-3 bg-[#14110f] px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 flex-1 rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none disabled:opacity-50"
        >
          {pending ? "Saving…" : "Ingest source"}
        </button>
        <Link
          href={conciergeInboxPath()}
          className="inline-flex min-h-12 min-w-[6.5rem] items-center justify-center rounded-[18px] px-4 text-[11px] uppercase tracking-[0.22em] text-[#8d8073]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
