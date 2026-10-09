"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { applySterlingProposal, deferAndReflow, proposeSterlingAdjustment } from "@/lib/continuum/personal/adaptation";
import { createInitialPersonalState, dateKey, shiftDate } from "@/lib/continuum/personal/program";
import { proposeProgression } from "@/lib/continuum/personal/progression";
import { migrateLegacyPersonalState, parsePersonalState } from "@/lib/continuum/personal/state";
import { deriveFrequentlyEaten, frequentFromMeal, logFrequentMeal, mealName, mealSignature, type FrequentMealCandidate } from "@/lib/continuum/personal/nutrition";
import { acceptProposal, buildAcceptedActivity, buildAcceptedMeal } from "@/lib/continuum/personal/mutations";
import type { ActivityFacts, ActivityLog, FrequentMeal, MealEstimate, MealItem, MealLog, NaturalIngestionProposal, PerformedSet, PerformanceSourceType, PersonalState, RecoveryEntry, ScheduledWorkout, SterlingProposal, WorkoutSession } from "@/lib/continuum/personal/types";
import styles from "./performance.module.css";

const STORAGE_KEY = "continuum.personal.performance.v3";
const PREVIOUS_STORAGE_KEY = "continuum.personal.performance.v2";
const LEGACY_STORAGE_KEY = "continuum.personal.v1";
type View = "today" | "nutrition" | "recovery" | "week" | "progress";

