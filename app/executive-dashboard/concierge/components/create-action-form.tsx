"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  saveFounderAction,
  type SaveOpenJobState,
} from "../project-jobs-actions";
import { CONCIERGE_HOME_PATH } from "@/lib/continuum/client-memory/read/presentation";
import {
  CURRENT_PROJECTS_ADD_ACTION_LABEL,
  CURRENT_PROJECTS_CREATE_ACTION_LABEL,
} from "@/lib/continuum/client-memory/open-projects/present";

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
  const initial =
    selectedProjectId && projects.some((row) => row.projectId === selectedProjectId)
      ? selectedProjectId
      : (projects[0]?.projectId ?? "");
  const [projectId, setProjectId] = useState(initial);
  const [state, formAction, pending] = useActionState(
    saveFounderAction,
    null as SaveOpenJobState,
  );
  const errorRef = useRef<HTMLParagraphElement>(null);
  const people = useMemo(
    () => projects.find((row) => row.projectId === projectId)?.people ?? [],
    [projectId, projects],
  );

  useEffect(() => {
    if (state?.message) errorRef.current?.focus();
  }, [state?.message]);

  if (projects.length === 0) {
    return (
      <p className="max-w-[42ch] text-[15px] leading-relaxed text-[#c4b7aa]">
        No projects are available to attach this action to.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex min-h-[70vh] flex-col" noValidate>
      <input type="hidden" name="mutationId" value={mutationId} />
      <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
        {CURRENT_PROJECTS_ADD_ACTION_LABEL}
      </p>
      <p className="mt-3 max-w-[42ch] text-[15px] leading-relaxed text-[#c4b7aa]">
        This becomes an Open Job on the chosen Project and can appear in Today.
      </p>

      <label className="mt-8 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Action
        </span>
        <input
          name="subject"
          required
          maxLength={160}
          placeholder="What you actually need to do next"
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </label>

      <label className="mt-6 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Project
        </span>
        <select
          name="projectId"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none"
        >
          {projects.map((project) => (
            <option key={project.projectId} value={project.projectId}>
              {project.title}
            </option>
          ))}
        </select>
      </label>

      {people.length > 0 ? (
        <label className="mt-6 block">
          <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
            Person
          </span>
          <select
            key={projectId}
            name="associatedPersonId"
            className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none"
            defaultValue=""
          >
            <option value="">None</option>
            {people.map((person) => (
              <option key={person.personId} value={person.personId}>
                {person.displayName}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="associatedPersonId" value="" />
      )}

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

      <div className="hg-concierge-savebar sticky bottom-0 z-10 mt-8 -mx-5 flex gap-3 bg-[#14110f] px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 flex-1 rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none hover:border-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:opacity-50"
        >
          {pending ? "Saving…" : CURRENT_PROJECTS_CREATE_ACTION_LABEL}
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
