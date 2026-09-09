import { greetingLine } from "@/lib/continuum/dashboard/compose";
import type { ContinuumHomeModel } from "@/lib/continuum/dashboard/types";
import type { CosOperatingLoopView } from "@/lib/continuum/chief-of-staff/operating-loop/types";
import { ChiefOfStaffToday } from "./chief-of-staff-today";

type CompleteAction = (formData: FormData) => void | Promise<void>;

export function CommandCenterHome({
  model,
  operatingLoop,
  completeAction,
  reviewAction,
}: {
  model: ContinuumHomeModel;
  operatingLoop: CosOperatingLoopView;
  completeAction?: CompleteAction;
  reviewAction?: CompleteAction;
}) {
  return (
    <div data-command-center data-today-home className="hg-today">
      <h1 className="font-serif text-[2.05rem] font-normal leading-[1.08] tracking-[-0.045em] text-[#efe8de] md:text-[2.45rem]">
        {greetingLine(model)}
      </h1>
      <ChiefOfStaffToday
        loop={operatingLoop}
        completeAction={completeAction}
        reviewAction={reviewAction}
      />
    </div>
  );
}
