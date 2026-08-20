/**
 * Public methodology copy for Ledger System Temperature (hub-only).
 */

export const SYSTEM_TEMPERATURE_METHODOLOGY_VERSION = "system-temperature-v1";

export const SYSTEM_TEMPERATURE_METHODOLOGY_SHORT =
  "System Temperature compresses five underlying pressure channels with explicit transmission caps. Information Signal sets confidence only. It is not an average of the five public monitors, and archived numerical scores are not comparable.";

export const SYSTEM_TEMPERATURE_METHODOLOGY_POINTS = [
  {
    title: "Pressure and transmission are separate",
    body: "External stress can be severe while broader systems remain functional. Transmission into credit, inflation, trade, infrastructure, and real activity determines how much heat enters the reading.",
  },
  {
    title: "Fifty degrees is approximately normal",
    body: "The scale is anchored so ordinary operating conditions sit near 50°. Elevated geopolitics alone should not automatically produce readings in the 80s or 90s.",
  },
  {
    title: "Ninety and above requires systemic transmission",
    body: "Readings at 90°+ require broad or systemic transmission. 95–100° is reserved for confirmed systemic dysfunction — not a dense bad-news cycle.",
  },
  {
    title: "Cooling is mandatory",
    body: "Each review accounts for what improved, normalized, failed to transmit, was absorbed, or faded. Unresolved risks do not add heat every week without a material change.",
  },
] as const;

export const SYSTEM_TEMPERATURE_SCALE_INTRO =
  "How to read the scale — 50° is approximately normal. 95–100° means confirmed critical or systemic dysfunction, not merely alarming headlines.";
