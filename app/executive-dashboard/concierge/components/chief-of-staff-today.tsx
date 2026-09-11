import type { CosOperatingLoopView } from "@/lib/continuum/chief-of-staff/operating-loop/types";
import {
  composeTodayDocket,
  cosQueuedLabel,
  type CosDocketItemView,
} from "@/lib/continuum/chief-of-staff/operating-loop/docket";
import { selectFounderControls } from "@/lib/continuum/chief-of-staff/operating-loop/founder-actions";
import { CosCompleteControl } from "./cos-complete-control";
import { CosDocketActions } from "./cos-docket-actions";
import { CosWatchingList } from "./cos-concierge-brief";
import { CosFounderAttentionControls } from "./cos-founder-attention";

type CompleteAction = (formData: FormData) => void | Promise<void>;

function DocketItem({
  item,
  index,
  completeAction,
  reviewAction,
  disposeAction,
}: {
  item: CosDocketItemView;
  index: number;
  completeAction?: CompleteAction;
  reviewAction?: CompleteAction;
  disposeAction?: CompleteAction;
}) {
  const controls = selectFounderControls(item);
  const showCheck =
    Boolean(item.job) &&
    controls.completableJob &&
    (controls.family === "open_job" || controls.family === "generic");
  return (
    <li
      data-cos-docket-item={index}
      data-cos-docket-origin={item.origin}
      data-cos-docket-lane={item.lane}
      data-cos-brief-item={item.brief?.rank}
      data-cos-brief-class={item.brief?.rankClass}
      data-cos-attention-lane={item.decision?.lane}
      data-cos-anomalies={item.origin === "anomaly" ? "" : undefined}
      className="hg-cos-item hg-cos-docket-item min-w-0 overflow-x-hidden"
    >
      {showCheck && item.job ? <CosCompleteControl item={item.job} action={completeAction} /> : null}
      <div className="min-w-0 overflow-x-hidden">
        <p className="break-words text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          {index} · {item.subject}
        </p>
        <p className="mt-2 break-words font-serif text-[1.25rem] leading-[1.18] tracking-[-0.03em] text-[#efe8de]">
          {item.headline}
        </p>
        {item.context ? (
          <p className="hg-cos-brief-explanation hg-cos-docket-context mt-2 break-words text-[14px] leading-relaxed text-[#c4b7aa]">
            {item.context}
          </p>
        ) : null}
        <CosDocketActions item={item} disposeAction={disposeAction} />
        {item.decision ? (
          <CosFounderAttentionControls
            item={item.decision}
            completeAction={completeAction}
            reviewAction={reviewAction}
          />
        ) : null}
      </div>
    </li>
  );
}

export function ChiefOfStaffToday({
  loop,
  completeAction,
  reviewAction,
  disposeAction,
}: {
  loop: CosOperatingLoopView;
  completeAction?: CompleteAction;
  reviewAction?: CompleteAction;
  disposeAction?: CompleteAction;
}) {
  const docket = composeTodayDocket(loop);
  const hasBrief = docket.items.some((item) => item.origin === "brief");
  return (
    <section
      data-cos-operating-loop={loop.status}
      data-cos-docket=""
      data-cos-brief={hasBrief ? "" : undefined}
      className="min-w-0 overflow-x-hidden"
    >
      {docket.showDisconnected ? (
        <>
          <h2 className="sr-only">Today</h2>
          <p className="max-w-[22ch] font-serif text-[1.7rem] font-normal leading-[1.12] tracking-[-0.035em] text-[#efe8de] md:text-[1.9rem]">
            {docket.disconnectedHeading}
          </p>
          {docket.disconnectedDetail ? (
            <p className="mt-4 max-w-[34ch] text-[14px] leading-relaxed text-[#9a8e82]">
              {docket.disconnectedDetail}
            </p>
          ) : null}
        </>
      ) : docket.showCaughtUp ? (
        <>
          <h2 className="sr-only">Today</h2>
          <p className="max-w-[22ch] font-serif text-[1.7rem] font-normal leading-[1.12] tracking-[-0.035em] text-[#efe8de] md:text-[1.9rem]">
            {docket.caughtUpHeading}
          </p>
          {docket.caughtUpDetail ? (
            <p className="mt-4 max-w-[34ch] text-[14px] leading-relaxed text-[#9a8e82]">
              {docket.caughtUpDetail}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
            {docket.title}
          </h2>
          <ol className="hg-cos-docket hg-cos-top5 mt-5">
            {docket.items.map((item, index) => (
              <DocketItem
                key={item.id}
                item={item}
                index={index + 1}
                completeAction={completeAction}
                reviewAction={reviewAction}
                disposeAction={disposeAction}
              />
            ))}
          </ol>
          {docket.queuedCount > 0 ? (
            <p
              data-cos-queued={docket.queuedCount}
              className="mt-5 text-[11px] uppercase tracking-[0.22em] text-[#6f675f]"
            >
              {cosQueuedLabel(docket.queuedCount)}
            </p>
          ) : null}
        </>
      )}
      <CosWatchingList watching={docket.watching} />
    </section>
  );
}
