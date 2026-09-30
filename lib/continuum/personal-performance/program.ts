export type PerformancePhase = "RE-ENTRY" | "BUILD" | "PERFORM";
export type PerformanceDomain = "strength" | "engine" | "recovery";
export type PerformanceProgramStatus = "prep" | "active" | "complete";

export type PerformanceParameters = {
  startDate: string;
  eventDate: string;
  timeZone: string;
  durationWeeks: number;
  body: {
    startingWeightLb: number;
    targetWeightLb: number;
  };
  nutrition: {
    dailyCalories: number;
    dailyProteinG: number;
  };
};

export const PERFORMANCE_PARAMETERS: PerformanceParameters = {
  startDate: "2026-10-05",
  eventDate: "2026-12-19",
  timeZone: "America/New_York",
  durationWeeks: 12,
  body: {
    startingWeightLb: 217,
    targetWeightLb: 197,
  },
  nutrition: {
    dailyCalories: 2400,
    dailyProteinG: 190,
  },
};

export type PerformanceProgramPosition = {
  status: PerformanceProgramStatus;
  week: number | null;
  phase: PerformancePhase | null;
  startsInDays: number;
};

export type ExercisePrescription = {
  name: string;
  prescription: string;
};

export type DayPrescription = {
  day: string;
  domain: PerformanceDomain;
  title: string;
  summary: string;
  duration: string;
  recovery: string;
  exercises: readonly ExercisePrescription[];
};

const DAY_MS = 86_400_000;

