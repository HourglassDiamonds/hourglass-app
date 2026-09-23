import { greetingLine } from "@/lib/continuum/dashboard/compose";
import type { ContinuumHomeModel } from "@/lib/continuum/dashboard/types";
import type { CosOperatingLoopView } from "@/lib/continuum/chief-of-staff/operating-loop/types";
import { composeTodayDocket } from "@/lib/continuum/chief-of-staff/operating-loop/docket";
import { ChiefOfStaffToday } from "./chief-of-staff-today";
import type { TodayAskAction } from "./cos-ask-concierge";
import type { TodayUpcomingItem } from "@/lib/continuum/calendar/today-upcoming";

type CompleteAction = (formData: FormData) => void | Promise<void>;

export function CommandCenterHome({
  model,
  operatingLoop,
  docket,
  completeAction,
  reviewAction,
  disposeAction,
  askAction,
  upcoming = [],
}: {
  model: ContinuumHomeModel;
  operatingLoop?: CosOperatingLoopView;
  docket?: ReturnType<typeof composeTodayDocket>;
  completeAction?: CompleteAction;
  reviewAction?: CompleteAction;
  disposeAction?: CompleteAction;
  askAction?: TodayAskAction;
  upcoming?: readonly TodayUpcomingItem[];
}) {
  const resolved = docket ?? (operatingLoop ? composeTodayDocket(operatingLoop) : null);
  if (!resolved) return null;
  return (
    <div data-command-center data-today-home className="hg-today">
      <h1 className="font-serif text-[2.05rem] font-normal leading-[1.08] tracking-[-0.045em] text-[#efe8de] md:text-[2.45rem]">
        {greetingLine(model)}
      </h1>
      <ChiefOfStaffToday
        docket={resolved}
        completeAction={completeAction}
        reviewAction={reviewAction}
        disposeAction={disposeAction}
        askAction={askAction}
        upcoming={upcoming}
      />
    </div>
  );
}
