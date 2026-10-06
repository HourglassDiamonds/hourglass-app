import type { CosTodayDocketView } from "./docket";
import type { ClientWebsiteIntake } from "@/lib/continuum/client-memory/read/website-intake";
import { websiteIntakeWhatMatters } from "@/lib/continuum/client-memory/read/website-intake-presentation";

export function composeBusinessTodayContext(input: {
  docket: CosTodayDocketView;
  intakes: readonly ClientWebsiteIntake[];
  nowIso: string;
}): string {
  const sectionLines = (input.docket.sections ?? []).flatMap((section) =>
    section.items.flatMap((item) => {
      const packet = item.packet;
      const identity = [item.projectId ? `project=${item.projectId}` : null, item.jobId ? `job=${item.jobId}` : null]
        .filter(Boolean)
        .join(", ");
      const lines = [
        `- ${section.title}: ${item.title} — ${item.summary} [state=${item.stateLabel}; holder=${item.ballHolder ?? "unknown"}${item.lifecycle ? `; lifecycle=${item.lifecycle}` : ""}${identity ? `; ${identity}` : ""}]`,
      ];
      if (packet?.latestMeaningfulExternalEvent?.summary) {
        lines.push(`  Latest external evidence: ${packet.latestMeaningfulExternalEvent.summary}`);
      }
      if (packet?.latestMeaningfulFounderAction?.summary) {
        lines.push(`  Latest founder evidence: ${packet.latestMeaningfulFounderAction.summary}`);
      }
      for (const event of (packet?.sourceEvents ?? []).slice(-3)) {
        lines.push(`  Recent material event: ${event.timestamp} ${event.semanticClass} — ${event.evidenceExcerpt}`);
      }
      return lines;
    }),
  );
  const lines = [
    `Current time: ${input.nowIso}`,
    "Up Next:",
    ...input.docket.items.map((item) =>
      `- ${item.subject}: ${item.semanticPresentation?.founderCheckpoint || item.headline}`,
    ),
    "Current operating sections:",
    ...sectionLines,
    ...input.intakes.map((intake) =>
      `- Concierge Intake: ${intake.fullName} — ${websiteIntakeWhatMatters(intake)} — submitted ${intake.submittedAt}`,
    ),
  ];
  return lines.join("\n").slice(0, 12_000);
}
