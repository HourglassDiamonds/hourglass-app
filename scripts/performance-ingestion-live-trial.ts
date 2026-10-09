import { interpretPerformanceIntake } from "../lib/continuum/personal/intake-ai";

const targets = { calories: 2400, protein: 190, carbs: 240, fat: 80 };
const inputs = [
  "8 oz Dawg Food chicken blend, 1 tablespoon butter, 2 heads baby bok choy, half a cup of Kevin's cauliflower puree.",
  "Two chicken patties, one cup cooked jasmine rice, a handful of spinach, and about two tablespoons of teriyaki sauce.",
];

async function main() {
  for (const text of inputs) {
    const proposal = await interpretPerformanceIntake({ text, sourceType: "text", nutritionTargets: targets });
    if (proposal.kind !== "meal") throw new Error(`Expected a meal proposal, received ${proposal.kind}`);
    process.stdout.write(`${JSON.stringify({ kind: proposal.kind, summary: proposal.summary, confidence: proposal.confidence, assumptions: proposal.assumptions, totals: { calories: proposal.meal.calories, protein: proposal.meal.protein, carbs: proposal.meal.carbs, fat: proposal.meal.fat }, itemCount: proposal.meal.items.length })}\n`);
  }
}

void main();