function uid(prefix: string): string { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function numberOrUndefined(value: FormDataEntryValue | null): number | undefined {
  if (value === null || String(value).trim() === "") return undefined;
  const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined;
}
function localToday(): string { return dateKey(new Date()); }
function prettyDate(key: string): string { return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${key}T12:00:00`)); }
function totals(items: readonly MealItem[]) { return items.reduce((sum, item) => ({ calories: sum.calories + item.calories, protein: sum.protein + item.protein, carbs: sum.carbs + item.carbs, fat: sum.fat + item.fat }), { calories: 0, protein: 0, carbs: 0, fat: 0 }); }

async function compactImage(file: File): Promise<File> {
  if (file.size <= 900_000) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
  return blob ? new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }) : file;
}

export function PerformanceApp({ initialView = "today" }: { initialView?: View }) {
  const [today, setToday] = useState(localToday);
  const [state, setState] = useState<PersonalState>(() => createInitialPersonalState(localToday()));
  const [ready, setReady] = useState(false);
  const view = initialView;
  const [sterlingText, setSterlingText] = useState("");
  const [sterlingProposal, setSterlingProposal] = useState<SterlingProposal | null>(null);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [deferOpen, setDeferOpen] = useState(false);
  const [mealEstimate, setMealEstimate] = useState<MealEstimate | null>(null);
  const [mealPhoto, setMealPhoto] = useState<{ name: string; type: string; size: number } | null>(null);
  const [mealBusy, setMealBusy] = useState(false);
  const [mealError, setMealError] = useState("");
  const [lastAddedMealId, setLastAddedMealId] = useState<string | null>(null);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [editingFrequentId, setEditingFrequentId] = useState<string | null>(null);
  const [intakeText, setIntakeText] = useState("");
  const [intakeProposal, setIntakeProposal] = useState<NaturalIngestionProposal | null>(null);
  const [intakeFile, setIntakeFile] = useState<File | null>(null);
  const [intakeBusy, setIntakeBusy] = useState(false);
  const [persistStatus, setPersistStatus] = useState<"loading" | "saved" | "saving" | "browser" | "conflict" | "error">("loading");
  const [revision, setRevision] = useState(0);
  const persistInFlight = useRef(false);

  useEffect(() => {
    const key = localToday(); setToday(key);
    let next: PersonalState;
    try {
      const current = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(PREVIOUS_STORAGE_KEY);
      next = current ? parsePersonalState(current, key) : migrateLegacyPersonalState(window.localStorage.getItem(LEGACY_STORAGE_KEY), key) ?? createInitialPersonalState(key);
    } catch { next = createInitialPersonalState(key); }
    void (async () => {
      try {
        const response = await fetch(`/executive-dashboard/concierge/personal/state?today=${encodeURIComponent(key)}`, { cache: "no-store" });
        const payload = await response.json() as { ok: boolean; state?: PersonalState | null; revision?: number };
        if (response.ok && payload.ok && payload.state) { setState(parsePersonalState(JSON.stringify(payload.state), key)); setRevision(payload.revision ?? 0); setPersistStatus("saved"); }
        else { setState(next); setPersistStatus(response.status === 503 ? "browser" : "error"); }
      } catch { setState(next); setPersistStatus("browser"); }
      setReady(true);
    })();
  }, []);
  useEffect(() => { if (ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [ready, state]);

  const activeToday = state.schedule.find((workout) => workout.date === today && !["completed", "deferred", "skipped", "replaced"].includes(workout.status));
  const activeSession = activeToday ? state.sessions.find((session) => session.scheduledWorkoutId === activeToday.id && !session.completedAt) : undefined;
  const latestRecovery = state.recoveryEntries.find((entry) => entry.date === today);
  const todayMeals = state.meals.filter((meal) => (meal.occurredOn ?? meal.timestamp.slice(0, 10)) === today);
  const nutrition = totals(todayMeals.flatMap((meal) => meal.items));
  const week = state.schedule.filter((workout) => workout.date >= shiftDate(today, -6) && workout.date <= shiftDate(today, 8));
  const weights = state.recoveryEntries.filter((entry) => entry.bodyweightLb).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const weekStart = shiftDate(today, -((new Date(`${today}T12:00:00`).getDay() + 6) % 7));
  const weekEnd = shiftDate(weekStart, 6);
  const thisWeekMeals = state.meals.filter((meal) => (meal.occurredOn ?? meal.timestamp.slice(0, 10)) >= weekStart && (meal.occurredOn ?? meal.timestamp.slice(0, 10)) <= weekEnd);
  const loggedDays = new Set(thisWeekMeals.map((meal) => meal.occurredOn ?? meal.timestamp.slice(0, 10))).size;
  const weekNutrition = totals(thisWeekMeals.flatMap((meal) => meal.items));
  const frequentlyEaten = deriveFrequentlyEaten(state.meals, state.frequentMeals);
  const todayActivities = state.activities.filter((activity) => activity.occurredOn === today);

  async function persistStateMutation(next: PersonalState, mutation: Record<string, unknown>, source?: File): Promise<PersonalState> {
    setPersistStatus("saving"); persistInFlight.current = true;
    const init: RequestInit = { method: source ? "POST" : "PUT" };
    if (source) {
      const body = new FormData(); body.set("state", JSON.stringify(next)); body.set("mutation", JSON.stringify(mutation)); body.set("expectedRevision", String(revision)); body.set("source", source); init.body = body;
    } else {
      init.headers = { "Content-Type": "application/json" }; init.body = JSON.stringify({ state: next, mutation, expectedRevision: revision });
    }
    try {
      const response = await fetch("/executive-dashboard/concierge/personal/state", init);
      const payload = await response.json() as { ok: boolean; state?: PersonalState; revision?: number; error?: string };
      if (response.status === 409) {
        if (payload.state) setState(parsePersonalState(JSON.stringify(payload.state), today));
        setRevision(payload.revision ?? 0); setPersistStatus("conflict"); throw new Error("performance-revision-conflict");
      }
      if (!response.ok || !payload.ok || !payload.state) { setPersistStatus(response.status === 503 ? "browser" : "error"); throw new Error(payload.error ?? "performance-save-failed"); }
      setRevision(payload.revision ?? revision + 1); setPersistStatus("saved"); return parsePersonalState(JSON.stringify(payload.state), today);
    } finally { persistInFlight.current = false; }
  }

  useEffect(() => {
    if (!ready || persistInFlight.current) return;
    const timer = window.setTimeout(() => {
      void persistStateMutation(state, { idempotencyKey: uid("snapshot"), action: "snapshot" }).catch(() => undefined);
    }, 350);
    return () => window.clearTimeout(timer);
    // Persist each canonical state transition; the accepted-ingestion path also performs a synchronous idempotent commit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, state]);

  function updateWorkout(id: string, updater: (workout: ScheduledWorkout) => ScheduledWorkout) {
    setState((current) => ({ ...current, schedule: current.schedule.map((workout) => workout.id === id ? updater(workout) : workout) }));
  }

  function startWorkout(workout: ScheduledWorkout) {
    const at = new Date().toISOString();
    const session: WorkoutSession = { id: uid("session"), scheduledWorkoutId: workout.id, startedAt: at, sets: [] };
    setState((current) => ({
      ...current,
      sessions: [...current.sessions, session],
      schedule: current.schedule.map((item) => item.id === workout.id ? { ...item, status: "in_progress", history: [...item.history, { at, action: "started", actor: "user", note: "Workout started." }], provenance: [...new Set([...item.provenance, "user" as const])] } : item),
    }));
  }

  function updateSet(exerciseId: string, setNumber: number, patch: Partial<PerformedSet>) {
    if (!activeSession) return;
    setState((current) => ({ ...current, sessions: current.sessions.map((session) => {
      if (session.id !== activeSession.id) return session;
      const prior = session.sets.find((set) => set.exerciseId === exerciseId && set.setNumber === setNumber);
      const base: PerformedSet = prior ?? { id: uid("set"), exerciseId, setNumber, reps: 0, completed: false, skipped: false, pain: false };
      return { ...session, sets: [...session.sets.filter((set) => !(set.exerciseId === exerciseId && set.setNumber === setNumber)), { ...base, ...patch }] };
    }) }));
  }

  function completeWorkout() {
    if (!activeSession || !activeToday) return;
    const at = new Date().toISOString();
    const proposals = activeToday.prescription.exercises.map((exercise) => proposeProgression(exercise, activeSession.sets.filter((set) => set.exerciseId === exercise.id)));
    setState((current) => ({
      ...current,
      sessions: current.sessions.map((session) => session.id === activeSession.id ? { ...session, completedAt: at } : session),
      schedule: current.schedule.map((workout) => workout.id === activeToday.id ? { ...workout, status: "completed", history: [...workout.history, { at, action: "completed", actor: "user", note: "Workout completed and progression reviewed." }] } : workout),
      progressionProposals: [...current.progressionProposals, ...proposals],
    }));
  }

  function saveModification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!activeToday) return;
    const data = new FormData(event.currentTarget); const at = new Date().toISOString();
    updateWorkout(activeToday.id, (workout) => ({ ...workout, prescription: { ...workout.prescription, name: String(data.get("name") || workout.prescription.name).slice(0, 100), durationMinutes: Math.max(5, Math.min(180, Number(data.get("duration")) || workout.prescription.durationMinutes)), notes: String(data.get("notes") || workout.prescription.notes).slice(0, 400) }, provenance: [...new Set([...workout.provenance, "user" as const])], history: [...workout.history, { at, action: "modified", actor: "user", note: "Today’s occurrence was modified; program identity remains attached." }] }));
    setModifyOpen(false);
  }

  function deferWorkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!activeToday) return;
    const target = String(new FormData(event.currentTarget).get("date") || shiftDate(today, 1));
    setState((current) => ({ ...current, schedule: deferAndReflow(current.schedule, activeToday.id, target) })); setDeferOpen(false);
  }

  function skipWorkout() {
    if (!activeToday) return; const at = new Date().toISOString();
    updateWorkout(activeToday.id, (workout) => ({ ...workout, status: "skipped", provenance: [...new Set([...workout.provenance, "user" as const])], history: [...workout.history, { at, action: "skipped", actor: "user", note: "This occurrence was consciously skipped; it is retained in history and not treated as an accidental failure." }] }));
  }

  function swapWorkout(workoutId: string) {
    const at = new Date().toISOString();
    updateWorkout(workoutId, (workout) => {
      const alternative = workout.prescription.alternative;
      if (!alternative) return workout;
      const currentAlternative = {
        name: workout.prescription.name,
        domain: workout.prescription.domain,
        mode: workout.prescription.mode,
        intent: workout.prescription.intent,
        durationMinutes: workout.prescription.durationMinutes,
        notes: workout.prescription.notes,
        lowerBodyLoad: workout.prescription.lowerBodyLoad,
        exercises: workout.prescription.exercises,
      };
      return {
        ...workout,
        prescription: { ...alternative, id: workout.prescription.id, trainingBlock: workout.prescription.trainingBlock, alternative: currentAlternative },
        provenance: [...new Set([...workout.provenance, "user" as const])],
        history: [...workout.history, { at, action: "modified", actor: "user", note: `Swapped to equivalent session: ${alternative.name}.` }],
      };
    });
  }

  function askSterling(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const proposal = proposeSterlingAdjustment(state, sterlingText, today);
    setSterlingProposal(proposal);
  }

  function confirmSterling() {
    if (!sterlingProposal) return; setState((current) => applySterlingProposal(current, sterlingProposal)); setSterlingProposal(null); setSterlingText("");
  }

  function saveRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const at = new Date().toISOString();
    const metric = <T,>(value: T | undefined, source: "manual" | "subjective") => value === undefined || value === "" ? undefined : { value, source };
    const entry: RecoveryEntry = {
      id: uid("recovery"), date: today, recordedAt: at,
      sleepHours: metric(numberOrUndefined(data.get("sleepHours")), "manual"), sleepQuality: metric(numberOrUndefined(data.get("sleepQuality")), "subjective"),
      recoveryScore: metric(numberOrUndefined(data.get("recoveryScore")), "manual"), strain: metric(numberOrUndefined(data.get("strain")), "manual"),
      restingHeartRate: metric(numberOrUndefined(data.get("restingHeartRate")), "manual"), hrvMs: metric(numberOrUndefined(data.get("hrvMs")), "manual"),
      bodyweightLb: metric(numberOrUndefined(data.get("bodyweightLb")), "manual"),
      fatigue: metric((String(data.get("fatigue") || "") || undefined) as RecoveryEntry["fatigue"] extends { value: infer T } | undefined ? T | undefined : never, "subjective"),
      soreness: metric((String(data.get("soreness") || "") || undefined) as "none" | "mild" | "moderate" | "high" | undefined, "subjective"),
      pain: metric((String(data.get("pain") || "") || undefined) as "none" | "mild" | "moderate" | "high" | undefined, "subjective"),
      notes: String(data.get("notes") || "").trim().slice(0, 600) || undefined, provenance: ["manual_recovery", "user_confirmed"],
    };
    setState((current) => ({ ...current, recoveryEntries: [entry, ...current.recoveryEntries.filter((item) => item.date !== today)] }));
  }

  async function analyzeIntake(input: { text?: string; file?: File; sourceType: PerformanceSourceType }) {
    setMealBusy(true); setIntakeBusy(true); setMealError(""); setMealEstimate(null); setIntakeProposal(null);
    try {
      if (input.file && input.file.size > 4 * 1024 * 1024) throw new Error("invalid-image");
      const image = input.file ? await compactImage(input.file) : undefined; const body = new FormData();
      if (image) body.set("image", image); if (input.text?.trim()) body.set("text", input.text.trim()); body.set("sourceType", input.sourceType);
      body.set("knownMeals", JSON.stringify(frequentlyEaten.map((meal) => `${meal.name}: ${meal.calories} kcal, ${meal.protein}P, ${meal.carbs}C, ${meal.fat}F`)));
      body.set("nutritionTargets", JSON.stringify(state.nutritionTargets));
      const response = await fetch("/executive-dashboard/concierge/personal/intake", { method: "POST", body });
      const payload = await response.json() as { ok: boolean; proposal?: NaturalIngestionProposal; error?: string };
      if (!response.ok || !payload.ok || !payload.proposal) throw new Error(payload.error || "analysis-failed");
      setIntakeFile(input.file ?? null); setIntakeProposal(payload.proposal);
      if (payload.proposal.kind === "meal") { setMealPhoto(input.file ? { name: input.file.name, type: input.file.type, size: input.file.size } : null); setMealEstimate(payload.proposal.meal); }
    } catch (error) { setMealError(error instanceof Error && error.message === "performance-analysis-unavailable" ? "Sterling interpretation is not configured. Manual logging remains available." : error instanceof Error && error.message === "invalid-image" ? "Use a JPEG, PNG, WebP, or GIF no larger than 4 MB." : "Sterling could not interpret that input just now. Review the input and retry."); }
    finally { setMealBusy(false); setIntakeBusy(false); }
  }

  function chooseMealPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (file) void analyzeIntake({ text: intakeText, file, sourceType: "meal_photo" });
  }

  function submitMealDescription(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (intakeText.trim()) void analyzeIntake({ text: intakeText, sourceType: "text" }); }
  function chooseNutritionLabel(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; event.target.value = ""; if (file) void analyzeIntake({ text: intakeText, file, sourceType: "nutrition_label" }); }
  function chooseActivityScreenshot(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; event.target.value = ""; if (file) void analyzeIntake({ file, sourceType: "activity_screenshot" }); }

  function updateMealItem(id: string, patch: Partial<MealItem>) { setMealEstimate((estimate) => estimate ? { ...estimate, items: estimate.items.map((item) => item.id === id ? { ...item, ...patch } : item) } : null); }
  async function acceptMeal(mealType?: MealLog["mealType"]) {
    if (!mealEstimate || intakeProposal?.kind !== "meal") return;
    const idempotencyKey = `accept-${intakeProposal.id}`; const at = new Date().toISOString();
    const meal = buildAcceptedMeal({ proposal: intakeProposal, items: mealEstimate.items, mealType, occurredOn: today, timestamp: at, id: uid("meal"), idempotencyKey, source: mealPhoto ?? undefined });
    const next = acceptProposal(state, intakeProposal, meal);
    try {
      const saved = await persistStateMutation(next, { idempotencyKey, action: "accept_meal", entryId: meal.id, rawInput: intakeProposal.rawInput, sourceType: intakeProposal.sourceType, proposal: intakeProposal, accepted: meal, corrections: meal.corrections }, intakeFile ?? undefined);
      setState(saved); setMealEstimate(null); setMealPhoto(null); setIntakeProposal(null); setIntakeFile(null); setIntakeText("");
    } catch { setMealError("The reviewed meal was not saved. Nothing was added; retry when private persistence is available."); }
  }

  async function acceptActivity(facts: ActivityFacts, occurredOn: string) {
    if (intakeProposal?.kind !== "activity") return;
    const idempotencyKey = `accept-${intakeProposal.id}`; const at = new Date().toISOString();
    const activity = buildAcceptedActivity({ proposal: intakeProposal, facts, occurredOn, timestamp: at, id: uid("activity"), idempotencyKey, source: intakeFile ? { name: intakeFile.name, type: intakeFile.type, size: intakeFile.size } : undefined, targets: state.nutritionTargets });
    const next = acceptProposal(state, intakeProposal, activity);
    try {
      const saved = await persistStateMutation(next, { idempotencyKey, action: "accept_activity", entryId: activity.id, rawInput: intakeProposal.rawInput, sourceType: intakeProposal.sourceType, proposal: intakeProposal, accepted: activity, corrections: activity.corrections }, intakeFile ?? undefined);
      setState(saved); setIntakeProposal(null); setIntakeFile(null); setMealError("");
    } catch { setMealError("The reviewed activity was not saved. Nothing was added; retry when private persistence is available."); }
  }

  async function rejectIntake() {
    if (!intakeProposal) return;
    const proposal = intakeProposal; setIntakeProposal(null); setMealEstimate(null); setMealPhoto(null); setIntakeFile(null);
    try { await persistStateMutation(state, { idempotencyKey: `reject-${proposal.id}`, action: "reject_proposal", rawInput: proposal.rawInput, sourceType: proposal.sourceType, proposal }); } catch { /* Rejection still changes no canonical totals. */ }
  }

  async function deleteSource(kind: "meal" | "activity", entryId: string) {
    setPersistStatus("saving"); persistInFlight.current = true;
    try {
      const response = await fetch("/executive-dashboard/concierge/personal/state", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: revision, entryId, kind, idempotencyKey: uid("delete-source") }) });
      const payload = await response.json() as { ok: boolean; state?: PersonalState; revision?: number; error?: string };
      if (response.status === 409) {
        if (payload.state) setState(parsePersonalState(JSON.stringify(payload.state), today));
        setRevision(payload.revision ?? 0); setPersistStatus("conflict"); return;
      }
      if (!response.ok || !payload.ok || !payload.state) throw new Error(payload.error ?? "performance-source-delete-failed");
      setState(parsePersonalState(JSON.stringify(payload.state), today)); setRevision(payload.revision ?? revision + 1); setPersistStatus("saved");
    } catch { setPersistStatus("error"); setMealError("The private source file could not be deleted. No structured entry was removed."); }
    finally { persistInFlight.current = false; }
  }

  function saveManualMeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const name = String(data.get("name") || "").trim(); if (!name) return;
    const item: MealItem = { id: uid("manual-item"), name, portion: String(data.get("portion") || "").trim(), calories: Number(data.get("calories")) || 0, protein: Number(data.get("protein")) || 0, carbs: Number(data.get("carbs")) || 0, fat: Number(data.get("fat")) || 0, confidence: "high" };
    const meal: MealLog = { id: uid("meal"), timestamp: new Date().toISOString(), mealType: (String(data.get("mealType") || "") || undefined) as MealLog["mealType"], items: [item], calories: item.calories, protein: item.protein, carbs: item.carbs, fat: item.fat, provenance: ["user_confirmed"] };
    setState((current) => ({ ...current, meals: [meal, ...current.meals] })); form.reset();
  }

  function saveAsFrequent(meal: MealLog) {
    const next = frequentFromMeal(meal);
    setState((current) => {
      const existing = current.frequentMeals.find((item) => item.signature === next.signature);
      const saved = existing ? { ...next, id: existing.id, createdAt: existing.createdAt } : next;
      return { ...current, frequentMeals: [saved, ...current.frequentMeals.filter((item) => item.signature !== next.signature)] };
    });
  }

  function storeFrequent(frequent: FrequentMealCandidate, patch: Partial<FrequentMeal>) {
    const now = new Date().toISOString();
    setState((current) => {
      const base: FrequentMeal = current.frequentMeals.find((item) => item.signature === frequent.signature) ?? {
        id: frequent.id, signature: frequent.signature, name: frequent.name, mealType: frequent.mealType, items: frequent.items,
        calories: frequent.calories, protein: frequent.protein, carbs: frequent.carbs, fat: frequent.fat,
        pinned: frequent.pinned, hidden: frequent.hidden, createdAt: frequent.createdAt, updatedAt: frequent.updatedAt,
      };
      const next = { ...base, ...patch, updatedAt: now };
      return { ...current, frequentMeals: [next, ...current.frequentMeals.filter((item) => item.signature !== frequent.signature)] };
    });
  }

  function oneTapLog(frequent: FrequentMealCandidate) {
    const id = uid("meal"); const meal = logFrequentMeal(frequent, new Date().toISOString(), id);
    setState((current) => ({ ...current, meals: [meal, ...current.meals] })); setLastAddedMealId(id); setEditingMealId(null);
  }

  function undoLastMeal() {
    if (!lastAddedMealId) return;
    setState((current) => ({ ...current, meals: current.meals.filter((meal) => meal.id !== lastAddedMealId) })); setLastAddedMealId(null); setEditingMealId(null);
  }

  function updateMealOccurrence(mealId: string, itemId: string, patch: Partial<MealItem>) {
    setState((current) => ({ ...current, meals: current.meals.map((meal) => {
      if (meal.id !== mealId) return meal;
      const items = meal.items.map((item) => item.id === itemId ? { ...item, ...patch } : item); return { ...meal, items, ...totals(items) };
    }) }));
  }

  function updateFrequentDefault(frequent: FrequentMealCandidate, itemId: string, patch: Partial<MealItem>) {
    const items = frequent.items.map((item) => item.id === itemId ? { ...item, ...patch } : item);
    storeFrequent(frequent, { name: mealName(items), items, ...totals(items) });
  }

  function resolveProgression(id: string, status: "accepted" | "rejected" | "edited") {
    setState((current) => {
      const proposal = current.progressionProposals.find((item) => item.id === id);
      let proposedLoad = proposal?.proposedLoad;
      if (status === "edited" && proposal) {
        const input = window.prompt("Proposed load for next time (blank keeps bodyweight/reps)", proposal.proposedLoad?.toString() ?? "");
        if (input === null) return current;
        proposedLoad = input.trim() ? Number(input) : undefined;
        if (proposedLoad !== undefined && !Number.isFinite(proposedLoad)) return current;
      }
      const schedule = status === "accepted" && proposal ? current.schedule.map((workout) => ({ ...workout, prescription: { ...workout.prescription, exercises: workout.prescription.exercises.map((exercise) => exercise.id === proposal.exerciseId ? { ...exercise, targetLoad: proposedLoad ?? exercise.targetLoad } : exercise) } })) : current.schedule;
      return { ...current, schedule, progressionProposals: current.progressionProposals.map((item) => item.id === id ? { ...item, proposedLoad, status } : item) };
    });
  }

  const tabs: { id: View; label: string; href: string }[] = [
    { id: "today", label: "Today", href: "/executive-dashboard/concierge/personal" },
    { id: "week", label: "Workouts", href: "/executive-dashboard/concierge/personal/workouts" },
    { id: "nutrition", label: "Nutrition", href: "/executive-dashboard/concierge/personal/food" },
    { id: "recovery", label: "Recovery", href: "/executive-dashboard/concierge/personal/recovery" },
    { id: "progress", label: "Progress", href: "/executive-dashboard/concierge/personal/progress" },
  ];
  if (!ready) return <main className={styles.app}><section className={styles.card}>Opening Performance…</section></main>;

  return <main className={styles.app} data-personal-performance>
    <header className={styles.header}><div><p className={styles.eyebrow}>Personal / Performance</p><h1>Tell Sterling what happened. Keep the plan alive.</h1><p>Daily training, recovery, and nutrition with explicit decisions and durable context.</p></div><span className={styles.private}>Private · {persistStatus === "saved" ? "saved" : persistStatus === "saving" ? "saving…" : persistStatus === "browser" ? "browser fallback" : persistStatus === "conflict" ? "refreshed after conflict" : persistStatus}</span></header>
    <nav className={styles.tabs} aria-label="Performance sections">{tabs.map((tab) => <Link key={tab.id} href={tab.href} aria-current={view === tab.id ? "page" : undefined}>{tab.label}</Link>)}</nav>

    {view === "today" ? <div className={styles.stack}>
      <section className={`${styles.card} ${styles.hero}`}>
        <div className={styles.cardTop}><div><p className={styles.kicker}>{prettyDate(today)} · {activeToday?.status.replace("_", " ") ?? "resolved"}</p><h2>{activeToday?.prescription.name ?? "Today is resolved"}</h2></div>{activeToday ? <span>{activeToday.prescription.durationMinutes} min</span> : null}</div>
        {activeToday ? <><p>{activeToday.prescription.notes}</p><p className={styles.provenance}>Planned by {activeToday.prescription.trainingBlock} · {activeToday.provenance.join(" · ")}</p>
          {activeSession ? <WorkoutLogger workout={activeToday} session={activeSession} onSet={updateSet} onComplete={completeWorkout} /> : <div className={styles.actions}><button className={styles.primary} onClick={() => startWorkout(activeToday)}>Start</button><button onClick={() => setModifyOpen((open) => !open)}>Modify today</button><button onClick={() => setDeferOpen((open) => !open)}>Defer</button><button onClick={skipWorkout}>Skip</button>{activeToday.prescription.alternative ? <button onClick={() => swapWorkout(activeToday.id)}>Swap equivalent</button> : null}</div>}
          {modifyOpen ? <form className={styles.editPanel} onSubmit={saveModification}><label>Name<input name="name" defaultValue={activeToday.prescription.name} /></label><label>Minutes<input name="duration" type="number" min="5" max="180" defaultValue={activeToday.prescription.durationMinutes} /></label><label>Notes<textarea name="notes" defaultValue={activeToday.prescription.notes} /></label><button className={styles.primary}>Save today’s modification</button></form> : null}
          {deferOpen ? <form className={styles.editPanel} onSubmit={deferWorkout}><label>Move to<input name="date" type="date" min={shiftDate(today, 1)} defaultValue={shiftDate(today, 1)} /></label><p>Later sessions will reflow; this workout keeps its prescription and history.</p><button className={styles.primary}>Confirm defer</button></form> : null}
        </> : <p>Completed, deferred, or consciously skipped sessions remain in the week history.</p>}
      </section>
      <section className={styles.card}><p className={styles.kicker}>Ask Sterling · adaptive coach</p><h2>What changed in real life?</h2><form className={styles.sterling} onSubmit={askSterling}><textarea value={sterlingText} onChange={(event) => setSterlingText(event.target.value)} placeholder="I got about four hours of sleep and I’m gassed. Skip the weights today. I’m going to ruck. Move the weights to tomorrow." required /><button className={styles.primary}>Review adjustment</button></form>
        {sterlingProposal ? <div className={styles.proposal}><strong>Proposed — nothing has changed yet</strong><p>{sterlingProposal.summary}</p>{sterlingProposal.warnings.map((warning) => <p key={warning} className={styles.warning}>{warning}</p>)}<div className={styles.proposalGrid}>{sterlingProposal.nextSchedule.filter((item) => item.date >= today && item.status !== "deferred").slice(0, 5).map((item) => <div key={`${item.id}-${item.date}`}><span>{prettyDate(item.date)}</span><strong>{item.prescription.name}</strong><small>{item.prescription.intent} · {item.prescription.durationMinutes} min</small></div>)}</div><div className={styles.actions}><button className={styles.primary} onClick={confirmSterling}>Confirm changes</button><button onClick={() => setSterlingProposal(null)}>Reject</button></div></div> : null}
      </section>
      {latestRecovery ? <section className={styles.card}><p className={styles.kicker}>Today’s recovery context</p><h2>{latestRecovery.sleepHours ? `${latestRecovery.sleepHours.value}h sleep` : "Recovery logged"}{latestRecovery.fatigue ? ` · ${latestRecovery.fatigue.value} fatigue` : ""}</h2><p>Only supplied values are recorded. Missing WHOOP metrics remain blank.</p></section> : null}
      {state.progressionProposals.some((proposal) => proposal.status === "pending" || proposal.status === "edited") ? <section className={styles.card}><p className={styles.kicker}>Next-session proposals</p><h2>Review before progression changes.</h2>{state.progressionProposals.filter((proposal) => proposal.status === "pending" || proposal.status === "edited").map((proposal) => <div className={styles.savedRow} key={proposal.id}><strong>{proposal.action.toUpperCase()}{proposal.proposedLoad !== undefined ? ` · ${proposal.proposedLoad} lb` : ""}</strong><span>{proposal.reason}</span><div className={styles.actions}><button className={styles.primary} onClick={() => resolveProgression(proposal.id, "accepted")}>Accept</button><button onClick={() => resolveProgression(proposal.id, "edited")}>Edit</button><button onClick={() => resolveProgression(proposal.id, "rejected")}>Reject</button></div></div>)}</section> : null}
      {todayActivities.length ? <section className={styles.card}><p className={styles.kicker}>Accepted activity today</p>{todayActivities.map((activity) => <ActivityRow key={activity.id} activity={activity} onDeleteSource={activity.source?.storagePath ? () => void deleteSource("activity", activity.id) : undefined} />)}</section> : null}
      <section className={styles.card}><div className={styles.cardTop}><div><p className={styles.kicker}>Nutrition today</p><h2>{nutrition.calories} / {state.nutritionTargets.calories} kcal · {nutrition.protein} / {state.nutritionTargets.protein}g protein</h2></div><Link href="/executive-dashboard/concierge/personal/food">Log meal</Link></div></section>
    </div> : null}

    {view === "nutrition" ? <div className={styles.stack}>
      <section className={styles.card}><p className={styles.kicker}>Today’s targets</p><h2>{nutrition.calories} / {state.nutritionTargets.calories} kcal · {nutrition.protein} / {state.nutritionTargets.protein}g protein</h2><p>{nutrition.carbs} / {state.nutritionTargets.carbs}g carbs · {nutrition.fat} / {state.nutritionTargets.fat}g fat</p></section>
      <section className={`${styles.card} ${styles.quickLog}`}><p className={styles.kicker}>Natural intake</p><h2>Describe it, photograph it, or show Sterling the label.</h2><form className={styles.sterling} onSubmit={submitMealDescription}><textarea value={intakeText} onChange={(event) => setIntakeText(event.target.value)} placeholder="8 oz Dawg Food chicken blend, 1 tablespoon butter, 2 baby bok choy, and 1/2 cup Kevin's cauliflower puree." /><button className={styles.primary} disabled={intakeBusy || !intakeText.trim()}>Interpret meal</button></form><div className={styles.photoActions}><label className={`${styles.photoAction} ${styles.primary}`}>TAKE MEAL PHOTO<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" capture="environment" onChange={chooseMealPhoto} disabled={intakeBusy} /></label><label className={styles.photoAction}>UPLOAD MEAL PHOTO<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={chooseMealPhoto} disabled={intakeBusy} /></label><label className={styles.photoAction}>NUTRITION LABEL<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={chooseNutritionLabel} disabled={intakeBusy} /></label></div>{mealBusy ? <p aria-live="polite">Sterling is interpreting the input…</p> : null}{mealError ? <p role="alert" className={styles.warning}>{mealError}</p> : null}</section>
      <section className={styles.card}><div className={styles.cardTop}><div><p className={styles.kicker}>Frequently Eaten</p><h2>{frequentlyEaten.length ? "Your regulars, ready in one tap." : "Regular meals will appear here."}</h2></div></div><p>Meals repeat automatically after two accepted logs. You can also pin any saved meal.</p>{frequentlyEaten.length ? <div className={styles.frequentGrid}>{frequentlyEaten.map((frequent) => <div className={styles.frequentCard} key={frequent.id}><button className={styles.frequentLog} onClick={() => oneTapLog(frequent)} aria-label={`Log ${frequent.name}`}><strong>{frequent.name}</strong><span>{frequent.items.map((item) => item.portion).filter(Boolean).join(" · ") || "Saved serving"}</span><small>{frequent.calories} kcal · {frequent.protein}P · {frequent.carbs}C · {frequent.fat}F{frequent.mealType ? ` · ${frequent.mealType}` : ""}</small></button><div className={styles.compactActions}><button onClick={() => storeFrequent(frequent, { pinned: !frequent.pinned })}>{frequent.pinned ? "Unpin" : "Pin"}</button><button onClick={() => setEditingFrequentId((id) => id === frequent.id ? null : frequent.id)}>Edit default</button><button onClick={() => storeFrequent(frequent, { hidden: true })}>Hide</button></div>{editingFrequentId === frequent.id ? <FrequentDefaultEditor frequent={frequent} onChange={(itemId, patch) => updateFrequentDefault(frequent, itemId, patch)} onDone={() => setEditingFrequentId(null)} /> : null}</div>)}</div> : null}</section>
      {lastAddedMealId && state.meals.some((meal) => meal.id === lastAddedMealId) ? <section className={`${styles.card} ${styles.undoBar}`} aria-live="polite"><div><p className={styles.kicker}>Logged</p><strong>{state.meals.find((meal) => meal.id === lastAddedMealId)?.items.map((item) => item.name).join(", ")}</strong></div><div className={styles.actions}><button onClick={() => setEditingMealId((id) => id === lastAddedMealId ? null : lastAddedMealId)}>Edit</button><button onClick={undoLastMeal}>Undo</button></div>{editingMealId === lastAddedMealId ? <MealOccurrenceEditor meal={state.meals.find((meal) => meal.id === lastAddedMealId)!} onChange={(itemId, patch) => updateMealOccurrence(lastAddedMealId, itemId, patch)} onDone={() => setEditingMealId(null)} /> : null}</section> : null}
      {mealEstimate ? <section className={styles.card}><p className={styles.kicker}>Review required</p><h2>Human input → Sterling proposal → your approval</h2><p>Nothing is saved until you accept the editable values below. The untouched Sterling estimate, assumptions, and your corrections are retained separately for provenance.</p>{intakeProposal?.assumptions.map((assumption) => <p key={assumption} className={styles.provenance}>Assumption · {assumption}</p>)}<MealReview estimate={mealEstimate} onChange={updateMealItem} onRemove={(id) => setMealEstimate((estimate) => estimate ? { ...estimate, items: estimate.items.filter((item) => item.id !== id) } : null)} onAdd={() => setMealEstimate((estimate) => estimate ? { ...estimate, items: [...estimate.items, { id: uid("meal-item"), name: "", portion: "", calories: 0, protein: 0, carbs: 0, fat: 0, confidence: "low" }] } : null)} onAccept={acceptMeal} onReject={() => void rejectIntake()} /></section> : null}
      <section className={styles.card}><p className={styles.kicker}>Manual meal</p><h2>Log without a photo.</h2><form className={styles.recoveryForm} onSubmit={saveManualMeal}><div className={styles.formGrid}><label>Food<input name="name" placeholder="Chicken, rice, greens" required /></label><label>Portion<input name="portion" placeholder="6 oz / 1 cup" /></label><label>Meal type<select name="mealType"><option value="">Not supplied</option><option>breakfast</option><option>lunch</option><option>dinner</option><option>snack</option></select></label></div><div className={styles.formGrid}><label>Calories<input name="calories" type="number" min="0" required /></label><label>Protein<input name="protein" type="number" min="0" required /></label><label>Carbs<input name="carbs" type="number" min="0" required /></label><label>Fat<input name="fat" type="number" min="0" required /></label></div><button className={styles.primary}>Save manual meal</button></form></section>
      <section className={styles.card}><p className={styles.kicker}>Saved meals · canonical</p>{state.meals.length ? state.meals.slice(0, 10).map((meal) => <div className={styles.savedRow} key={meal.id}><span>{meal.items.map((item) => item.name).join(", ")}</span><strong>{meal.calories} kcal · {meal.protein}P · {meal.carbs}C · {meal.fat}F</strong><small>{meal.aiEstimate ? "AI estimate retained · user-approved values canonical" : meal.frequentMealId ? "one-tap relog" : "manual"}</small><div className={styles.compactActions}><button onClick={() => saveAsFrequent(meal)}>{state.frequentMeals.some((item) => item.signature === mealSignature(meal)) ? "Update frequent" : "Save as frequent"}</button>{meal.photo?.storagePath ? <button onClick={() => void deleteSource("meal", meal.id)}>Delete source image</button> : null}</div></div>) : <p>No meals saved yet.</p>}</section>
    </div> : null}

    {view === "recovery" ? <div className={styles.stack}><section className={styles.card}><p className={styles.kicker}>Morning check-in</p><h2>Log only what you know.</h2><p>Every field is optional. Measured/manual numbers stay distinct from subjective ratings; absent WHOOP metrics remain absent.</p><RecoveryForm existing={latestRecovery} onSubmit={saveRecovery} /></section>{latestRecovery ? <section className={styles.card}><p className={styles.kicker}>Saved today</p><div className={styles.metricGrid}>{Object.entries(latestRecovery).filter(([, value]) => value && typeof value === "object" && "source" in value).map(([key, value]) => { const metric = value as { value: string | number; source: string }; return <div key={key}><span>{key}</span><strong>{metric.value}</strong><small>{metric.source}</small></div>; })}</div></section> : null}</div> : null}

    {view === "week" ? <div className={styles.stack}><section className={styles.card}><p className={styles.kicker}>Completed activity intake</p><h2>Upload a run, ruck, Peloton, WHOOP, Tonal, or Apple Fitness screenshot.</h2><label className={`${styles.photoAction} ${styles.primary}`}>UPLOAD WORKOUT SCREENSHOT<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={chooseActivityScreenshot} disabled={intakeBusy} /></label>{intakeBusy ? <p aria-live="polite">Sterling is reading the visible workout facts…</p> : null}{mealError ? <p role="alert" className={styles.warning}>{mealError}</p> : null}</section>{intakeProposal?.kind === "activity" ? <section className={styles.card}><p className={styles.kicker}>Review required</p><h2>Observed facts stay distinct from estimates.</h2><ActivityReview proposal={intakeProposal} defaultDate={today} onAccept={acceptActivity} onReject={() => void rejectIntake()} /></section> : null}<section className={styles.week}>{week.map((workout) => <article className={styles.card} key={`${workout.id}-${workout.date}-${workout.status}`}><div className={styles.cardTop}><div><p className={styles.kicker}>{prettyDate(workout.date)} · {workout.status.replace("_", " ")}</p><h3>{workout.prescription.name}</h3></div><span>{workout.prescription.domain}</span></div><p>{workout.prescription.notes}</p><small>{workout.history.at(-1)?.note}</small>{workout.prescription.alternative && workout.status === "planned" ? <div className={styles.actions}><button onClick={() => swapWorkout(workout.id)}>Swap equivalent</button></div> : null}</article>)}</section><section className={styles.card}><p className={styles.kicker}>Accepted activity history</p>{state.activities.length ? state.activities.slice(0, 12).map((activity) => <ActivityRow key={activity.id} activity={activity} />) : <p>No accepted activities yet.</p>}</section></div> : null}

    {view === "progress" ? <div className={styles.stack}><section className={styles.card}><p className={styles.kicker}>Weekly signal</p><h2>Consistency without punishment.</h2><div className={styles.metricGrid}><div><span>Completed</span><strong>{state.schedule.filter((workout) => workout.date >= weekStart && workout.date <= weekEnd && workout.status === "completed").length}</strong><small>sessions this week</small></div><div><span>Unresolved</span><strong>{state.schedule.filter((workout) => workout.status === "unresolved").length}</strong><small>awaiting a decision</small></div><div><span>Nutrition</span><strong>{loggedDays}</strong><small>days logged</small></div><div><span>Average protein</span><strong>{loggedDays ? Math.round(weekNutrition.protein / loggedDays) : 0}g</strong><small>on logged days</small></div></div></section><section className={styles.card}><p className={styles.kicker}>Bodyweight trend</p><h2>{weights.at(-1)?.bodyweightLb?.value ? `${weights.at(-1)!.bodyweightLb!.value} lb` : "No bodyweight logged"}</h2>{weights.length ? weights.slice(-8).map((entry) => <div className={styles.savedRow} key={entry.id}><span>{prettyDate(entry.date)}</span><strong>{entry.bodyweightLb?.value} lb</strong><small>{entry.bodyweightLb?.source}</small></div>) : <p>Log bodyweight in the morning Recovery check-in.</p>}<p className={styles.provenance}>Apple Health is not connected. This web app does not claim direct HealthKit access.</p></section></div> : null}
  </main>;
}

function WorkoutLogger({ workout, session, onSet, onComplete }: { workout: ScheduledWorkout; session: WorkoutSession; onSet: (exerciseId: string, setNumber: number, patch: Partial<PerformedSet>) => void; onComplete: () => void }) {
  return <div className={styles.logger}>{workout.prescription.exercises.length ? workout.prescription.exercises.map((exercise) => <details key={exercise.id} open><summary><span><strong>{exercise.name}</strong><small>{exercise.sets} × {exercise.targetReps[0]}–{exercise.targetReps[1]}{exercise.targetLoad ? ` @ ${exercise.targetLoad} lb` : ""}</small></span></summary>{exercise.previous ? <p>Last: {exercise.previous.load ? `${exercise.previous.load} lb · ` : ""}{exercise.previous.reps.join(" / ")} reps</p> : null}<p>{exercise.notes}</p><p className={styles.provenance}>{exercise.progressionContext}</p><div className={styles.sets}>{Array.from({ length: exercise.sets }, (_, index) => { const number = index + 1; const logged = session.sets.find((set) => set.exerciseId === exercise.id && set.setNumber === number); return <div key={number}><b>{number}</b><label>lb<input inputMode="decimal" value={logged?.load ?? exercise.targetLoad ?? ""} onChange={(event) => onSet(exercise.id, number, { load: Number(event.target.value) })} /></label><label>reps<input inputMode="numeric" value={logged?.reps ?? ""} onChange={(event) => onSet(exercise.id, number, { reps: Number(event.target.value) })} /></label><label>RIR<input inputMode="numeric" value={logged?.rir ?? ""} onChange={(event) => onSet(exercise.id, number, { rir: Number(event.target.value) })} /></label><button className={logged?.completed ? styles.selected : ""} onClick={() => onSet(exercise.id, number, { completed: !logged?.completed, skipped: false })}>Log</button><button className={logged?.skipped ? styles.selected : ""} onClick={() => onSet(exercise.id, number, { skipped: !logged?.skipped, completed: false })}>Skip set</button><label className={styles.check}><input type="checkbox" checked={logged?.pain ?? false} onChange={(event) => onSet(exercise.id, number, { pain: event.target.checked })} /> pain / discomfort</label></div>; })}</div></details>) : <p>Keep this session easy and recovery-conscious.</p>}<button className={styles.primary} onClick={onComplete}>Complete workout & review progression</button></div>;
}

function RecoveryForm({ existing, onSubmit }: { existing?: RecoveryEntry; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const fields = [{ name: "sleepHours", label: "Sleep duration", unit: "hours", min: 0, max: 24, step: .25 }, { name: "sleepQuality", label: "Sleep quality", unit: "1–5", min: 1, max: 5 }, { name: "recoveryScore", label: "Recovery / readiness", unit: "0–100", min: 0, max: 100 }, { name: "strain", label: "Strain", unit: "0–21", min: 0, max: 21, step: .1 }, { name: "restingHeartRate", label: "Resting heart rate", unit: "bpm", min: 20, max: 220 }, { name: "hrvMs", label: "HRV", unit: "ms", min: 1, max: 500 }, { name: "bodyweightLb", label: "Bodyweight", unit: "lb", min: 70, max: 500, step: .1 }];
  return <form className={styles.recoveryForm} onSubmit={onSubmit}><div className={styles.formGrid}>{fields.map((field) => <label key={field.name}>{field.label}<span><input name={field.name} type="number" min={field.min} max={field.max} step={field.step} defaultValue={(existing?.[field.name as keyof RecoveryEntry] as { value?: number } | undefined)?.value ?? ""} /><small>{field.unit}</small></span></label>)}</div><div className={styles.formGrid}><label>Fatigue<select name="fatigue" defaultValue={existing?.fatigue?.value ?? ""}><option value="">Not provided</option><option>low</option><option>moderate</option><option>high</option></select></label><label>Soreness<select name="soreness" defaultValue={existing?.soreness?.value ?? ""}><option value="">Not provided</option><option>none</option><option>mild</option><option>moderate</option><option>high</option></select></label><label>Pain / discomfort<select name="pain" defaultValue={existing?.pain?.value ?? ""}><option value="">Not provided</option><option>none</option><option>mild</option><option>moderate</option><option>high</option></select></label></div><label>Optional notes<textarea name="notes" defaultValue={existing?.notes ?? ""} placeholder="Anything Sterling should know this morning?" /></label><button className={styles.primary}>Save recovery check-in</button></form>;
}

function MealReview({ estimate, onChange, onRemove, onAdd, onAccept, onReject }: { estimate: MealEstimate; onChange: (id: string, patch: Partial<MealItem>) => void; onRemove: (id: string) => void; onAdd: () => void; onAccept: (mealType?: MealLog["mealType"]) => void; onReject: () => void }) {
  const sum = totals(estimate.items); const [mealType, setMealType] = useState<MealLog["mealType"]>();
  return <div className={styles.mealReview}><div className={styles.reviewTop}><strong>AI estimate · review every value</strong><span>{estimate.confidence} confidence</span></div>{estimate.clarification ? <p className={styles.warning}>{estimate.clarification}</p> : null}<p>{estimate.caveat}</p>{estimate.items.map((item) => <div className={styles.mealItem} key={item.id}><label>Food<input value={item.name} onChange={(event) => onChange(item.id, { name: event.target.value })} /></label><label>Portion<input value={item.portion} onChange={(event) => onChange(item.id, { portion: event.target.value })} /></label>{(["calories", "protein", "carbs", "fat"] as const).map((key) => <label key={key}>{key}<input type="number" min="0" value={item[key]} onChange={(event) => onChange(item.id, { [key]: Number(event.target.value) })} /></label>)}<button onClick={() => onRemove(item.id)}>Remove</button></div>)}<button onClick={onAdd}>Add missing food</button><div className={styles.estimateTotal}><span>Reviewed total</span><strong>{sum.calories} kcal · {sum.protein}g protein · {sum.carbs}g carbs · {sum.fat}g fat</strong></div><label>Meal type · optional<select value={mealType ?? ""} onChange={(event) => setMealType((event.target.value || undefined) as MealLog["mealType"])}><option value="">Not supplied</option><option>breakfast</option><option>lunch</option><option>dinner</option><option>snack</option></select></label><div className={styles.actions}><button className={styles.primary} disabled={!estimate.items.length || estimate.items.some((item) => !item.name.trim())} onClick={() => onAccept(mealType)}>Accept</button><button onClick={onReject}>Reject</button></div></div>;
}

function MacroItemEditor({ item, onChange }: { item: MealItem; onChange: (patch: Partial<MealItem>) => void }) {
  return <div className={styles.mealItem}><label>Food<input value={item.name} onChange={(event) => onChange({ name: event.target.value })} /></label><label>Portion<input value={item.portion} onChange={(event) => onChange({ portion: event.target.value })} /></label>{(["calories", "protein", "carbs", "fat"] as const).map((key) => <label key={key}>{key}<input type="number" min="0" value={item[key]} onChange={(event) => onChange({ [key]: Math.max(0, Number(event.target.value) || 0) })} /></label>)}</div>;
}

function FrequentDefaultEditor({ frequent, onChange, onDone }: { frequent: FrequentMealCandidate; onChange: (itemId: string, patch: Partial<MealItem>) => void; onDone: () => void }) {
  return <div className={styles.inlineEditor}><strong>Edit saved default</strong><p>Future one-tap logs use these values. Existing meal occurrences stay unchanged.</p>{frequent.items.map((item) => <MacroItemEditor key={item.id} item={item} onChange={(patch) => onChange(item.id, patch)} />)}<button className={styles.primary} onClick={onDone}>Done</button></div>;
}

function MealOccurrenceEditor({ meal, onChange, onDone }: { meal: MealLog; onChange: (itemId: string, patch: Partial<MealItem>) => void; onDone: () => void }) {
  return <div className={styles.inlineEditor}><strong>Edit this occurrence</strong><p>Your saved frequent default will not change.</p>{meal.items.map((item) => <MacroItemEditor key={item.id} item={item} onChange={(patch) => onChange(item.id, patch)} />)}<button className={styles.primary} onClick={onDone}>Done</button></div>;
}

function ActivityReview({ proposal, defaultDate, onAccept, onReject }: { proposal: Extract<NaturalIngestionProposal, { kind: "activity" }>; defaultDate: string; onAccept: (facts: ActivityFacts, occurredOn: string) => void | Promise<void>; onReject: () => void }) {
  const [facts, setFacts] = useState<ActivityFacts>(() => structuredClone(proposal.activity));
  const [occurredOn, setOccurredOn] = useState(defaultDate);
  const numericFields: Array<{ key: Exclude<keyof ActivityFacts, "activityType" | "pace" | "notes">; label: string; step?: number }> = [
    { key: "durationMinutes", label: "Duration · min", step: .1 }, { key: "distanceMiles", label: "Distance · mi", step: .01 },
    { key: "averageSpeedMph", label: "Average speed · mph", step: .1 }, { key: "averageHeartRate", label: "Average HR", step: 1 },
    { key: "maxHeartRate", label: "Max HR", step: 1 }, { key: "elevationFeet", label: "Elevation · ft", step: 1 },
    { key: "reportedCalories", label: "Reported calories", step: 1 }, { key: "whoopStrain", label: "WHOOP strain", step: .1 },
    { key: "steps", label: "Steps", step: 1 }, { key: "ruckWeightLb", label: "Ruck / vest · lb", step: .1 },
  ];
  const setNumeric = (key: typeof numericFields[number]["key"], value: string) => setFacts((current) => ({ ...current, [key]: value === "" ? undefined : { value: Math.max(0, Number(value) || 0), evidence: "user_supplied" } }));
  return <div className={styles.mealReview}><div className={styles.reviewTop}><strong>{proposal.summary}</strong><span>{proposal.confidence} confidence</span></div>{proposal.assumptions.map((assumption) => <p key={assumption} className={styles.provenance}>Assumption · {assumption}</p>)}<div className={styles.formGrid}><label>Activity<input value={facts.activityType} onChange={(event) => setFacts((current) => ({ ...current, activityType: event.target.value }))} /></label><label>Activity date<input type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} /></label><label>Pace<input value={facts.pace?.value ?? ""} onChange={(event) => setFacts((current) => ({ ...current, pace: event.target.value ? { value: event.target.value, evidence: "user_supplied" } : undefined }))} /></label>{numericFields.map((field) => <label key={field.key}>{field.label}<input type="number" min="0" step={field.step} value={(facts[field.key] as { value?: number } | undefined)?.value ?? ""} onChange={(event) => setNumeric(field.key, event.target.value)} /></label>)}</div><label>Notes<textarea value={facts.notes ?? ""} onChange={(event) => setFacts((current) => ({ ...current, notes: event.target.value }))} /></label><p>{proposal.guidance}</p><p className={styles.provenance}>Visible values retain observed provenance. Any field you change becomes user supplied.</p><div className={styles.actions}><button className={styles.primary} disabled={!facts.activityType.trim() || !occurredOn} onClick={() => void onAccept(facts, occurredOn)}>Accept activity</button><button onClick={onReject}>Reject</button></div></div>;
}

function ActivityRow({ activity, onDeleteSource }: { activity: ActivityLog; onDeleteSource?: () => void }) {
  const metrics = Object.entries(activity.facts).flatMap(([key, value]) => value && typeof value === "object" && "value" in value ? [`${key.replace(/([A-Z])/g, " $1").toLowerCase()}: ${String((value as { value: unknown }).value)} (${String((value as { evidence: unknown }).evidence)})`] : []);
  return <div className={styles.savedRow}><span>{prettyDate(activity.occurredOn)} · {activity.facts.activityType}</span><strong>{metrics.join(" · ") || "No numeric metrics supplied"}</strong><small>{activity.guidance}</small>{onDeleteSource ? <div className={styles.compactActions}><button onClick={onDeleteSource}>Delete source image</button></div> : null}</div>;
}
