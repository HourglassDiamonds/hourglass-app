"use client";

import { DashboardCard } from "./DashboardCard";

export default function LookingDeeperPanel({
  visible,
}: {
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <DashboardCard title="Looking Deeper" tone="subdued" className="!p-4 md:!p-5">
      <p className="text-sm leading-[1.7] text-[#5f5851]">
        For diamonds being seriously considered, additional review can provide
        greater confidence. Depending on the stone, this may include direct
        expert review, video analysis, eye-clean verification, or optical
        imaging such as ASET or IdealScope when available.
      </p>
      <p className="mt-2.5 text-[12px] leading-[1.6] text-[#948a80]">
        Not every diamond needs every step — the right review depends on what
        you are deciding.
      </p>
    </DashboardCard>
  );
}
