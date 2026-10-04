"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import {
  isTodayItemVisible,
  transitionTodayMutationPhase,
} from "./today-optimistic-state";

export type TodayMutationResult =
  | { ok: true }
  | { ok: false; message: string };

export type TodayMutationAction = (
  formData: FormData,
) => TodayMutationResult | Promise<TodayMutationResult>;

type RetryState =
  | { kind: "form"; action: TodayMutationAction; formData: FormData; message: string }
  | { kind: "directive"; run: () => Promise<void>; message: string }
  | null;

type TodayMutationContextValue = {
  completeAction?: (formData: FormData) => Promise<void>;
  disposeAction?: (formData: FormData) => Promise<void>;
  failure: RetryState;
  retry: () => void;
  beginDirective: () => void;
  succeedDirective: () => void;
  restoreDirective: () => void;
  failDirective: (message: string, retry: () => Promise<void>) => void;
};

const TodayMutationContext = createContext<TodayMutationContextValue | null>(null);

function copyFormData(source: FormData): FormData {
  const copy = new FormData();
  source.forEach((value, key) => copy.append(key, value));
  return copy;
}

export function TodayOptimisticItem({
  children,
  completeAction,
  disposeAction,
}: {
  children: ReactNode;
  completeAction?: TodayMutationAction;
  disposeAction?: TodayMutationAction;
}) {
  const [phase, dispatch] = useReducer(transitionTodayMutationPhase, "visible");
  const [failure, setFailure] = useState<RetryState>(null);

  const run = useCallback(async (action: TodayMutationAction, formData: FormData) => {
    const retryFormData = copyFormData(formData);
    setFailure(null);
    dispatch({ type: "begin" });
    try {
      const result = await action(formData);
      if (!result.ok) {
        setFailure({ kind: "form", action, formData: retryFormData, message: result.message });
        dispatch({ type: "fail" });
        return;
      }
      dispatch({ type: "succeed" });
    } catch {
      setFailure({
        kind: "form",
        action,
        formData: retryFormData,
        message: "Unable to save that change. Try again.",
      });
      dispatch({ type: "fail" });
    }
  }, []);

  const value = useMemo<TodayMutationContextValue>(() => ({
    completeAction: completeAction
      ? async (formData) => run(completeAction, formData)
      : undefined,
    disposeAction: disposeAction
      ? async (formData) => run(disposeAction, formData)
      : undefined,
    failure,
    beginDirective: () => { setFailure(null); dispatch({ type: "begin" }); },
    succeedDirective: () => dispatch({ type: "succeed" }),
    restoreDirective: () => dispatch({ type: "fail" }),
    failDirective: (message, retry) => {
      setFailure({ kind: "directive", message, run: retry });
      dispatch({ type: "fail" });
    },
    retry: () => {
      if (!failure) return;
      startTransition(() => {
        void (failure.kind === "form"
          ? run(failure.action, copyFormData(failure.formData))
          : failure.run());
      });
    },
  }), [completeAction, disposeAction, failure, run]);

  return (
    <TodayMutationContext.Provider value={value}>
      {isTodayItemVisible(phase) ? children : null}
    </TodayMutationContext.Provider>
  );
}

export function useTodayMutationActions() {
  return useContext(TodayMutationContext);
}

export function TodayMutationFailure() {
  const mutation = useTodayMutationActions();
  if (!mutation?.failure) return null;
  return (
    <div
      role="alert"
      data-today-mutation-failure=""
      className="mt-3 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-[10px] border border-[#9f5b52]/40 bg-[#9f5b52]/10 px-3 py-2"
    >
      <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-[#e7c8c3]">
        {mutation.failure.message}
      </p>
      <button
        type="button"
        onClick={mutation.retry}
        className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#efe8de] outline-none"
      >
        Retry
      </button>
    </div>
  );
}

export function TodayDispositionForm({
  verb,
  label,
  itemId,
  projectId,
  jobId,
  mutationId,
}: {
  verb: string;
  label: string;
  itemId: string;
  projectId?: string | null;
  jobId?: string | null;
  mutationId?: string | null;
}) {
  const mutation = useTodayMutationActions();
  return (
    <form action={mutation?.disposeAction} className="inline">
      <input type="hidden" name="verb" value={verb} />
      <input type="hidden" name="origin" value="open_job" />
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="projectId" value={projectId ?? ""} />
      <input type="hidden" name="jobId" value={jobId ?? ""} />
      <input type="hidden" name="candidateIds" value="" />
      <input type="hidden" name="mutationId" value={mutationId ?? ""} />
      <button
        type="submit"
        className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#ad9164] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        {label}
      </button>
    </form>
  );
}
