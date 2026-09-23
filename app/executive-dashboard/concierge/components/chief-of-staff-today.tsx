import type { CosOperatingLoopView } from "@/lib/continuum/chief-of-staff/operating-loop/types";
import {
  authoritativeTodayDocket,
  composeTodayDocket,
  COS_DOCKET_TITLE,
  cosQueuedLabel,
  TODAY_DOCKET_VERSION,
  type CosDocketItemView,
  type CosTodayDocketView,
} from "@/lib/continuum/chief-of-staff/operating-loop/docket";
import { selectFounderControls } from "@/lib/continuum/chief-of-staff/operating-loop/founder-actions";
import { composeEmailCard } from "@/lib/continuum/chief-of-staff/operating-loop/email-viewer";
import type { TodayRenderedBriefing } from "@/lib/continuum/chief-of-staff/operating-loop/briefing-copy";
import { CosCompleteControl } from "./cos-complete-control";
import { CosDocketActions } from "./cos-docket-actions";
import { CosWatchingList } from "./cos-concierge-brief";
import { CosFounderAttentionControls } from "./cos-founder-attention";
import { CosUnassignedIdentity } from "./cos-unassigned-identity";
import { CosAskConcierge, type TodayAskAction } from "./cos-ask-concierge";
import { CosBriefingBlock } from "./cos-briefing-block";
import { presentCosFeedback } from "@/lib/continuum/cos-feedback/feedback";

type CompleteAction = (formData: FormData) => void | Promise<void>;

function BriefingHeader({
  name,
  chip,
}: {
  name: string;
  chip: string | null;
}) {
  return (
    <div className="hg-cos-briefing-kicker flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <p className="min-w-0 break-words font-serif text-[1.05rem] leading-snug tracking-[-0.02em] text-[#efe8de]">
        {name}
      </p>
      {chip ? (
        <p className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-[#ad9164]">
          {chip}
        </p>
      ) : null}
    </div>
  );
}

function BriefingBody({ briefing }: { briefing: TodayRenderedBriefing }) {
  return (
    <>
      <p className="mt-2 break-words font-serif text-[1.28rem] leading-[1.2] tracking-[-0.03em] text-[#efe8de]">
        {briefing.headline}
      </p>
      <p className="hg-cos-brief-explanation hg-cos-docket-context mt-2 break-words text-[14px] leading-relaxed text-[#c4b7aa]">
        {briefing.stand}
      </p>
      <div className="hg-cos-briefing-next mt-3 min-w-0">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[#8d8073]">
          {briefing.nextLabel}
        </p>
        <p className="mt-1 break-words text-[14px] leading-relaxed text-[#d8cfc4]">
          {briefing.nextBody}
        </p>
      </div>
    </>
  );
}

function DocketItem({
  item,
  index,
  completeAction,
  reviewAction,
  disposeAction,
  askAction,
}: {
  item: CosDocketItemView;
  index: number;
  completeAction?: CompleteAction;
  reviewAction?: CompleteAction;
  disposeAction?: CompleteAction;
  askAction?: TodayAskAction;
}) {
  const controls = selectFounderControls(item);
  const emailCard = composeEmailCard(item, controls.emailSources);
  const showCheck =
    Boolean(item.job) &&
    controls.completableJob &&
    (controls.family === "open_job" || controls.family === "generic");
  const briefing = item.briefing;
  const packet = item.briefingPacket ?? item.brief?.briefingPacket ?? null;
  return (
    <li
      data-cos-docket-item={index}
      data-cos-docket-origin={item.origin}
      data-cos-docket-lane={item.lane}
      data-cos-brief-item={item.brief?.rank}
      data-cos-brief-class={item.brief?.rankClass}
      data-cos-attention-lane={item.decision?.lane}
      data-cos-anomalies={item.origin === "anomaly" ? "" : undefined}
      data-cos-ball={briefing ? item.brief?.briefingPacket?.ballHolder : undefined}
      className="hg-cos-item hg-cos-docket-item min-w-0 overflow-x-hidden"
    >
      {showCheck && item.job ? <CosCompleteControl item={item.job} action={completeAction} /> : null}
      <div className="min-w-0 overflow-x-hidden">
        <BriefingHeader
          name={briefing ? [briefing.displayName, briefing.projectName].filter((row, i, all) => row && all.indexOf(row) === i).join(" / ") : item.subject}
          chip={briefing?.stateChip ?? (item.origin === "open_job" ? "YOUR MOVE" : null)}
        />
        {item.cosBriefing && briefing ? (
          <CosBriefingBlock briefing={item.cosBriefing} />
        ) : briefing ? (
          <BriefingBody briefing={briefing} />
        ) : (
          <>
            <p className="mt-2 break-words font-serif text-[1.25rem] leading-[1.18] tracking-[-0.03em] text-[#efe8de]">
              {item.headline}
            </p>
            {emailCard ? <CosUnassignedIdentity card={emailCard} /> : null}
            {item.context && !emailCard?.excerpt ? (
              <p className="hg-cos-brief-explanation hg-cos-docket-context mt-2 break-words text-[14px] leading-relaxed text-[#c4b7aa]">
                {item.context}
              </p>
            ) : null}
          </>
        )}
        {packet ? (
          <CosAskConcierge packet={packet} cosBriefing={item.cosBriefing ?? null} askAction={askAction} />
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
  docket: incomingDocket,
  completeAction,
  reviewAction,
  disposeAction,
  askAction,
}: {
  loop?: CosOperatingLoopView;
  docket?: CosTodayDocketView;
  completeAction?: CompleteAction;
  reviewAction?: CompleteAction;
  disposeAction?: CompleteAction;
  askAction?: TodayAskAction;
}) {
  const docket = authoritativeTodayDocket(
    incomingDocket ?? (loop ? composeTodayDocket(loop) : {
      todayDocketVersion: TODAY_DOCKET_VERSION,
      title: COS_DOCKET_TITLE,
      items: [],
      queuedCount: 0,
      watchingCount: 0,
      watching: [],
      showCaughtUp: true,
      showDisconnected: false,
      caughtUpHeading: "",
      caughtUpDetail: null,
      disconnectedHeading: null,
      disconnectedDetail: null,
    }),
  );
  const hasBrief = docket.items.some((item) => item.origin === "brief");
  const loopStatus = loop?.status
    ?? (docket.showDisconnected ? "disconnected" : docket.showCaughtUp ? "caught-up" : "active");
  const feedback = docket.showDisconnected
    ? null
    : presentCosFeedback({
        docket,
        sourceWatermark: loop?.todayReadModelWatermark ?? null,
        nowIso: new Date().toISOString(),
      });
  const waiting = feedback?.safeToIgnore.map((item) => item.why).filter((why, index, all) => all.indexOf(why) === index) ?? [];
  return (
    <section
      data-cos-operating-loop={loopStatus}
      data-cos-docket=""
      data-cos-brief={hasBrief ? "" : undefined}
      className="min-w-0 overflow-x-hidden"
    >
      {feedback ? (
        <div data-cos-feedback className="mb-6 max-w-[46ch]">
          <p className="break-words text-[14px] leading-relaxed text-[#d8cfc4]">
            {feedback.founderGuidance}
          </p>
          {waiting.length > 0 ? (
            <p className="mt-2 break-words text-[13px] leading-relaxed text-[#9a8e82]">
              {waiting.join(" ")}
            </p>
          ) : null}
        </div>
      ) : null}
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
                askAction={askAction}
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
      <CosWatchingList watching={docket.watching} askAction={askAction} />
    </section>
  );
}
