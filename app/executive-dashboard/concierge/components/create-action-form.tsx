"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { searchConciergeClients } from "../actions";
import {
  loadPersonProjectsForAction,
  saveFounderIntake,
  type SaveFounderIntakeState,
} from "../founder-project-actions";
import { CONCIERGE_HOME_PATH } from "@/lib/continuum/client-memory/read/presentation";
import {
  CURRENT_PROJECTS_ADD_ACTION_LABEL,
  CURRENT_PROJECTS_CREATE_ACTION_LABEL,
} from "@/lib/continuum/client-memory/open-projects/present";
import type { ClientSearchResult } from "@/lib/continuum/client-memory/read/types";
import type { PersonActionProject } from "@/lib/continuum/client-memory/founder-project/person-projects";
import {
  PROJECT_KINDS,
  PROJECT_KIND_LABELS,
  type ProjectKind,
} from "@/lib/continuum/client-memory/project-kind";
import {
  CUSTOM_LIFECYCLE_STAGE_LABELS,
  CUSTOM_LIFECYCLE_STAGES,
  REPAIR_LIFECYCLE_STAGE_LABELS,
  REPAIR_LIFECYCLE_STAGES,
  isLifecycleKind,
} from "@/lib/continuum/client-memory/project-lifecycle";

export type FounderActionProjectOption = {
  projectId: string;
  title: string;
  people: Array<{ personId: string; displayName: string }>;
};

