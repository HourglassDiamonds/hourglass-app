import type { CosRecapItem, CosTop5Item } from "@/lib/continuum/chief-of-staff/operating-loop/types";

type CompleteAction = (formData: FormData) => void | Promise<void>;

export function CosCompleteControl({
  item,
  label,
  action,
}: {
  item: Pick<
    CosTop5Item,
    | "id"
    | "sourceType"
    | "projectId"
    | "mutationId"
    | "action"
    | "completable"
    | "writer"
  >;
  label?: string;
  action?: CompleteAction;
}) {
  if (!item.completable || item.writer !== "open_job.resolve") {
    return (
      <p className="mt-2 max-w-[28ch] text-[13px] leading-relaxed text-[#8d8073]">
        Review only — completion is not available for this item.
      </p>
    );
  }

  return (
    <form action={action} className="flex shrink-0">
      <input type="hidden" name="sourceType" value={item.sourceType} />
      <input type="hidden" name="projectId" value={item.projectId} />
      <input type="hidden" name="jobId" value={item.id} />
      <input type="hidden" name="mutationId" value={item.mutationId} />
      <button
        type="submit"
        aria-label={label ?? `Mark complete: ${item.action}`}
        className="hg-cos-check outline-none"
      />
    </form>
  );
}

export function CosRecapConfirm({
  item,
  action,
}: {
  item: CosRecapItem;
  action?: CompleteAction;
}) {
  if (!item.completable || !item.jobId || !item.projectId || !item.mutationId) {
    return null;
  }
  return (
    <CosCompleteControl
      action={action}
      item={{
        id: item.jobId,
        sourceType: "open_job",
        projectId: item.projectId,
        mutationId: item.mutationId,
        action: item.question,
        completable: true,
        writer: "open_job.resolve",
      }}
      label={`Confirm complete: ${item.question}`}
    />
  );
}
