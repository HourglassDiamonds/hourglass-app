"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef } from "react";
import {
  saveOpenJob,
  type SaveOpenJobState,
} from "../project-jobs-actions";
import { conciergeProjectPath } from "@/lib/continuum/client-memory/read/presentation";
import {
  OPEN_JOB_ACTORS,
  OPEN_JOB_KINDS,
} from "@/lib/continuum/client-memory/project-jobs/types";
import {
  OPEN_JOB_ACTOR_LABELS,
  OPEN_JOB_KIND_LABELS,
} from "@/lib/continuum/client-memory/project-jobs/present";

export function AddOpenJobForm({
  projectId,
  projectTitle,
  mutationId,
  people,
}: {
  projectId: string;
  projectTitle: string;
  mutationId: string;
  people: Array<{ personId: string; displayName: string }>;
}) {
  const groupId = useId();
  const actorId = useId();
  const [state, formAction, pending] = useActionState(
    saveOpenJob,
    null as SaveOpenJobState,
  );
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state?.message) errorRef.current?.focus();
  }, [state?.message]);

  return (
    <form action={formAction} className="flex min-h-[70vh] flex-col" noValidate>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="mutationId" value={mutationId} />
      <p className="text-[15px] leading-relaxed text-[#c4b7aa]">{projectTitle}</p>
      <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
        Manual record
      </p>

      <fieldset className="mt-8" aria-describedby={groupId}>
        <legend
          id={groupId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          Kind
        </legend>
        <div className="hg-project-kind-choice mt-3">
          {OPEN_JOB_KINDS.map((kind) => (
            <label key={kind}>
              <input type="radio" name="kind" value={kind} defaultChecked={kind === "request"} />
              <span className="min-w-0 break-words text-[15px] leading-relaxed">
                {OPEN_JOB_KIND_LABELS[kind]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-8 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Subject
        </span>
        <input
          name="subject"
          required
          maxLength={160}
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </label>

      <label className="mt-6 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Detail
        </span>
        <textarea
          name="detail"
          rows={4}
          maxLength={2000}
          className="mt-2 w-full rounded-[18px] border border-white/10 bg-[#1d1916] px-4 py-3 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </label>

      <fieldset className="mt-8">
        <legend
          id={actorId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          Actor
        </legend>
        <div className="hg-project-kind-choice mt-3">
          {OPEN_JOB_ACTORS.map((actor) => (
            <label key={actor}>
              <input
                type="radio"
                name="waitingOnActor"
                value={actor}
                defaultChecked={actor === "founder"}
              />
              <span className="min-w-0 break-words text-[15px] leading-relaxed">
                {OPEN_JOB_ACTOR_LABELS[actor]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {people.length > 0 ? (
        <label className="mt-8 block">
          <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
            Person
          </span>
          <select
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
      ) : null}

      <label className="mt-6 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Due
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
          {pending ? "Saving…" : "Save open job"}
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
