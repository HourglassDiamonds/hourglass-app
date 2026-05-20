export function deltaPercentage(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function formatDeltaLine(delta: number | null, unit = "%"): string {
  if (delta === null) return "New vs prior week";
  const sign = delta > 0 ? "+" : "";
  const rounded =
    Math.abs(delta) >= 10
      ? Math.round(delta)
      : Math.round(delta * 10) / 10;
  return `${sign}${rounded}${unit} vs prior week`;
}

export function semanticStatus(
  delta: number | null,
  opts?: { invert?: boolean },
): "Accelerating" | "Stable" | "Cooling" | "Emerging" | "Watch" {
  if (delta === null) return "Emerging";
  const d = opts?.invert ? -delta : delta;
  if (d >= 8) return "Accelerating";
  if (d <= -8) return "Cooling";
  if (d <= -3) return "Watch";
  return "Stable";
}

export function formatInteger(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}

export function capitalizeShape(shape: string): string {
  if (!shape) return "—";
  return shape.charAt(0).toUpperCase() + shape.slice(1);
}
