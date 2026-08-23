import { reviewIndicatorLabel } from "@/lib/continuum/client-memory/read/presentation";

export function ReviewIndicator({ openCount }: { openCount: number }) {
  const label = reviewIndicatorLabel(openCount);
  if (!label) return null;
  return (
    <p className="text-[11px] uppercase tracking-[0.22em] text-[#ad9164]">
      {label}
    </p>
  );
}
