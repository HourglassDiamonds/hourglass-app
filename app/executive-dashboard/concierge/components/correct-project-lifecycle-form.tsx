"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef } from "react";
import {
  saveProjectLifecycleCorrection,
  type SaveProjectLifecycleCorrectionState,
} from "../actions";
import { conciergeProjectPath } from "@/lib/continuum/client-memory/read/presentation";
import {
  PROJECT_LIFECYCLE_CLEAR_LABEL,
  lifecycleStageLabel,
  stagesForLifecycleKind,
  type LifecycleKind,
} from "@/lib/continuum/client-memory/project-lifecycle";

export function CorrectProjectLifecycleForm({
  projectId,
  projectTitle,
  projectKind,
  currentStage,
  mutationId,
}: {
  projectId: string;
  projectTitle: string;
  projectKind: LifecycleKind;
  currentStage: string | null;
  mutationId: string;
}) {
  const groupId = useId();
  const [state, formAction, pending] = useActionState(
    saveProjectLifecycleCorrection,
    null as SaveProjectLifecycleCorrectionState | null,
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
        Lifecycle
      </p>
      <p className="mt-3 text-[15px] leading-relaxed text-[#e7ddd2]">
        Current: {lifecycleStageLabel(projectKind, currentStage)}
      </p>

      <fieldset className="mt-8 flex-1" aria-describedby={groupId}>
        <legend
          id={groupId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          Choose a stage
        </legend>
        <div className="hg-project-kind-choice mt-3">
          {stagesForLifecycleKind(projectKind).map((stage) => (
            <label key={stage}>
              <input
                type="radio"
                name="newValue"
                value={stage}
                defaultChecked={currentStage === stage}
              />
              <span className="min-w-0 break-words text-[15px] leading-relaxed">
                {lifecycleStageLabel(projectKind, stage)}
              </span>
            </label>
          ))}
          <label>
            <input
              type="radio"
              name="newValue"
              value=""
              defaultChecked={currentStage == null}
            />
            <span className="min-w-0 break-words text-[15px] leading-relaxed">
              {PROJECT_LIFECYCLE_CLEAR_LABEL}
            </span>
          </label>
        </div>
      </fieldset>

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
          {pending ? "Saving…" : "Save correction"}
        </button>
        <Link
          href={conciergeProjectPath(projectId)}
          className="inline-flex min-h-12 min-w-[6.5rem] items-center justify-center rounded-[18px] px-4 text-[11px] uppercase tracking-[0.22em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
