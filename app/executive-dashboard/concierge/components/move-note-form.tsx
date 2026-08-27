"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import {
  loadLinkedProjectsForPerson,
  moveConciergeNote,
  searchConciergeClients,
  type LinkedProjectOption,
  type MutateNoteState,
} from "../actions";
import {
  RELATIONSHIP_CONTEXT_LAYER_LABELS,
  conciergeClientPath,
} from "@/lib/continuum/client-memory/read/presentation";
import {
  RELATIONSHIP_CONTEXT_LAYERS,
  type RelationshipContextLayer,
} from "@/lib/continuum/client-memory/types";

export function MoveNoteForm({
  currentPersonId,
  currentPersonName,
  currentProjectTitle,
  currentProjectId,
  currentContext,
  noteId,
  mutationId,
  projects,
}: {
  currentPersonId: string;
  currentPersonName: string;
  currentProjectTitle: string | null;
  currentProjectId: string | null;
  currentContext: RelationshipContextLayer;
  noteId: string;
  mutationId: string;
  projects: LinkedProjectOption[];
}) {
  const projectFieldId = useId();
  const searchId = useId();
  const confirmId = useId();
  const [state, formAction, pending] = useActionState(
    moveConciergeNote,
    null as MutateNoteState | null,
  );
  const [contextLayer, setContextLayer] =
    useState<RelationshipContextLayer>(currentContext);
  const [targetPersonId, setTargetPersonId] = useState(currentPersonId);
  const [targetPersonName, setTargetPersonName] = useState(currentPersonName);
  const [targetProjects, setTargetProjects] = useState(projects);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    Array<{ personId: string; displayName: string }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const crossPerson = targetPersonId !== currentPersonId;
  const showProjects = contextLayer === "client" && targetProjects.length > 0;

  useEffect(() => {
    if (state?.message) errorRef.current?.focus();
  }, [state?.message]);

  async function findPerson() {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearching(true);
    const found = await searchConciergeClients(trimmed);
    setSearching(false);
    if (!found.ok) {
      setResults([]);
      return;
    }
    setResults(
      found.results.map((row) => ({
        personId: row.personId,
        displayName: row.displayName,
      })),
    );
  }

  async function choosePerson(personId: string, displayName: string) {
    setTargetPersonId(personId);
    setTargetPersonName(displayName);
    setResults([]);
    setQuery("");
    setConfirmed(false);
    const loaded = await loadLinkedProjectsForPerson(personId);
    setTargetProjects(loaded.ok ? loaded.projects : []);
  }

  return (
    <form action={formAction} className="flex min-h-[70vh] flex-col" noValidate>
      <input type="hidden" name="noteId" value={noteId} />
      <input type="hidden" name="mutationId" value={mutationId} />
      <input type="hidden" name="currentPersonId" value={currentPersonId} />
      <input type="hidden" name="personId" value={targetPersonId} />
      {crossPerson ? (
        <input
          type="hidden"
          name="crossPersonConfirmed"
          value={confirmed ? "1" : "0"}
        />
      ) : null}

      <section>
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Current
        </h2>
        <dl className="mt-3 space-y-3">
          <div>
            <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
              Person
            </dt>
            <dd className="mt-1 font-serif text-[1.15rem] leading-snug text-[#efe8de]">
              {currentPersonName}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
              Project
            </dt>
            <dd className="mt-1 text-[15px] leading-relaxed text-[#c4b7aa]">
              {currentProjectTitle ?? "None"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
              Context
            </dt>
            <dd className="mt-1 text-[15px] leading-relaxed text-[#c4b7aa]">
              {RELATIONSHIP_CONTEXT_LAYER_LABELS[currentContext]}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-10">
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Target
        </h2>
        <p className="mt-3 font-serif text-[1.15rem] leading-snug text-[#efe8de]">
          {targetPersonName}
        </p>
        <div className="mt-4">
          <label
            htmlFor={searchId}
            className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
          >
            Person
          </label>
          <div className="mt-3 flex gap-2">
            <input
              id={searchId}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search another person"
              className="min-h-12 flex-1 rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none placeholder:text-[#7d7268] focus-visible:border-[#ad9164]/70"
            />
            <button
              type="button"
              onClick={() => void findPerson()}
              disabled={searching}
              className="inline-flex min-h-12 items-center rounded-[18px] px-4 text-[11px] uppercase tracking-[0.22em] text-[#8d8073] outline-none hover:text-[#efe8de] disabled:opacity-50"
            >
              {searching ? "Finding…" : "Find"}
            </button>
          </div>
          {results.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {results.map((row) => (
                <li key={row.personId}>
                  <button
                    type="button"
                    onClick={() => void choosePerson(row.personId, row.displayName)}
                    className="w-full rounded-[18px] px-3 py-3 text-left font-serif text-[1.1rem] text-[#efe8de] outline-none hover:bg-white/[0.04] focus-visible:bg-white/[0.06]"
                  >
                    {row.displayName}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <fieldset className="mt-8 border-0 p-0">
          <legend className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
            Context
          </legend>
          <div
            className="hg-concierge-segments mt-3"
            role="radiogroup"
            aria-label="Target relationship context"
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
                    required
                    onChange={() => setContextLayer(layer)}
                  />
                  <span>{RELATIONSHIP_CONTEXT_LAYER_LABELS[layer]}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {showProjects ? (
          <div className="mt-8">
            <label
              htmlFor={projectFieldId}
              className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
            >
              Project
            </label>
            <select
              id={projectFieldId}
              key={`${targetPersonId}-${contextLayer}`}
              name="projectId"
              defaultValue={
                targetPersonId === currentPersonId ? (currentProjectId ?? "") : ""
              }
              className="mt-3 min-h-12 w-full rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:border-[#ad9164]/70"
            >
              <option value="">None</option>
              {targetProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {crossPerson ? (
          <label
            htmlFor={confirmId}
            className="mt-8 flex items-start gap-3 text-[15px] leading-relaxed text-[#c4b7aa]"
          >
            <input
              id={confirmId}
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1"
            />
            <span>
              Move this note from {currentPersonName} to {targetPersonName}. The
              original person will no longer own it.
            </span>
          </label>
        ) : null}
      </section>

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
          disabled={pending || (crossPerson && !confirmed)}
          className="min-h-12 flex-1 rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none hover:border-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:opacity-50"
        >
          {pending ? "Moving…" : "Move note"}
        </button>
        <Link
          href={conciergeClientPath(currentPersonId)}
          className="inline-flex min-h-12 min-w-[6.5rem] items-center justify-center rounded-[18px] px-4 text-[11px] uppercase tracking-[0.22em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
