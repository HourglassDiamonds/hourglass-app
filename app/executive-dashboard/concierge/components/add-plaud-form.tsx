"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import {
  loadLinkedProjectsForPerson,
  savePlaudHumanSource,
  searchConciergeClients,
  type LinkedProjectOption,
  type SavePlaudSourceState,
} from "../actions";
import {
  RELATIONSHIP_CONTEXT_LAYER_LABELS,
  conciergeInboxPath,
} from "@/lib/continuum/client-memory/read/presentation";
import {
  RELATIONSHIP_CONTEXT_LAYERS,
  type RelationshipContextLayer,
} from "@/lib/continuum/client-memory/types";
import {
  HUMAN_COMMUNICATION_LABELS,
  PLAUD_COMMUNICATION_CHOICES,
} from "@/lib/continuum/client-memory/human-intake/labels";
import type { ClientSearchResult } from "@/lib/continuum/client-memory/read/types";
import type { HumanCommunicationType } from "@/lib/continuum/client-memory/human-intake";

export function AddPlaudForm() {
  const transcriptId = useId();
  const fileId = useId();
  const projectId = useId();
  const [state, formAction, pending] = useActionState(
    savePlaudHumanSource,
    null as SavePlaudSourceState | null,
  );
  const [communicationType, setCommunicationType] =
    useState<HumanCommunicationType>("unknown");
  const [contextLayer, setContextLayer] = useState<RelationshipContextLayer | "">(
    "",
  );
  const [contextTouched, setContextTouched] = useState(false);
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
      setPersonResults(null);
      return;
    }
    const handle = window.setTimeout(() => {
      const requestId = ++requestIdRef.current;
      startSearch(async () => {
        const result = await searchConciergeClients(trimmed);
        if (requestId !== requestIdRef.current) return;
        setPersonResults(result.ok ? result.results : []);
      });
    }, 180);
    return () => window.clearTimeout(handle);
  }, [personQuery, person]);

  useEffect(() => {
    if (!person) {
      setProjects([]);
      return;
    }
    let cancelled = false;
    void loadLinkedProjectsForPerson(person.personId).then((result) => {
      if (cancelled || !result.ok) return;
      setProjects(result.projects);
      if (result.suggestedContext && !contextTouched) {
        setContextLayer(result.suggestedContext);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [person, contextTouched]);

  return (
    <form action={formAction} className="flex min-h-[70vh] flex-col" noValidate>
      {person ? (
        <input type="hidden" name="personId" value={person.personId} />
      ) : null}

      <fieldset className="border-0 p-0">
        <legend className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Communication
        </legend>
        <div
          className="hg-concierge-segments mt-3"
          role="radiogroup"
          aria-label="Communication type"
        >
          {PLAUD_COMMUNICATION_CHOICES.map((type) => {
            const selected = communicationType === type;
            return (
              <label
                key={type}
                className={`hg-concierge-segment ${selected ? "is-selected" : ""}`}
              >
                <input
                  type="radio"
                  name="communicationType"
                  value={type}
                  checked={selected}
                  onChange={() => setCommunicationType(type)}
                />
                <span>{HUMAN_COMMUNICATION_LABELS[type]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-8 border-0 p-0">
        <legend className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Context
        </legend>
        <div
          className="hg-concierge-segments mt-3"
          role="radiogroup"
          aria-label="Relationship context"
        >
          {RELATIONSHIP_CONTEXT_LAYERS.map((layer) => {
            const selected = contextLayer === layer;
            return (
              <label
                key={layer}
                className={`hg-concierge-segment ${selected ? "is-selected" : ""}`}
              >
                <input
                  type="radio"
                  name="contextLayer"
                  value={layer}
                  checked={selected}
                  onChange={() => {
                    setContextLayer(layer);
                    setContextTouched(true);
                  }}
                />
                <span>{RELATIONSHIP_CONTEXT_LAYER_LABELS[layer]}</span>
              </label>
            );
          })}
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-[#9a8e82]">
          Optional. Not a role, permission, or fact status.
        </p>
      </fieldset>

      <div className="mt-8">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Person
        </p>
        {person ? (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="font-serif text-[1.2rem] text-[#efe8de]">
              {person.displayName}
            </p>
            <button
              type="button"
              className="min-h-11 text-[11px] uppercase tracking-[0.22em] text-[#8d8073] outline-none hover:text-[#efe8de]"
              onClick={() => {
                setPerson(null);
                setPersonQuery("");
                setProjects([]);
                setContextTouched(false);
              }}
            >
              Clear
            </button>
          </div>
        ) : (
          <>
            <label htmlFor={`${transcriptId}-person`} className="sr-only">
              Search people
            </label>
            <input
              id={`${transcriptId}-person`}
              type="search"
              value={personQuery}
              autoComplete="off"
              placeholder="Optional — search people"
              onChange={(event) => setPersonQuery(event.target.value)}
              className="mt-3 min-h-12 w-full rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 text-[16px] text-[#efe8de] outline-none placeholder:text-[#7d7268] focus-visible:border-[#ad9164]/70"
            />
            <div className="mt-2" aria-live="polite">
              {searching && personQuery.trim() && !personResults ? (
                <p className="text-[13px] text-[#9a8e82]">Searching…</p>
              ) : null}
              {personResults && personResults.length > 0 ? (
                <ul className="divide-y divide-white/[0.06]">
                  {personResults.map((result) => (
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
            htmlFor={projectId}
            className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
          >
            Project
          </label>
          <select
            id={projectId}
            name="projectId"
            defaultValue=""
            className="mt-3 min-h-12 w-full rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:border-[#ad9164]/70"
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

      <div className="mt-8">
        <label
          htmlFor={fileId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          Transcript file
        </label>
        <input
          id={fileId}
          name="transcriptFile"
          type="file"
          accept=".txt,.vtt,.json,.md,text/plain,text/vtt,application/json,text/markdown"
          className="mt-3 w-full text-[14px] text-[#c4b7aa] file:mr-4 file:rounded-[14px] file:border file:border-[#ad9164]/40 file:bg-[#1d1916] file:px-3 file:py-2 file:text-[11px] file:uppercase file:tracking-[0.18em] file:text-[#efe8de]"
        />
      </div>

      <div className="mt-8 flex-1">
        <label
          htmlFor={transcriptId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          Or paste transcript
        </label>
        <textarea
          id={transcriptId}
          name="transcript"
          rows={10}
          enterKeyHint="enter"
          className="mt-3 min-h-[12rem] w-full resize-y rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 py-3 text-[16px] leading-relaxed text-[#efe8de] outline-none placeholder:text-[#7d7268] focus-visible:border-[#ad9164]/70"
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
          className="min-h-12 flex-1 rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none hover:border-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save source"}
        </button>
        <Link
          href={conciergeInboxPath()}
          className="inline-flex min-h-12 min-w-[6.5rem] items-center justify-center rounded-[18px] px-4 text-[11px] uppercase tracking-[0.22em] text-[#8d8073] outline-none hover:text-[#efe8de]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
