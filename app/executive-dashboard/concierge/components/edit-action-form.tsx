"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import {
  saveFounderEditAction,
  type SaveOpenJobState,
} from "../project-jobs-actions";
import { CONCIERGE_HOME_PATH } from "@/lib/continuum/client-memory/read/presentation";
import { parseDateOnly } from "@/lib/continuum/date-only";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";

export type FounderEditPersonOption = {
  personId: string;
  displayName: string;
};

export function EditActionForm({
  job,
  projectTitle,
  people,
  mutationId,
}: {
  job: ProjectJob;
  projectTitle: string;
  people: FounderEditPersonOption[];
  mutationId: string;
}) {
  const [state, formAction, pending] = useActionState(
    saveFounderEditAction,
    null as SaveOpenJobState,
  );
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state?.message) errorRef.current?.focus();
  }, [state?.message]);

  return (
    <form action={formAction} className="flex min-h-[70vh] flex-col" noValidate>
      <input type="hidden" name="mutationId" value={mutationId} />
      <input type="hidden" name="projectId" value={job.projectId} />
      <input type="hidden" name="jobId" value={job.jobId} />

      <label className="mt-8 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Action
        </span>
        <input
          name="subject"
          required
          maxLength={160}
          defaultValue={job.subject}
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </label>

      <p className="mt-6">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Project
        </span>
        <span className="mt-2 block min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 py-3 text-[15px] text-[#efe8de]">
          {projectTitle}
        </span>
        <span className="mt-2 block max-w-[42ch] text-[13px] leading-relaxed text-[#8d8073]">
          Project stays on this Open Job so the same action is not duplicated elsewhere.
        </span>
      </p>

      {people.length > 0 ? (
        <label className="mt-6 block">
          <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
            Person
          </span>
          <select
            name="associatedPersonId"
            defaultValue={job.associatedPersonId ?? ""}
            className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none"
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
          defaultValue={parseDateOnly(job.dueAt) ?? ""}
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
          {pending ? "Saving…" : "Save"}
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
