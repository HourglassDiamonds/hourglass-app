import type { CosBriefingV1 } from "@/lib/continuum/chief-of-staff/operating-loop/cos-briefing-v1";

export function CosBriefingBlock({ briefing }: { briefing: CosBriefingV1 }) {
  return (
    <div
      data-cos-briefing-model={briefing.modelId}
      data-cos-current-action={briefing.currentFounderAction ? "true" : "false"}
    >
      <p className="mt-2 break-words font-serif text-[1.15rem] leading-[1.25] tracking-[-0.02em] text-[#efe8de]">
        {briefing.currentState}
      </p>
      {briefing.timingProse ? (
        <p className="mt-2 break-words text-[14px] leading-relaxed text-[#c4b7aa]">
          {briefing.timingProse}
        </p>
      ) : null}
      <div className="mt-3 min-w-0" data-cos-checkpoint={briefing.checkpoint?.status ?? "advisory"}>
        <p className="text-[10px] uppercase tracking-[0.18em] text-[#8d8073]">My checkpoint</p>
        <p className="mt-1 break-words text-[14px] leading-relaxed text-[#d8cfc4]">
          {briefing.checkpointProse}
        </p>
      </div>
      {briefing.why ? (
        <p className="mt-2 break-words text-[13px] leading-relaxed text-[#9a8e82]">{briefing.why}</p>
      ) : null}
    </div>
  );
}
