"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import {
  mutateOpenJobAction,
  type SaveOpenJobState,
} from "../project-jobs-actions";
import { conciergeProjectPath } from "@/lib/continuum/client-memory/read/presentation";
import { OPEN_JOB_ACTORS } from "@/lib/continuum/client-memory/project-jobs/types";
import {
  OPEN_JOB_ACTOR_LABELS,
  OPEN_JOB_KIND_LABELS,
} from "@/lib/continuum/client-memory/project-jobs/present";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";

function dateValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function EditOpenJobForm({
  projectId,
  projectTitle,
  job,
  mutationId,
  people,
}: {
  projectId: string;
  projectTitle: string;
  job: ProjectJob;
  mutationId: string;
  people: Array<{ personId: string; displayName: string }>;
}) {
  const actorId = useId();
  const [updateMutationId] = useState(mutationId);
  const [snoozeMutationId] = useState(() => crypto.randomUUID());
  const [state, formAction, pending] = useActionState(
    mutateOpenJobAction,
    null as SaveOpenJobState,
  );
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state?.message) errorRef.current?.focus();
  }, [state?.message]);

  const canEdit = job.state === "open" || job.state === "snoozed";

  return (
    <div className="flex min-h-[70vh] flex-col">
      <p className="text-[15px] leading-relaxed text-[#c4b7aa]">{projectTitle}</p>
      <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
        {OPEN_JOB_KIND_LABELS[job.kind]}
      </p>

      {canEdit ? (
        <form action={formAction} className="mt-8" noValidate>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="jobId" value={job.jobId} />
          <input type="hidden" name="mutationId" value={updateMutationId} />
          <input type="hidden" name="action" value="update" />
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
              Subject
            </span>
            <input
              name="subject"
              required
              maxLength={160}
              defaultValue={job.subject}
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
              defaultValue={job.detail ?? ""}
              className="mt-2 w-full rounded-[18px] border border-white/10 bg-[#1d1916] px-4 py-3 text-[15px] text-[#efe8de] outline-none"
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
                    defaultChecked={job.waitingOnActor === actor}
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
                defaultValue={job.associatedPersonId ?? ""}
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
              defaultValue={dateValue(job.dueAt)}
              className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="mt-6 inline-flex min-h-12 items-center rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
        </form>
      ) : (
        <p className="mt-8 text-[15px] leading-relaxed text-[#c4b7aa]">
          This job is historical and is no longer editable.
        </p>
      )}

      {canEdit ? (
        <div className="mt-10 space-y-4">
          {job.state === "snoozed" ? (
            <JobActionForm
              projectId={projectId}
              jobId={job.jobId}
              action="unsnooze"
              label="Reactivate"
              pending={pending}
            />
          ) : (
            <form action={formAction} className="space-y-3">
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="jobId" value={job.jobId} />
              <input type="hidden" name="mutationId" value={snoozeMutationId} />
              <input type="hidden" name="action" value="snooze" />
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                  Defer until
                </span>
                <input
                  type="date"
                  name="deferredUntil"
                  required
                  className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex min-h-12 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] disabled:opacity-50"
              >
                Defer
              </button>
            </form>
          )}
          <JobActionForm
            projectId={projectId}
            jobId={job.jobId}
            action="resolve"
            label="Resolve"
            pending={pending}
          />
          <JobActionForm
            projectId={projectId}
            jobId={job.jobId}
            action="cancel"
            label="Cancel job"
            pending={pending}
          />
        </div>
      ) : null}

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

      <Link
        href={conciergeProjectPath(projectId)}
        className="mt-10 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        Back to project
      </Link>
    </div>
  );
}

function JobActionForm({
  projectId,
  jobId,
  action,
  label,
  pending,
}: {
  projectId: string;
  jobId: string;
  action: string;
  label: string;
  pending: boolean;
}) {
  const [mutationId] = useState(() => crypto.randomUUID());
  const [state, formAction, actionPending] = useActionState(
    mutateOpenJobAction,
    null as SaveOpenJobState,
  );
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state?.message) errorRef.current?.focus();
  }, [state?.message]);

  return (
    <form action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="mutationId" value={mutationId} />
      <input type="hidden" name="action" value={action} />
      <button
        type="submit"
        disabled={pending || actionPending}
        className="inline-flex min-h-12 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] disabled:opacity-50"
      >
        {label}
      </button>
      {state?.message ? (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="mt-2 text-[14px] leading-relaxed text-[#d2b8a8] outline-none"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