export function CreateActionForm({
  projects,
  selectedProjectId,
  mutationId,
}: {
  projects: FounderActionProjectOption[];
  selectedProjectId: string | null;
  mutationId: string;
}) {
  const preselected =
    selectedProjectId && projects.some((row) => row.projectId === selectedProjectId)
      ? selectedProjectId
      : "";
  const [intent, setIntent] = useState<"existing" | "new-project">(
    preselected ? "existing" : "existing",
  );
  const [projectId, setProjectId] = useState(preselected);
  const [projectQuery, setProjectQuery] = useState("");
  const [person, setPerson] = useState<{
    personId: string;
    displayName: string;
    email: string | null;
    relationshipContext: string | null;
  } | null>(null);
  const [personQuery, setPersonQuery] = useState("");
  const [personResults, setPersonResults] = useState<ClientSearchResult[] | null>(null);
  const [personProjects, setPersonProjects] = useState<PersonActionProject[]>([]);
  const [kind, setKind] = useState<ProjectKind>("custom_new_jewelry");
  const [lifecycle, setLifecycle] = useState("discovery");
  const [searching, startSearch] = useTransition();
  const [state, formAction, pending] = useActionState(
    saveFounderIntake,
    null as SaveFounderIntakeState,
  );
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
    void loadPersonProjectsForAction(person.personId).then((result) => {
      if (cancelled || !result.ok) return;
      setPersonProjects(result.projects);
    });
    return () => {
      cancelled = true;
    };
  }, [person]);

  const deskPeople = useMemo(
    () => projects.find((row) => row.projectId === projectId)?.people ?? [],
    [projectId, projects],
  );
  const filteredProjects = useMemo(() => {
    const q = projectQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((row) => row.title.toLowerCase().includes(q));
  }, [projectQuery, projects]);
  const stages = isLifecycleKind(kind)
    ? kind === "repair_service"
      ? REPAIR_LIFECYCLE_STAGES
      : CUSTOM_LIFECYCLE_STAGES
    : [];
  const stageLabels =
    kind === "repair_service"
      ? REPAIR_LIFECYCLE_STAGE_LABELS
      : CUSTOM_LIFECYCLE_STAGE_LABELS;
  const visiblePersonResults =
    !personQuery.trim() || person ? null : personResults;

  return (
    <form action={formAction} className="flex min-h-[70vh] flex-col" noValidate>
      <input type="hidden" name="mutationId" value={mutationId} />
      <input type="hidden" name="intent" value={intent} />
      {person ? (
        <input type="hidden" name="associatedPersonId" value={person.personId} />
      ) : null}
      {intent === "existing" ? (
        <input type="hidden" name="projectId" value={projectId} />
      ) : null}

      <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
        {CURRENT_PROJECTS_ADD_ACTION_LABEL}
      </p>
      <p className="mt-3 max-w-[42ch] text-[15px] leading-relaxed text-[#c4b7aa]">
        Start with a person or a project. A new Project is created only when you
        explicitly choose it. Actions become Open Jobs and can appear in Today.
      </p>

      <label className="mt-8 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Person
        </span>
        {person ? (
          <div className="mt-2 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 py-3">
            <p className="font-serif text-[1.15rem] text-[#efe8de]">{person.displayName}</p>
            {person.email ? (
              <p className="mt-1 break-words text-[13.5px] text-[#b7aa9c]">{person.email}</p>
            ) : null}
            {person.relationshipContext ? (
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                {person.relationshipContext}
              </p>
            ) : null}
            <button
              type="button"
              className="mt-3 text-[11px] uppercase tracking-[0.18em] text-[#8d8073] outline-none hover:text-[#efe8de]"
              onClick={() => {
                setPerson(null);
                setPersonQuery("");
                setPersonProjects([]);
                setIntent("existing");
                setProjectId(preselected);
              }}
            >
              Change person
            </button>
          </div>
        ) : (
          <input
            type="search"
            value={personQuery}
            onChange={(event) => setPersonQuery(event.target.value)}
            autoComplete="off"
            placeholder="Search Continuum people"
            className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
          />
        )}
      </label>
      {visiblePersonResults ? (
        <ul className="mt-2">
          {searching && visiblePersonResults === null ? (
            <li className="px-1 py-3 text-[13px] text-[#8d8073]">Searching…</li>
          ) : visiblePersonResults.length === 0 ? (
            <li className="px-1 py-3 text-[13px] text-[#8d8073]">No Continuum people match.</li>
          ) : (
            visiblePersonResults.map((row) => (
              <li key={row.personId}>
                <button
                  type="button"
                  className="block w-full rounded-[18px] px-1 py-4 text-left outline-none hover:bg-white/[0.04] focus-visible:bg-white/[0.06]"
                  onClick={() => {
                    setPerson({
                      personId: row.personId,
                      displayName: row.displayName,
                      email: row.email,
                      relationshipContext: row.relationshipContext,
                    });
                    setPersonQuery(row.displayName);
                    setIntent("existing");
                    setProjectId("");
                  }}
                >
                  <p className="font-serif text-[1.2rem] text-[#efe8de]">{row.displayName}</p>
                  {row.email ? (
                    <p className="mt-1 break-words text-[13.5px] text-[#b7aa9c]">{row.email}</p>
                  ) : row.organizationName ? (
                    <p className="mt-1 text-[13.5px] text-[#b7aa9c]">{row.organizationName}</p>
                  ) : null}
                  {row.relationshipContext ? (
                    <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                      {row.relationshipContext}
                    </p>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}

      {person ? (
        <fieldset className="mt-8 border-0 p-0">
          <legend className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
            Project
          </legend>
          <div className="mt-3 space-y-2">
            {personProjects.map((row) => (
              <label
                key={row.projectId}
                className={`block rounded-[18px] border px-4 py-3 ${
                  intent === "existing" && projectId === row.projectId
                    ? "border-[#ad9164]/50"
                    : "border-white/10"
                }`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  checked={intent === "existing" && projectId === row.projectId}
                  onChange={() => {
                    setIntent("existing");
                    setProjectId(row.projectId);
                  }}
                />
                <span className="text-[15px] text-[#efe8de]">{row.title}</span>
                <span className="mt-1 block text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                  {row.current ? "Current" : "Existing"}
                  {row.lifecycleLabel ? ` · ${row.lifecycleLabel}` : ""}
                </span>
              </label>
            ))}
            <label
              className={`block rounded-[18px] border px-4 py-3 ${
                intent === "new-project" ? "border-[#ad9164]/50" : "border-white/10"
              }`}
            >
              <input
                type="radio"
                className="sr-only"
                checked={intent === "new-project"}
                onChange={() => {
                  setIntent("new-project");
                  setProjectId("");
                }}
              />
              <span className="text-[15px] text-[#efe8de]">+ New project</span>
            </label>
          </div>
        </fieldset>
      ) : (
        <label className="mt-8 block">
          <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
            Project
          </span>
          <input
            type="search"
            value={projectQuery}
            onChange={(event) => setProjectQuery(event.target.value)}
            placeholder="Search projects"
            className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none"
          />
          <select
            value={projectId}
            onChange={(event) => {
              setIntent("existing");
              setProjectId(event.target.value);
            }}
            className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none"
          >
            <option value="">Choose a project</option>
            {filteredProjects.map((project) => (
              <option key={project.projectId} value={project.projectId}>
                {project.title}
              </option>
            ))}
          </select>
        </label>
      )}

      {intent === "new-project" ? (
        <>
          <label className="mt-6 block">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
              Project title
            </span>
            <input
              name="title"
              required
              maxLength={160}
              placeholder="What this piece is"
              className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
            />
          </label>
          <label className="mt-6 block">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
              Project kind
            </span>
            <select
              name="projectKind"
              value={kind}
              onChange={(event) => {
                const next = event.target.value as ProjectKind;
                setKind(next);
                if (next === "repair_service") setLifecycle("intake");
                else if (next === "custom_new_jewelry") setLifecycle("discovery");
                else setLifecycle("");
              }}
              className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none"
            >
              {PROJECT_KINDS.map((row) => (
                <option key={row} value={row}>
                  {PROJECT_KIND_LABELS[row]}
                </option>
              ))}
            </select>
          </label>
          {isLifecycleKind(kind) ? (
            <label className="mt-6 block">
              <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                Lifecycle
              </span>
              <select
                name="lifecycleStage"
                value={lifecycle}
                onChange={(event) => setLifecycle(event.target.value)}
                className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none"
              >
                {stages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stageLabels[stage as keyof typeof stageLabels]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </>
      ) : null}

      {!person && deskPeople.length > 0 && intent === "existing" && projectId ? (
        <label className="mt-6 block">
          <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
            Person on this project
          </span>
          <select
            name="associatedPersonId"
            className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none"
            defaultValue=""
          >
            <option value="">None</option>
            {deskPeople.map((row) => (
              <option key={row.personId} value={row.personId}>
                {row.displayName}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="mt-6 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Action
        </span>
        <input
          name="subject"
          maxLength={160}
          required={intent !== "new-project"}
          placeholder={
            intent === "new-project"
              ? "Optional — only if you need to do something now"
              : "What you actually need to do next"
          }
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </label>

      <label className="mt-6 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Follow-up date
        </span>
        <input
          type="date"
          name="dueAt"
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none"
        />
      </label>

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
      {state?.message &&
      /already proposed|already exists/i.test(state.message) ? (
        <label className="mt-4 flex items-start gap-3 text-[14px] text-[#c4b7aa]">
          <input type="checkbox" name="confirmDuplicate" value="1" className="mt-1" />
          Create anyway
        </label>
      ) : null}

      <div className="hg-concierge-savebar sticky bottom-0 z-10 mt-8 -mx-5 flex gap-3 bg-[#14110f] px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 flex-1 rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none hover:border-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:opacity-50"
        >
          {pending
            ? "Saving…"
            : intent === "new-project"
              ? "Create project"
              : CURRENT_PROJECTS_CREATE_ACTION_LABEL}
        </button>
        <Link
          href={CONCIERGE_HOME_PATH}
          className="inline-flex min-h-12 min-w-[6.5rem] items-center justify-center rounded-[18px] px-4 text-[11px] uppercase tracking-[0.22em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