function dateKeyToUtc(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function daysBetween(fromDateKey: string, toDateKey: string): number {
  return Math.floor((dateKeyToUtc(toDateKey) - dateKeyToUtc(fromDateKey)) / DAY_MS);
}

export function dateKeyInTimeZone(
  date: Date,
  timeZone = PERFORMANCE_PARAMETERS.timeZone,
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function phaseForWeek(week: number): PerformancePhase {
  if (week <= 4) return "RE-ENTRY";
  if (week <= 8) return "BUILD";
  return "PERFORM";
}

export function programPositionForDate(dateKey: string): PerformanceProgramPosition {
  const elapsedDays = daysBetween(PERFORMANCE_PARAMETERS.startDate, dateKey);
  if (elapsedDays < 0) {
    return {
      status: "prep",
      week: null,
      phase: null,
      startsInDays: Math.abs(elapsedDays),
    };
  }

  const week = Math.min(
    PERFORMANCE_PARAMETERS.durationWeeks,
    Math.floor(elapsedDays / 7) + 1,
  );
  const programDays = PERFORMANCE_PARAMETERS.durationWeeks * 7;
  return {
    status: elapsedDays >= programDays ? "complete" : "active",
    week,
    phase: phaseForWeek(week),
    startsInDays: 0,
  };
}

export function programWeekForDate(dateKey: string): number | null {
  return programPositionForDate(dateKey).week;
}

export function dayIndexForDate(dateKey: string): number {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay();
}

function saturdayProgression(
  week: number,
): Pick<DayPrescription, "title" | "summary" | "duration"> {
  const progressions = [
    [
      "Run / walk 1:2",
      "Eight easy rounds: run 1 minute, walk 2. Finish wanting one more round.",
      "28 min",
    ],
    [
      "Run / walk 1:1",
      "Eight easy rounds: run 90 seconds, walk 90 seconds. Keep the run conversational.",
      "28 min",
    ],
    [
      "Run / walk 2:1",
      "Eight easy rounds: run 2 minutes, walk 1 minute. No pace target.",
      "30 min",
    ],
    [
      "Run / walk 3:1",
      "Six easy rounds: run 3 minutes, walk 1 minute. Smooth, never strained.",
      "30 min",
    ],
    [
      "Easy continuous run",
      "Run 20 minutes continuously at a pace where full sentences still work.",
      "30 min",
    ],
    [
      "Easy run + strides",
      "Run easy for 22 minutes, then add four relaxed 15-second strides.",
      "32 min",
    ],
    [
      "Long easy run",
      "Run 25 minutes continuously. Walk breaks remain available if form or breathing changes.",
      "32 min",
    ],
    [
      "5K foundation",
      "Cover 3 km at easy effort, then walk 5 minutes to cool down.",
      "35–40 min",
    ],
    [
      "Long easy run",
      "Run 32 minutes at even, conversational effort. Do not add distance to prove readiness.",
      "38 min",
    ],
    [
      "Comfortable 4K rehearsal",
      "Cover 4 km continuously at controlled effort. This is rehearsal, not a time trial.",
      "40–45 min",
    ],
    [
      "Christmas 5K",
      "Complete 5 km at an even, comfortable effort. Start easier than feels necessary.",
      "5 km",
    ],
    [
      "Post-race aerobic reset",
      "Walk, easy Peloton, or lightly jog for 25 minutes. Keep this restorative.",
      "25 min",
    ],
  ] as const;
  const [title, summary, duration] = progressions[Math.min(11, Math.max(0, week - 1))];
  return { title, summary, duration };
}

function prepPrescription(dateKey: string): DayPrescription {
  const day = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(
    new Date(`${dateKey}T12:00:00Z`),
  );
  return {
    day,
    domain: "recovery",
    title: "Prepare the runway",
    summary:
      "The program has not started. Take an easy walk, protect sleep, and reserve Monday’s training window—no need to get ahead.",
    duration: "10–20 min",
    recovery: "Arrive at October 5 rested. Prep does not count toward adherence.",
    exercises: [],
  };
}

function completedProgramPrescription(dateKey: string): DayPrescription {
  const day = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(
    new Date(`${dateKey}T12:00:00Z`),
  );
  return {
    day,
    domain: "recovery",
    title: "Twelve weeks complete",
    summary: "Review the trend and choose the next block from current capability, not old expectations.",
    duration: "Review",
    recovery: "Keep moving easily while the next plan is chosen.",
    exercises: [],
  };
}

export function prescriptionForDate(dateKey: string): DayPrescription {
  const position = programPositionForDate(dateKey);
  if (position.status === "prep") return prepPrescription(dateKey);
  if (position.status === "complete") return completedProgramPrescription(dateKey);

  const week = position.week ?? 1;
  const phase = position.phase ?? "RE-ENTRY";
  const reEntry = phase === "RE-ENTRY";
  const strengthDose =
    phase === "RE-ENTRY"
      ? "2 sets · RPE 6"
      : phase === "BUILD"
        ? "3 sets · RPE 7"
        : "3 sets · RPE 7–8";
  const schedules: Record<number, DayPrescription> = {
    0: {
      day: "Sunday",
      domain: "recovery",
      title: "Rest",
      summary: "No training debt to repay. A walk is optional if it feels restorative.",
      duration: "Off",
      recovery: "Set up Monday: choose a training window and get to bed on time.",
      exercises: [],
    },
    1: {
      day: "Monday",
      domain: "strength",
      title: "Foundation A",
      summary: "Full-body strength with controlled reps and room in reserve.",
      duration: reEntry ? "35 min" : "45 min",
      recovery: "Stop each set with at least 3 clean reps in reserve during re-entry.",
      exercises: [
        { name: "Tonal goblet squat", prescription: `${strengthDose} · 8 reps` },
        { name: "Tonal bench press", prescription: `${strengthDose} · 8 reps` },
        { name: "Assisted pull-up / pulldown", prescription: `${strengthDose} · 6–8 reps` },
        { name: "Dead bug", prescription: "2 sets · 6 / side" },
      ],
    },
    2: {
      day: "Tuesday",
      domain: "strength",
      title: "Foundation B",
      summary: "Hinge, pull, press, and trunk work without grinding.",
      duration: reEntry ? "35 min" : "45 min",
      recovery: "Use a range of motion you can control. No missed reps.",
      exercises: [
        { name: "Tonal Romanian deadlift", prescription: `${strengthDose} · 8 reps` },
        { name: "Half-kneeling row", prescription: `${strengthDose} · 8 / side` },
        { name: "Incline push-up", prescription: `${strengthDose} · 8–12 reps` },
        { name: "Side plank", prescription: "2 sets · 20 sec / side" },
      ],
    },
    3: {
      day: "Wednesday",
      domain: "engine",
      title: reEntry ? "Easy 20 lb ruck" : "Easy aerobic base",
      summary: reEntry
        ? "Walk with the 20 lb ruck at an easy, conversational effort. Leave the 90 lb ruck parked."
        : "Easy Peloton, jog, or 20 lb ruck at a conversational effort.",
      duration: reEntry ? "25 min" : "35 min",
      recovery:
        "Keep breathing easy enough to speak in full sentences; finish fresher than you started.",
      exercises: [],
    },
    4: {
      day: "Thursday",
      domain: "strength",
      title: "Foundation A · repeat",
      summary: "Repeat Monday and make only small load changes when every rep stayed clean.",
      duration: reEntry ? "35 min" : "45 min",
      recovery: "Progress one variable only: a little load, one rep, or cleaner control.",
      exercises: [
        { name: "Tonal goblet squat", prescription: `${strengthDose} · 8 reps` },
        { name: "Tonal bench press", prescription: `${strengthDose} · 8 reps` },
        { name: "Assisted pull-up / pulldown", prescription: `${strengthDose} · 6–8 reps` },
        { name: "Dead bug", prescription: "2 sets · 6 / side" },
      ],
    },
    5: {
      day: "Friday",
      domain: "strength",
      title: "Upper + trunk",
      summary: "Train upper body and trunk while keeping the legs fresh for Saturday’s progression.",
      duration: reEntry ? "30 min" : "40 min",
      recovery: "No lower-body finishers today. Keep Saturday’s run legs intact.",
      exercises: [
        { name: "Tonal overhead press", prescription: `${strengthDose} · 8 reps` },
        { name: "Half-kneeling row", prescription: `${strengthDose} · 8 / side` },
        { name: "Incline push-up", prescription: `${strengthDose} · 8–12 reps` },
        { name: "Pallof press", prescription: "2 sets · 8 / side" },
      ],
    },
    6: {
      day: "Saturday",
      domain: "engine",
      ...saturdayProgression(week),
      recovery:
        "Keep every run segment conversational. Walking is part of the prescription when listed.",
      exercises: [],
    },
  };
  return schedules[dayIndexForDate(dateKey)];
}

export function weekDateKeys(dateKey: string): string[] {
  const utc = dateKeyToUtc(dateKey);
  const dayIndex = dayIndexForDate(dateKey);
  const mondayOffset = dayIndex === 0 ? -6 : 1 - dayIndex;
  return Array.from({ length: 7 }, (_, index) =>
    new Date(utc + (mondayOffset + index) * DAY_MS).toISOString().slice(0, 10),
  );
}
