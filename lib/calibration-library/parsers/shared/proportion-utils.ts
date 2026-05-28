export function formatProportionNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}

export function fixNumericOcr(s: string): string {
  return s
    .replace(/(\d)O\.(\d)/gi, "$10.$2")
    .replace(/(\d)O(\d)/gi, "$10$2")
    .replace(/(\d)O\b/gi, "$10")
    .replace(/\bO(\d)/g, "0$1");
}

export function pickCanonical(
  values: number[],
  used: Set<number>,
  target: number,
  tolerance: number,
): number | undefined {
  const hit = values.find(
    (n) => !used.has(n) && Math.abs(n - target) <= tolerance,
  );
  if (hit === undefined) return undefined;
  used.add(hit);
  return hit;
}

export function pickInRange(
  values: number[],
  used: Set<number>,
  lo: number,
  hi: number,
): number | undefined {
  const hits = values.filter((n) => n >= lo && n <= hi && !used.has(n));
  if (hits.length === 1) {
    used.add(hits[0]!);
    return hits[0];
  }
  return undefined;
}

export function assignPercentRole(
  pcts: number[],
  used: Set<number>,
  target: number,
  tolerance: number,
  rangeLo: number,
  rangeHi: number,
): string | undefined {
  const canonical = pickCanonical(pcts, used, target, tolerance);
  if (canonical !== undefined) return formatProportionNum(canonical);
  const ranged = pickInRange(pcts, used, rangeLo, rangeHi);
  return ranged !== undefined ? formatProportionNum(ranged) : undefined;
}

export function assignDegreeRole(
  degs: number[],
  used: Set<number>,
  target: number,
  tolerance: number,
  rangeLo: number,
  rangeHi: number,
): string | undefined {
  const canonical = pickCanonical(degs, used, target, tolerance);
  if (canonical !== undefined) return formatProportionNum(canonical);
  const ranged = pickInRange(degs, used, rangeLo, rangeHi);
  return ranged !== undefined ? formatProportionNum(ranged) : undefined;
}

export type ProportionNumericCandidates = {
  percents: number[];
  degrees: number[];
  mmValues: number[];
};

export function collectProportionNumericCandidates(
  preparedText: string,
): ProportionNumericCandidates {
  const percents: number[] = [];
  const degrees: number[] = [];
  const mmValues: number[] = [];

  if (!preparedText) return { percents, degrees, mmValues };

  for (const m of preparedText.matchAll(/(?<![\d.])(\d{1,3}(?:\.\d+)?)\s*%/gi)) {
    const n = parseFloat(fixNumericOcr(m[1]!));
    if (!Number.isNaN(n)) percents.push(n);
  }

  for (const m of preparedText.matchAll(
    /(?<![\d.])(\d{1,3}(?:\.\d+)?)\s*(?:°|H)/gi,
  )) {
    const n = parseFloat(fixNumericOcr(m[1]!));
    if (!Number.isNaN(n) && n >= 20 && n <= 50) degrees.push(n);
  }

  for (const m of preparedText.matchAll(/(?<![\d.])(0\.\d{1,2})\s*mm\b/gi)) {
    const n = parseFloat(m[1]!);
    if (!Number.isNaN(n)) mmValues.push(n);
  }

  return { percents, degrees, mmValues };
}
