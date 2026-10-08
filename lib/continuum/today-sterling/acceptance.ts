import type { SterlingTodayProposal } from "./types";

export type SterlingAcceptanceCase = { id: string; passed: boolean; actual: string; expected: string };
export type SterlingAcceptanceReport = { passed: boolean; cases: readonly SterlingAcceptanceCase[]; noiseFailures: readonly string[] };

const ALL_TEXT = (item: SterlingTodayProposal["recommendations"][number]) =>
  [item.title, item.summary, item.explanation, item.projectStage.stage, ...item.obligations.map(row => row.description)].filter(Boolean).join(" ");

export function evaluateSterlingTodayAcceptance(proposal: SterlingTodayProposal): SterlingAcceptanceReport {
  const find = (pattern: RegExp) => proposal.recommendations.find(item => pattern.test(ALL_TEXT(item)));
  const cases: SterlingAcceptanceCase[] = [];
  const expect = (id: string, pattern: RegExp, predicate: (item: SterlingTodayProposal["recommendations"][number]) => boolean, expected: string) => {
    const item = find(pattern); const passed = Boolean(item && predicate(item));
    cases.push({ id, passed, actual: item ? `${item.category}/${item.responsibleParty}/${item.projectStage.stage ?? "none"}` : "absent", expected });
  };
  expect("ABBEY/C026137", /\bAbbey\b|C026137/i, item => item.category === "waiting_on_client" && item.responsibleParty === "client", "waiting_on_client/client");
  expect("SARAH/C026143", /\bSarah\b|C026143/i, item => item.category !== "waiting_on_shop" && item.obligations.every(row => !/vendor.*deliver|shop.*deliver/i.test(row.description) || row.status !== "open"), "vendor wait closed; founder review only if evidenced");
  expect("NATHAN", /\bNath?an\b|\bNate\b|C026176/i, item => ["waiting_on_shop", "held_watching"].includes(item.category) && item.responsibleParty === "vendor_shop", "current vendor/shop-held state");
  expect("ALEX/C026510", /\bAlex\b|C026510/i, item => ["waiting_on_shop", "held_watching"].includes(item.category) && item.responsibleParty === "vendor_shop", "stone review closed; vendor/shop-held");
  expect("MADI RUTLEDGE", /Madi\s+Rutledge|\bMadi\b|C026000|C017756/i, item => item.category === "waiting_on_client" && item.responsibleParty === "client", "waiting_on_client/client");
  for (const [id, pattern] of [
    ["DYLAN/C025610", /Dyl[ao]n|C025610/i], ["F. GRANT/C025885", /F\.?\s*Grant|C025885/i],
    ["J. PENNOCK/C025519", /J\.?\s*Pennock|C025519/i], ["DUANE/C026350", /\bDuane\b|C026350/i],
    ["TIM/JENN/C025964", /\bTim\b|\bJenn\b|C025964/i],
  ] as const) expect(id, pattern, item => item.category === "in_production" || item.projectStage.stage === "production", "in_production");

  const noise = /newsletter|editorial|schema fragment|technician notice|shipping boilerplate|cold solicitation/i;
  const noiseFailures = proposal.recommendations
    .filter(item => !item.projectId && ["up_next", "founder_actions", "waiting_on_client", "waiting_on_shop"].includes(item.category) && noise.test(ALL_TEXT(item)))
    .map(item => item.itemId);
  return { passed: cases.every(row => row.passed) && noiseFailures.length === 0, cases, noiseFailures };
}
