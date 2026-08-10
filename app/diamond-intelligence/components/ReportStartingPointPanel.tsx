"use client";

export default function ReportStartingPointPanel({
  visible,
}: {
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <p className="text-[11px] leading-relaxed text-[#6d655e]">
      A grading report is a starting point — this read uses reported proportions
      and finish, not laboratory imaging.
    </p>
  );
}
