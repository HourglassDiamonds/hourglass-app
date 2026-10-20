"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { applySterlingProposal, deferAndReflow, retargetSterlingScheduleAdjustment } from "@/lib/continuum/personal/adaptation";
import { activateTrainingProgram, createInitialPersonalState, dateKey, previewTrainingWeek, shiftDate, weekdayIndex } from "@/lib/continuum/personal/program";
import { proposeProgression } from "@/lib/continuum/personal/progression";
import { migrateLegacyPersonalState, parsePersonalState } from "@/lib/continuum/personal/state";
import { deriveFrequentlyEaten, frequentFromMeal, logFrequentMeal, mealName, mealSignature, type FrequentMealCandidate } from "@/lib/continuum/personal/nutrition";
import { acceptActivityProposal, acceptProposal, buildAcceptedActivity, buildAcceptedMeal, completeScheduledWorkoutFromActivity, correctActivityDate as correctActivityDateInState } from "@/lib/continuum/personal/mutations";
import { compareActivityDate, visibleActivityDateLabel } from "@/lib/continuum/personal/activity-date";
import { PERFORMANCE_IMAGE_ACCEPT, performanceImageMessage, preparePerformanceImage, type PreparedPerformanceImage } from "@/lib/continuum/personal/image-upload";
import { configureTonalProgram, FIT_OVER_40_WEEKLY_FREQUENCY, markTonalSessionCompletedFromActivity, matchesTonalSessionCompletion, nextTonalSession, planTonalSessionFromScreenshot, syncTonalProgramCompletion, tonalEnrollmentReady, tonalSessionOutcome, tonalSessionStatus, TONAL_PROGRAM_CATALOG } from "@/lib/continuum/personal/tonal-programs";
import { mondayFor, weekRecords } from "@/lib/continuum/personal/week-view";
import type { ActivityFacts, ActivityLog, AuditFact, FrequentMeal, MealEstimate, MealItem, MealLog, NaturalIngestionProposal, PerformedSet, PerformanceSourceType, PersonalState, RecoveryEntry, RecoveryProposalFacts, ScheduledWorkout, SterlingProposal, TonalProgramMovement, WorkoutSession } from "@/lib/continuum/personal/types";
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
function nextMonday(key: string): string { return shiftDate(key, (7 - weekdayIndex(key)) % 7); }
function prettyDate(key: string): string { return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${key}T12:00:00`)); }
function totals(items: readonly MealItem[]) { return items.reduce((sum, item) => ({ calories: sum.calories + item.calories, protein: sum.protein + item.protein, carbs: sum.carbs + item.carbs, fat: sum.fat + item.fat }), { calories: 0, protein: 0, carbs: 0, fat: 0 }); }

export function PerformanceApp({ initialView = "today" }: { initialView?: View }) {
  const [today, setToday] = useState(localToday);
  const [state, setState] = useState<PersonalState>(() => createInitialPersonalState(localToday()));
  const [ready, setReady] = useState(false);
  const view = String(initialView) as View;
  const [sterlingText, setSterlingText] = useState("");
  const [sterlingProposal, setSterlingProposal] = useState<SterlingProposal | null>(null);
  const [sterlingBusy, setSterlingBusy] = useState(false);
  const [sterlingError, setSterlingError] = useState("");
  const [modifyOpen, setModifyOpen] = useState(false);
  const [deferOpen, setDeferOpen] = useState(false);
  const [mealEstimate, setMealEstimate] = useState<MealEstimate | null>(null);
  const [mealPhoto, setMealPhoto] = useState<{ name: string; type: string; size: number } | null>(null);
  const [mealBusy, setMealBusy] = useState(false);
  const [mealError, setMealError] = useState("");
  const [lastAddedMealId, setLastAddedMealId] = useState<string | null>(null);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [editingFrequentId, setEditingFrequentId] = useState<string | null>(null);
  const [mealTargetDate, setMealTargetDate] = useState(localToday);
  const [mealEntryOpen, setMealEntryOpen] = useState(false);
  const mealEntryRef = useRef<HTMLDivElement>(null);
  const mealTextRef = useRef<HTMLTextAreaElement>(null);
  const [recoveryTargetDate, setRecoveryTargetDate] = useState(localToday);
  const [recoveryEntryOpen, setRecoveryEntryOpen] = useState(false);
  const [recoveryProposal, setRecoveryProposal] = useState<Extract<NaturalIngestionProposal, { kind: "recovery" }> | null>(null);
  const [recoveryFile, setRecoveryFile] = useState<File | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryFeedback, setRecoveryFeedback] = useState("");
  const recoveryReviewRef = useRef<HTMLDivElement>(null);
  const [displayWeekStart, setDisplayWeekStart] = useState(() => mondayFor(localToday()));
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => new Set([localToday()]));
  const [intakeText, setIntakeText] = useState("");
  const [intakeProposal, setIntakeProposal] = useState<NaturalIngestionProposal | null>(null);
  const [intakeFile, setIntakeFile] = useState<File | null>(null);
  const [intakeBusy, setIntakeBusy] = useState(false);
  const [pastActivityOpen, setPastActivityOpen] = useState(false);
  const [pastActivityDate, setPastActivityDate] = useState(() => shiftDate(localToday(), -1));
  const [activityDefaultDate, setActivityDefaultDate] = useState(() => shiftDate(localToday(), -1));
  const [activityMaxDate, setActivityMaxDate] = useState(() => shiftDate(localToday(), -1));
  const [activityFeedback, setActivityFeedback] = useState("");
  const [persistStatus, setPersistStatus] = useState<"loading" | "saved" | "saving" | "browser" | "conflict" | "error">("loading");
  const persistInFlight = useRef(false);
  const revisionRef = useRef(0);
  const lastPersistedState = useRef("");
  const [programStartDate, setProgramStartDate] = useState(() => nextMonday(localToday()));
  const [activationReview, setActivationReview] = useState(false);
  const [activationBusy, setActivationBusy] = useState(false);
  const [activationError, setActivationError] = useState("");
  const [tonalConfigBusy, setTonalConfigBusy] = useState(false);
  const [tonalConfigFeedback, setTonalConfigFeedback] = useState("");
  const [tonalPlanProposal, setTonalPlanProposal] = useState<Extract<NaturalIngestionProposal, { kind: "activity" }> | null>(null);
  const [tonalPlanFile, setTonalPlanFile] = useState<File | null>(null);
  const [tonalPlanTargetOrder, setTonalPlanTargetOrder] = useState<number | null>(null);
  const [tonalPlanBusy, setTonalPlanBusy] = useState(false);
  const [tonalPlanFeedback, setTonalPlanFeedback] = useState("");
  const [tonalCompletionFeedback, setTonalCompletionFeedback] = useState("");
  const [, setSelectedTonalSessionOrder] = useState<number | null>(null);
  const [tonalCompletionTargetOrder, setTonalCompletionTargetOrder] = useState<number | null>(null);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [completionWorkoutId, setCompletionWorkoutId] = useState<string | null>(null);
  const completionReviewRef = useRef<HTMLDivElement>(null);

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
        if (response.ok && payload.ok && payload.state) {
          const loaded = parsePersonalState(JSON.stringify(payload.state), key);
          const loadedRevision = payload.revision ?? 0;
          setState(loaded); revisionRef.current = loadedRevision; lastPersistedState.current = JSON.stringify(loaded); setPersistStatus("saved");
        }
        else { setState(next); setPersistStatus(response.status === 503 ? "browser" : "error"); }
      } catch { setState(next); setPersistStatus("browser"); }
      setReady(true);
    })();
  }, []);
  useEffect(() => { if (ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [ready, state]);
  useEffect(() => {
    if (!mealEntryOpen) return;
    const frame = window.requestAnimationFrame(() => {
      mealEntryRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      mealTextRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mealEntryOpen, mealTargetDate]);
  useEffect(() => {
    if (!recoveryProposal) return;
    const frame = window.requestAnimationFrame(() => recoveryReviewRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    return () => window.cancelAnimationFrame(frame);
  }, [recoveryProposal]);
  useEffect(() => {
    if (intakeProposal?.kind !== "activity" || tonalCompletionTargetOrder === null) return;
    const frame = window.requestAnimationFrame(() => completionReviewRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    return () => window.cancelAnimationFrame(frame);
  }, [intakeProposal, tonalCompletionTargetOrder]);

  const todayWorkout = state.schedule.find((workout) => workout.date === today);
  const activeToday = todayWorkout && !["completed", "deferred", "skipped", "replaced"].includes(todayWorkout.status) ? todayWorkout : undefined;
  const activeSession = activeToday ? state.sessions.find((session) => session.scheduledWorkoutId === activeToday.id && !session.completedAt) : undefined;
  const latestRecovery = state.recoveryEntries.find((entry) => entry.date === today);
  const todayMeals = state.meals.filter((meal) => (meal.occurredOn ?? meal.timestamp.slice(0, 10)) === today);
  const nutrition = totals(todayMeals.flatMap((meal) => meal.items));
  const visibleDays = weekRecords(state, displayWeekStart);
  const week = state.schedule.filter((workout) => workout.date >= shiftDate(today, -6) && workout.date <= shiftDate(today, 8));
  const weights = state.recoveryEntries.filter((entry) => entry.bodyweightLb).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const weekStart = mondayFor(today);
  const weekEnd = shiftDate(weekStart, 6);
  const thisWeekMeals = state.meals.filter((meal) => (meal.occurredOn ?? meal.timestamp.slice(0, 10)) >= weekStart && (meal.occurredOn ?? meal.timestamp.slice(0, 10)) <= weekEnd);
  const loggedDays = new Set(thisWeekMeals.map((meal) => meal.occurredOn ?? meal.timestamp.slice(0, 10))).size;
  const weekNutrition = totals(thisWeekMeals.flatMap((meal) => meal.items));
  const frequentlyEaten = deriveFrequentlyEaten(state.meals, state.frequentMeals);
  const todayActivities = state.activities.filter((activity) => activity.occurredOn === today);
  const activationPreview = activationReview
    ? previewTrainingWeek(state.tonal, programStartDate)
    : [];
  const upcomingTonalSession = nextTonalSession(state);
  const selectableWorkouts = state.schedule.filter((workout) => workout.status !== "replaced").sort((a, b) => a.date.localeCompare(b.date));
  const selectedWorkout = state.schedule.find((workout) => workout.id === selectedWorkoutId) ?? todayWorkout ?? selectableWorkouts.find((workout) => workout.date >= today) ?? selectableWorkouts.at(-1);
  const selectedWorkoutTonalSession = selectedWorkout ? state.tonal.enrollment.sessions.find((session) => session.scheduledWorkoutId === selectedWorkout.id) : undefined;

  async function prepareUpload(file: File, notify?: (message: string) => void): Promise<PreparedPerformanceImage> {
    const prepared = await preparePerformanceImage(file);
    if (prepared.converted) notify?.("iPhone photo prepared privately for review. Nothing is saved yet.");
    return prepared;
  }

  async function persistStateMutation(next: PersonalState, mutation: Record<string, unknown>, source?: File): Promise<{ state: PersonalState; duplicate: boolean }> {
    setPersistStatus("saving"); persistInFlight.current = true;
    const init: RequestInit = { method: source ? "POST" : "PUT" };
    if (source) {
      const body = new FormData(); body.set("state", JSON.stringify(next)); body.set("mutation", JSON.stringify(mutation)); body.set("expectedRevision", String(revisionRef.current)); body.set("source", source); init.body = body;
    } else {
      init.headers = { "Content-Type": "application/json" }; init.body = JSON.stringify({ state: next, mutation, expectedRevision: revisionRef.current });
    }
    try {
      const response = await fetch("/executive-dashboard/concierge/personal/state", init);
      const payload = await response.json() as { ok: boolean; state?: PersonalState; revision?: number; duplicate?: boolean; error?: string };
      if (response.status === 409) {
        if (payload.state) setState(parsePersonalState(JSON.stringify(payload.state), today));
        const conflictRevision = payload.revision ?? 0;
        revisionRef.current = conflictRevision; setPersistStatus("conflict"); throw new Error("performance-revision-conflict");
      }
      if (!response.ok || !payload.ok || !payload.state) { setPersistStatus(response.status === 503 ? "browser" : "error"); throw new Error(payload.error ?? "performance-save-failed"); }
      const saved = parsePersonalState(JSON.stringify(payload.state), today);
      const savedRevision = payload.revision ?? revisionRef.current + 1;
      revisionRef.current = savedRevision; lastPersistedState.current = JSON.stringify(saved); setPersistStatus("saved"); return { state: saved, duplicate: Boolean(payload.duplicate) };
    } finally { persistInFlight.current = false; }
  }

  useEffect(() => {
    const serialized = JSON.stringify(state);
    if (!ready || persistInFlight.current || serialized === lastPersistedState.current) return;
    const timer = window.setTimeout(() => {
      void persistStateMutation(state, { idempotencyKey: uid("snapshot"), action: "snapshot" }).catch(() => undefined);
    }, 350);
    return () => window.clearTimeout(timer);
    // Persist each canonical state transition; the accepted-ingestion path also performs a synchronous idempotent commit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, state]);

  function reviewActivation() {
    setActivationError("");
    if (!programStartDate || programStartDate < today || weekdayIndex(programStartDate) !== 0) {
      setActivationReview(false); setActivationError("Choose a Monday so Week 1 keeps Sunday as the planned rest day."); return;
    }
    setActivationReview(true);
  }

  async function configureTonalSequence() {
    if (tonalConfigBusy || state.program.status !== "setup") return;
    setTonalConfigBusy(true); setTonalConfigFeedback(""); setActivationError("");
    try {
      const reference = "Fit Over 40 founder-confirmed in Tonal app or machine; 3 workouts per week; 4 weeks; 12 prescribed sessions";
      const bytes = new TextEncoder().encode(reference).buffer;
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((value) => value.toString(16).padStart(2, "0")).join("");
      const reviewedAt = new Date().toISOString();
      const source = { kind: "founder_confirmed" as const, reference, digest, reviewedAt };
      const next = configureTonalProgram({ state, programId: "fit-over-40", weeklyFrequency: FIT_OVER_40_WEEKLY_FREQUENCY, source, founderVerifiedAt: reviewedAt });
      const saved = await persistStateMutation(next, {
        idempotencyKey: `configure-tonal-${digest}`,
        action: "configure_strength_program",
        entryId: `tonal-program-${digest.slice(0, 32)}`,
        sourceType: "text",
        accepted: { programId: "fit-over-40", weeklyFrequency: FIT_OVER_40_WEEKLY_FREQUENCY, durationWeeks: 4, prescribedSessions: 12, sourceDigest: digest },
      });
      setState(saved.state); setTonalConfigFeedback(saved.duplicate ? "Tonal enrollment already verified" : "Tonal enrollment verified and saved");
    } catch (error) {
      const message = error instanceof Error ? error.message : "tonal-configuration-failed";
      setTonalConfigFeedback(message === "performance-mutation-action-unavailable" ? "The database cannot record Tonal program configuration yet. Nothing changed." : "The Tonal enrollment was not saved. Confirm the program identity and actual cadence.");
    } finally { setTonalConfigBusy(false); }
  }

  async function confirmActivation() {
    if (!activationReview || activationBusy || state.program.status !== "setup") return;
    setActivationBusy(true); setActivationError("");
    try {
      const activatedAt = new Date().toISOString();
      const next = activateTrainingProgram(state, programStartDate, activatedAt);
      const saved = await persistStateMutation(next, {
        idempotencyKey: `activate-program-${programStartDate}`,
        action: "activate_program",
        accepted: { startDate: programStartDate, week11ObjectiveDate: shiftDate(programStartDate, 10 * 7 + 4) },
      });
      setState(saved.state); setActivationReview(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "performance-save-failed";
      setActivationError(message === "performance-revision-conflict"
        ? "Performance changed in another save. Review the start date again before activating."
        : message === "performance-mutation-action-unavailable"
          ? "This Preview database cannot record program activation yet. The program remains not started."
          : message === "tonal-session-sequence-required"
            ? "Confirm the founder-verified Fit Over 40 cadence of three weekly workouts before activation."
          : "The program was not activated. Existing nutrition and activity history remains unchanged.");
    } finally { setActivationBusy(false); }
  }

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
    setState((current) => syncTonalProgramCompletion({
      ...current,
      sessions: current.sessions.map((session) => session.id === activeSession.id ? { ...session, completedAt: at } : session),
      schedule: current.schedule.map((workout) => workout.id === activeToday.id ? { ...workout, status: "completed", history: [...workout.history, { at, action: "completed", actor: "user", note: "Workout completed and progression reviewed." }] } : workout),
      progressionProposals: [...current.progressionProposals, ...proposals],
    }, at));
  }

  function saveModification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedWorkout || ["completed", "deferred", "skipped", "replaced"].includes(selectedWorkout.status)) return;
    const data = new FormData(event.currentTarget); const at = new Date().toISOString();
    updateWorkout(selectedWorkout.id, (workout) => ({ ...workout, prescription: { ...workout.prescription, name: String(data.get("name") || workout.prescription.name).slice(0, 100), durationMinutes: Math.max(5, Math.min(180, Number(data.get("duration")) || workout.prescription.durationMinutes)), notes: String(data.get("notes") || workout.prescription.notes).slice(0, 400) }, provenance: [...new Set([...workout.provenance, "user" as const])], history: [...workout.history, { at, action: "modified", actor: "user", note: "Founder edited this scheduled occurrence; program identity remains attached." }] }));
    setModifyOpen(false);
  }

  function deferWorkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedWorkout) return;
    const target = String(new FormData(event.currentTarget).get("date") || shiftDate(selectedWorkout.date, 1));
    setState((current) => ({ ...current, schedule: deferAndReflow(current.schedule, selectedWorkout.id, target) })); setDeferOpen(false);
  }

  function skipWorkout() {
    if (!selectedWorkout) return; const at = new Date().toISOString();
    updateWorkout(selectedWorkout.id, (workout) => ({ ...workout, status: "skipped", provenance: [...new Set([...workout.provenance, "user" as const])], history: [...workout.history, { at, action: "skipped", actor: "user", note: "This occurrence was consciously skipped; it is retained in history and not treated as an accidental failure." }] }));
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

  async function askSterling(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSterlingBusy(true); setSterlingError(""); setSterlingProposal(null);
    try {
      const response = await fetch("/executive-dashboard/concierge/personal/adjustment", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: sterlingText, today, state }),
      });
      const payload = await response.json() as { ok: boolean; proposal?: SterlingProposal; error?: string; clarification?: string | null };
      if (!response.ok || !payload.ok || !payload.proposal) {
        throw new Error(payload.clarification || payload.error || "adjustment-failed");
      }
      setSterlingProposal(payload.proposal);
    } catch (error) {
      const message = error instanceof Error ? error.message : "adjustment-failed";
      setSterlingError(message === "performance-analysis-unavailable"
        ? "Sterling interpretation is not configured. Your training plan has not changed."
        : message === "adjustment-failed" || message.startsWith("performance-adjustment-failed")
          ? "Sterling could not interpret that request. Your training plan has not changed; retry or describe the workout and date more specifically."
          : message);
    } finally { setSterlingBusy(false); }
  }

  async function confirmSterling() {
    if (!sterlingProposal || sterlingBusy) return;
    setSterlingBusy(true); setSterlingError("");
    try {
      const next = applySterlingProposal(state, sterlingProposal);
      const saved = await persistStateMutation(next, {
        idempotencyKey: `adjustment-${sterlingProposal.id}`,
        action: "accept_adjustment",
        rawInput: sterlingProposal.command,
        proposal: sterlingProposal,
        accepted: { affectedWorkoutIds: sterlingProposal.affectedWorkoutIds, targetDate: sterlingProposal.targetDate },
      });
      setState(saved.state); setSterlingProposal(null); setSterlingText("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "performance-save-failed";
      setSterlingError(message === "performance-revision-conflict"
        ? "The schedule changed in another save. The latest saved schedule is now loaded; review the adjustment again before confirming."
        : message === "performance-mutation-action-unavailable"
          ? "This Preview database cannot record approved adjustments yet. The existing schedule remains authoritative."
          : "The adjustment was not saved. The existing schedule remains authoritative; retry after resolving the persistence error.");
    } finally { setSterlingBusy(false); }
  }

  function changeSterlingTarget(targetDate: string) {
    if (!sterlingProposal) return;
    const revised = retargetSterlingScheduleAdjustment(state, sterlingProposal, targetDate);
    if (!revised) { setSterlingError("Choose a date after the original planned workout."); return; }
    setSterlingError(""); setSterlingProposal(revised);
  }

  function openMealEntry(date: string) {
    setMealTargetDate(date); setMealEntryOpen(true); setExpandedDays((current) => new Set(current).add(date)); setIntakeText(""); setMealError("");
    if (intakeProposal?.kind === "meal") { setIntakeProposal(null); setMealEstimate(null); setMealPhoto(null); setIntakeFile(null); }
  }

  async function saveRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const at = new Date().toISOString();
    const metric = <T,>(value: T | undefined, source: "manual" | "subjective") => value === undefined || value === "" ? undefined : { value, source };
    const existing = state.recoveryEntries.find((item) => item.date === recoveryTargetDate);
    const entry: RecoveryEntry = {
      id: existing?.id ?? uid("recovery"), date: recoveryTargetDate, recordedAt: at,
      sleepHours: metric(numberOrUndefined(data.get("sleepHours")), "manual"), sleepQuality: metric(numberOrUndefined(data.get("sleepQuality")), "subjective"),
      recoveryScore: metric(numberOrUndefined(data.get("recoveryScore")), "manual"), strain: metric(numberOrUndefined(data.get("strain")), "manual"),
      restingHeartRate: metric(numberOrUndefined(data.get("restingHeartRate")), "manual"), hrvMs: metric(numberOrUndefined(data.get("hrvMs")), "manual"),
      bodyweightLb: metric(numberOrUndefined(data.get("bodyweightLb")), "manual"),
      fatigue: metric((String(data.get("fatigue") || "") || undefined) as RecoveryEntry["fatigue"] extends { value: infer T } | undefined ? T | undefined : never, "subjective"),
      soreness: metric((String(data.get("soreness") || "") || undefined) as "none" | "mild" | "moderate" | "high" | undefined, "subjective"),
      pain: metric((String(data.get("pain") || "") || undefined) as "none" | "mild" | "moderate" | "high" | undefined, "subjective"),
      notes: String(data.get("notes") || "").trim().slice(0, 600) || undefined, provenance: ["manual_recovery", "user_confirmed"],
    };
    const next = { ...state, recoveryEntries: [entry, ...state.recoveryEntries.filter((item) => item.date !== recoveryTargetDate)] };
    setRecoveryFeedback("Saving reviewed recovery check-in…");
    try {
      const saved = await persistStateMutation(next, { idempotencyKey: `manual-recovery-${entry.id}-${at}`, action: "accept_recovery", entryId: entry.id, sourceType: "text", accepted: entry });
      setState(saved.state); setRecoveryEntryOpen(false); setRecoveryFeedback(saved.duplicate ? "Recovery check-in already saved" : "Recovery check-in saved successfully");
    } catch { setRecoveryFeedback("The recovery check-in was not saved. Existing recovery data remains unchanged."); }
  }

  async function chooseRecoveryScreenshot(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    setRecoveryBusy(true); setRecoveryFeedback("Recovery screenshot selected. Sterling is reading only visible daily metrics…"); setRecoveryProposal(null); setRecoveryFile(null);
    try {
      const prepared = await prepareUpload(file, setRecoveryFeedback); const image = prepared.file;
      const body = new FormData(); body.set("image", image); body.set("originalSourceDigest", prepared.original.digest); body.set("sourceType", "recovery_screenshot"); body.set("intent", "recovery"); body.set("knownMeals", "[]"); body.set("nutritionTargets", JSON.stringify(state.nutritionTargets));
      const response = await fetch("/executive-dashboard/concierge/personal/intake", { method: "POST", body });
      const payload = await response.json() as { ok: boolean; proposal?: NaturalIngestionProposal; error?: string };
      if (!response.ok || !payload.ok || payload.proposal?.kind !== "recovery") throw new Error(payload.error || "analysis-failed");
      setRecoveryFile(image); setRecoveryProposal(payload.proposal); setRecoveryEntryOpen(true); setExpandedDays((current) => new Set(current).add(recoveryTargetDate));
      setRecoveryFeedback("Extraction complete. Review and approve the visible daily metrics below; nothing is saved yet.");
    } catch (error) {
      setRecoveryFeedback(error instanceof Error && ["unsupported-format", "file-too-large", "conversion-failed"].includes(error.message) ? performanceImageMessage(error) : error instanceof Error && error.message === "performance-analysis-no-recovery-metrics" ? "No usable recovery metrics were visible. Enter them manually or choose another screenshot; nothing was saved." : "Sterling could not read that recovery screenshot. Nothing was saved.");
    } finally { setRecoveryBusy(false); }
  }

  async function acceptRecovery(facts: RecoveryProposalFacts, date: string, dateConflictConfirmed: boolean) {
    const proposal = recoveryProposal; const file = recoveryFile;
    if (!proposal || !file || !proposal.sourceDigest) return;
    const existing = state.recoveryEntries.find((item) => item.date === date);
    const corrections: AuditFact[] = existing ? [{ field: "recovery", from: existing, to: facts }] : [];
    if (compareActivityDate(proposal.sourceDate, date) === "conflict" && dateConflictConfirmed) corrections.push({ field: "date", from: visibleActivityDateLabel(proposal.sourceDate!), to: date });
    const entry: RecoveryEntry = {
      ...facts, id: existing?.id ?? `recovery-${proposal.sourceDigest.slice(0, 32)}`, date, recordedAt: new Date().toISOString(), sourceType: "recovery_screenshot",
      source: { name: file.name, type: file.type, size: file.size }, sterlingProposal: proposal, assumptions: proposal.assumptions, corrections,
      idempotencyKey: `accept-recovery-${proposal.sourceDigest}`, provenance: ["sterling", "user_confirmed"],
    };
    const next = { ...state, recoveryEntries: [entry, ...state.recoveryEntries.filter((item) => item.id !== entry.id && item.date !== date)] };
    setRecoveryFeedback("Saving reviewed recovery evidence…");
    try {
      const saved = await persistStateMutation(next, { idempotencyKey: entry.idempotencyKey, action: "accept_recovery", entryId: entry.id, sourceType: "recovery_screenshot", proposal, accepted: entry, corrections }, file);
      setState(saved.state); setRecoveryProposal(null); setRecoveryFile(null); setRecoveryEntryOpen(false); setRecoveryFeedback(saved.duplicate ? "Recovery screenshot already logged" : "Recovery evidence saved successfully");
    } catch (error) {
      setRecoveryFeedback(error instanceof Error && error.message === "performance-revision-conflict" ? "Recovery changed in another save. Review the refreshed day before trying again." : "The reviewed recovery evidence was not saved. Existing recovery data remains unchanged.");
    }
  }

  async function rejectRecovery() {
    const proposal = recoveryProposal; setRecoveryProposal(null); setRecoveryFile(null);
    if (!proposal) return;
    setRecoveryFeedback("Recovery proposal rejected; nothing was saved.");
    try { await persistStateMutation(state, { idempotencyKey: `reject-${proposal.id}`, action: "reject_proposal", sourceType: proposal.sourceType, proposal }); } catch { /* Rejection never changes canonical recovery. */ }
  }

  async function analyzeIntake(input: { text?: string; file?: File; sourceType: PerformanceSourceType }) {
    setMealBusy(true); setIntakeBusy(true); setMealError(""); setMealEstimate(null); setIntakeProposal(null);
    try {
      const prepared = input.file ? await prepareUpload(input.file, input.sourceType === "activity_screenshot" ? setActivityFeedback : setMealError) : undefined; const image = prepared?.file; const body = new FormData();
      if (image) body.set("image", image); if (prepared) body.set("originalSourceDigest", prepared.original.digest); if (input.text?.trim()) body.set("text", input.text.trim()); body.set("sourceType", input.sourceType);
      body.set("knownMeals", JSON.stringify(frequentlyEaten.map((meal) => `${meal.name}: ${meal.calories} kcal, ${meal.protein}P, ${meal.carbs}C, ${meal.fat}F`)));
      body.set("nutritionTargets", JSON.stringify(state.nutritionTargets));
      const response = await fetch("/executive-dashboard/concierge/personal/intake", { method: "POST", body });
      const payload = await response.json() as { ok: boolean; proposal?: NaturalIngestionProposal; error?: string };
      if (!response.ok || !payload.ok || !payload.proposal) throw new Error(payload.error || "analysis-failed");
      setIntakeFile(image ?? null); setIntakeProposal(payload.proposal);
      if (payload.proposal.kind === "meal") { setMealPhoto(image ? { name: image.name, type: image.type, size: image.size } : null); setMealEstimate(payload.proposal.meal); }
    } catch (error) { setMealError(error instanceof Error && error.message === "performance-analysis-unavailable" ? "Sterling interpretation is not configured. Manual logging remains available." : error instanceof Error && ["unsupported-format", "file-too-large", "conversion-failed"].includes(error.message) ? performanceImageMessage(error) : "Extraction failed. Sterling could not interpret that photo; nothing was saved."); }
    finally { setMealBusy(false); setIntakeBusy(false); }
  }

  function chooseMealPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (file) void analyzeIntake({ text: intakeText, file, sourceType: "meal_photo" });
  }

  function submitMealDescription(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (intakeText.trim()) void analyzeIntake({ text: intakeText, sourceType: "text" }); }
  function chooseNutritionLabel(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; event.target.value = ""; if (file) void analyzeIntake({ text: intakeText, file, sourceType: "nutrition_label" }); }
  function chooseActivityScreenshot(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (file) { setActivityFeedback(""); setActivityDefaultDate(pastActivityDate); setActivityMaxDate(shiftDate(today, -1)); void analyzeIntake({ file, sourceType: "activity_screenshot" }); }
  }

  function chooseSelectedWorkoutCompletion(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || !selectedWorkout || selectedWorkout.date > today) return;
    setActivityFeedback("After photo selected. Sterling is reading only visible completion facts…");
    setCompletionWorkoutId(selectedWorkout.id); setActivityDefaultDate(selectedWorkout.date); setActivityMaxDate(today);
    void analyzeIntake({ file, sourceType: "activity_screenshot" });
  }

  async function chooseTonalCompletionScreenshot(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    setTonalCompletionFeedback("Completion screenshot selected. Sterling is reading only the visible results…");
    const session = selectedWorkoutTonalSession;
    if (!session) {
      setTonalCompletionFeedback("Choose the exact previous Tonal session before selecting its completion screenshot.");
      return;
    }
    if (!session?.plannedAt || !session.plannedSource) {
      setTonalCompletionFeedback("Screenshot selected, but this historical session needs reviewed plan evidence before completion can be matched. Nothing was uploaded or saved.");
      return;
    }
    setMealBusy(true); setIntakeBusy(true); setMealError(""); setIntakeProposal(null);
    try {
      const prepared = await prepareUpload(file, setTonalCompletionFeedback); const image = prepared.file;
      const body = new FormData(); body.set("image", image); body.set("originalSourceDigest", prepared.original.digest); body.set("sourceType", "activity_screenshot"); body.set("intent", "completed_activity");
      body.set("text", session.title
        ? `Completion review for founder-approved ${TONAL_PROGRAM_CATALOG[state.tonal.selectedProgramId].title} sequence position ${session.order}. The visible workout title must match the approved planned title; do not infer it.`
        : `Completion review for founder-approved ${TONAL_PROGRAM_CATALOG[state.tonal.selectedProgramId].title} sequence position ${session.order}. The approved plan had no visible title, so extract every visible movement for exact matching; do not infer a title or movement.`);
      body.set("knownMeals", "[]"); body.set("nutritionTargets", JSON.stringify(state.nutritionTargets));
      const response = await fetch("/executive-dashboard/concierge/personal/intake", { method: "POST", body });
      const payload = await response.json() as { ok: boolean; proposal?: NaturalIngestionProposal; error?: string };
      if (!response.ok || !payload.ok || payload.proposal?.kind !== "activity") throw new Error(payload.error || "analysis-failed");
      const facts = { ...payload.proposal.activity, tonalProgramTitle: payload.proposal.activity.tonalProgramTitle ?? TONAL_PROGRAM_CATALOG[state.tonal.selectedProgramId].title, tonalSessionOrder: { value: session.order, evidence: "user_supplied" as const } };
      const scheduledDate = state.schedule.find((workout) => workout.id === session.scheduledWorkoutId)?.date ?? today;
      setTonalCompletionTargetOrder(session.order); setCompletionWorkoutId(session.scheduledWorkoutId ?? null); setIntakeFile(image); setActivityDefaultDate(scheduledDate); setActivityMaxDate(today); setPastActivityOpen(true); setExpandedDays((current) => new Set(current).add(scheduledDate)); setIntakeProposal({ ...payload.proposal, activity: facts, activities: [facts] });
      setTonalCompletionFeedback("Extraction complete. Review the selected Tonal session below; nothing is saved until you approve it.");
    } catch (error) {
      setTonalCompletionTargetOrder(null);
      setTonalCompletionFeedback(error instanceof Error && ["unsupported-format", "file-too-large", "conversion-failed"].includes(error.message) ? performanceImageMessage(error) : "Extraction failed. Sterling could not read that Tonal completion screenshot. Nothing was saved.");
    }
    finally { setMealBusy(false); setIntakeBusy(false); }
  }

  async function chooseUpcomingTonalScreenshot(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    const session = nextTonalSession(state);
    if (!file || !session || state.program.status !== "active") return;
    setTonalPlanTargetOrder(session.order);
    setTonalPlanBusy(true); setTonalPlanFeedback(""); setMealError("");
    try {
      const prepared = await prepareUpload(file, setTonalPlanFeedback); const image = prepared.file;
      const body = new FormData(); body.set("image", image); body.set("originalSourceDigest", prepared.original.digest); body.set("sourceType", "activity_screenshot"); body.set("intent", "upcoming_tonal_session");
      body.set("text", `Upcoming ${TONAL_PROGRAM_CATALOG[state.tonal.selectedProgramId].title} sequence position ${session.order}. Extract only visible plan details; this is not a completion.`);
      body.set("knownMeals", "[]"); body.set("nutritionTargets", JSON.stringify(state.nutritionTargets));
      const response = await fetch("/executive-dashboard/concierge/personal/intake", { method: "POST", body });
      const payload = await response.json() as { ok: boolean; proposal?: NaturalIngestionProposal; error?: string };
      if (!response.ok || !payload.ok || payload.proposal?.kind !== "activity") throw new Error(payload.error || "analysis-failed");
      setTonalPlanFile(image); setTonalPlanProposal(payload.proposal);
    } catch (error) { setTonalPlanFeedback(error instanceof Error && ["unsupported-format", "file-too-large", "conversion-failed"].includes(error.message) ? performanceImageMessage(error) : "Extraction failed. Sterling could not read that upcoming-workout screenshot. Nothing was saved."); }
    finally { setTonalPlanBusy(false); }
  }

  async function chooseHistoricalTonalPlanScreenshot(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    const session = selectedWorkoutTonalSession;
    if (!file || !session || session.completedActivityId || state.program.status !== "active") return;
    setTonalPlanTargetOrder(session.order); setTonalPlanBusy(true); setTonalPlanFeedback(""); setMealError("");
    try {
      const prepared = await prepareUpload(file, setTonalPlanFeedback); const image = prepared.file;
      const body = new FormData(); body.set("image", image); body.set("originalSourceDigest", prepared.original.digest); body.set("sourceType", "activity_screenshot"); body.set("intent", "upcoming_tonal_session");
      body.set("text", `Historical plan evidence for founder-selected ${TONAL_PROGRAM_CATALOG[state.tonal.selectedProgramId].title} sequence position ${session.order}. Extract only visible plan details; this is not a completion and does not reopen the session.`);
      body.set("knownMeals", "[]"); body.set("nutritionTargets", JSON.stringify(state.nutritionTargets));
      const response = await fetch("/executive-dashboard/concierge/personal/intake", { method: "POST", body });
      const payload = await response.json() as { ok: boolean; proposal?: NaturalIngestionProposal; error?: string };
      if (!response.ok || !payload.ok || payload.proposal?.kind !== "activity") throw new Error(payload.error || "analysis-failed");
      setTonalPlanFile(image); setTonalPlanProposal(payload.proposal); setTonalPlanFeedback("Historical plan evidence ready for review. Nothing is saved until you approve it.");
    } catch (error) {
      setTonalPlanTargetOrder(null); setTonalPlanFile(null); setTonalPlanProposal(null);
      setTonalPlanFeedback(error instanceof Error && ["unsupported-format", "file-too-large", "conversion-failed"].includes(error.message) ? performanceImageMessage(error) : "Extraction failed. Sterling could not read that historical plan screenshot. Nothing was saved.");
    } finally { setTonalPlanBusy(false); }
  }

  async function acceptUpcomingTonalPlan(input: { title?: string; movements: TonalProgramMovement[] }) {
    const session = tonalPlanTargetOrder === null ? undefined : state.tonal.enrollment.sessions.find((candidate) => candidate.order === tonalPlanTargetOrder); const proposal = tonalPlanProposal; const file = tonalPlanFile;
    if (!session || !proposal || !file || !proposal.sourceDigest) return;
    const at = new Date().toISOString();
    const source = { kind: "tonal_app_screenshot" as const, reference: `sha256:${proposal.sourceDigest}`, digest: proposal.sourceDigest, reviewedAt: at, file: { name: file.name, type: file.type, size: file.size } };
    try {
      const next = planTonalSessionFromScreenshot(state, { sequencePosition: session.order, title: input.title, movements: input.movements, source, approvedAt: at });
      const idempotencyKey = `plan-tonal-${session.order}-${proposal.sourceDigest}`;
      const saved = await persistStateMutation(next, { idempotencyKey, action: "plan_strength_session", entryId: `tonal-plan-${session.order}-${proposal.sourceDigest.slice(0, 32)}`, sourceType: "activity_screenshot", proposal, accepted: { sequencePosition: session.order, sourceDigest: proposal.sourceDigest, title: input.title, movements: input.movements } }, file);
      setState(saved.state); setTonalPlanProposal(null); setTonalPlanFile(null); setTonalPlanTargetOrder(null); setTonalPlanFeedback(saved.duplicate ? "Workout plan already saved" : `Tonal session ${session.order} plan evidence saved successfully`);
    } catch (error) {
      setTonalPlanFeedback(error instanceof Error && error.message === "performance-mutation-action-unavailable" ? "Preview cannot audit planned Tonal sessions yet. Nothing changed." : "The planned session was not saved. Review the current sequence and retry.");
    }
  }

  function updateMealItem(id: string, patch: Partial<MealItem>) { setMealEstimate((estimate) => estimate ? { ...estimate, items: estimate.items.map((item) => item.id === id ? { ...item, ...patch } : item) } : null); }
  async function acceptMeal(mealType?: MealLog["mealType"]) {
    if (!mealEstimate || intakeProposal?.kind !== "meal") return;
    const idempotencyKey = `accept-${intakeProposal.id}`; const at = new Date().toISOString();
    const meal = buildAcceptedMeal({ proposal: intakeProposal, items: mealEstimate.items, mealType, occurredOn: mealTargetDate, timestamp: at, id: uid("meal"), idempotencyKey, source: mealPhoto ?? undefined });
    const next = acceptProposal(state, intakeProposal, meal);
    try {
      const saved = await persistStateMutation(next, { idempotencyKey, action: "accept_meal", entryId: meal.id, rawInput: intakeProposal.rawInput, sourceType: intakeProposal.sourceType, proposal: intakeProposal, accepted: meal, corrections: meal.corrections }, intakeFile ?? undefined);
      setState(saved.state); setMealEstimate(null); setMealPhoto(null); setIntakeProposal(null); setIntakeFile(null); setIntakeText("");
    } catch { setMealError("The reviewed meal was not saved. Nothing was added; retry when private persistence is available."); }
  }

  async function acceptActivity(facts: ActivityFacts[], occurredOn: string, dateConflictConfirmed: boolean) {
    if (intakeProposal?.kind !== "activity") return;
    if (tonalCompletionTargetOrder !== null) {
      const completion = facts.find((candidate) => candidate.tonalSessionOrder?.value === tonalCompletionTargetOrder);
      if (!completion || !matchesTonalSessionCompletion(state, {
        sequencePosition: completion.tonalSessionOrder?.value,
        programTitle: completion.tonalProgramTitle,
        workoutTitle: completion.workoutTitle,
        movements: completion.tonalMovements,
      }, { allowCompletedEvidence: true })) {
        setTonalCompletionFeedback("This screenshot does not match the founder-selected Tonal session. Review the program, sequence position, title, and visible movements; nothing was saved.");
        return;
      }
    }
    const digest = intakeProposal.sourceDigest;
    const idempotencyKey = digest ? `accept-activity-${digest}` : `accept-${intakeProposal.id}`; const at = new Date().toISOString();
    const activityId = digest ? `activity-${digest.slice(0, 32)}` : uid("activity");
    const originals = intakeProposal.activities?.length ? intakeProposal.activities : [intakeProposal.activity];
    const activities = facts.map((activityFacts, index) => buildAcceptedActivity({ proposal: intakeProposal, originalFacts: originals[index], facts: activityFacts, occurredOn, timestamp: at, id: index === 0 ? activityId : `${activityId}-${index + 1}`, idempotencyKey, dateConflictConfirmed, source: intakeFile ? { name: intakeFile.name, type: intakeFile.type, size: intakeFile.size } : undefined, targets: state.nutritionTargets, scheduledWorkoutId: index === 0 ? completionWorkoutId ?? undefined : undefined }));
    const targetedTonalSession = tonalCompletionTargetOrder === null ? undefined : state.tonal.enrollment.sessions.find((session) => session.order === tonalCompletionTargetOrder);
    const existingCompletion = targetedTonalSession?.completedActivityId ? state.activities.find((activity) => activity.id === targetedTonalSession.completedActivityId) : undefined;
    if (existingCompletion && digest && intakeFile) {
      const enriched = { ...activities[0]!, id: existingCompletion.id, idempotencyKey: existingCompletion.idempotencyKey, scheduledWorkoutId: existingCompletion.scheduledWorkoutId ?? completionWorkoutId ?? targetedTonalSession?.scheduledWorkoutId, corrections: [...existingCompletion.corrections, ...activities[0]!.corrections] };
      const enrichedState = { ...state, activities: state.activities.map((activity) => activity.id === existingCompletion.id ? enriched : activity) };
      try {
        const saved = await persistStateMutation(enrichedState, { idempotencyKey: `enrich-activity-${existingCompletion.id}-${digest}`, action: "edit_activity", entryId: existingCompletion.id, sourceType: intakeProposal.sourceType, proposal: intakeProposal, accepted: enriched, corrections: enriched.corrections }, intakeFile);
        setState(saved.state); setIntakeProposal(null); setIntakeFile(null); setTonalCompletionTargetOrder(null); setCompletionWorkoutId(null); setTonalCompletionFeedback(saved.duplicate ? "Completion evidence already recorded" : "Completion evidence added without creating another completed session");
      } catch (error) { setTonalCompletionFeedback(error instanceof Error && error.message.includes("source-upload") ? performanceImageMessage(new Error("upload-failed")) : "The reviewed completion evidence was not saved. Existing history remains unchanged."); }
      return;
    }
    const acceptedState = acceptActivityProposal(state, intakeProposal, activities);
    const tonalState = activities.reduce((current, activity) => markTonalSessionCompletedFromActivity(current, { activityId: activity.id, sequencePosition: activity.facts.tonalSessionOrder?.value, programTitle: activity.facts.tonalProgramTitle, workoutTitle: activity.facts.workoutTitle, movements: activity.facts.tonalMovements, at }), acceptedState);
    const next = completionWorkoutId && tonalCompletionTargetOrder === null ? completeScheduledWorkoutFromActivity(tonalState, { workoutId: completionWorkoutId, activityId, at }) : tonalState;
    try {
      const saved = await persistStateMutation(next, { idempotencyKey, action: "accept_activity", entryId: activityId, rawInput: intakeProposal.rawInput, sourceType: intakeProposal.sourceType, proposal: intakeProposal, accepted: activities, corrections: activities.flatMap((activity) => activity.corrections) }, intakeFile ?? undefined);
      setState(saved.state); setIntakeProposal(null); setIntakeFile(null); setMealError(""); setPastActivityOpen(false); setTonalCompletionTargetOrder(null); setCompletionWorkoutId(null);
      if (tonalCompletionTargetOrder !== null) setTonalCompletionFeedback(saved.duplicate ? "Completed workout already logged" : "Completed workout logged and matched to the approved session");
      setActivityFeedback(saved.duplicate ? "Activity already logged" : activities.length === 1 ? "Activity logged successfully" : `${activities.length} activities logged successfully`);
    } catch (error) { setMealError(error instanceof Error && error.message.includes("source-upload") ? performanceImageMessage(new Error("upload-failed")) : "The reviewed activity was not saved. Nothing was added; retry when private persistence is available."); }
  }

  async function correctActivityDate(activityId: string, occurredOn: string) {
    const current = state.activities.find((activity) => activity.id === activityId);
    if (!current || current.occurredOn === occurredOn) return;
    const corrected = correctActivityDateInState(state, activityId, occurredOn);
    try {
      const saved = await persistStateMutation(corrected.state, {
        idempotencyKey: `edit-activity-date-${activityId}-${occurredOn}`,
        action: "edit_activity",
        entryId: activityId,
        sourceType: current.sourceType,
        proposal: current.sterlingProposal,
        accepted: corrected.activity,
        corrections: corrected.activity.corrections,
        sourceStoragePath: current.source?.storagePath,
      });
      setState(saved.state); setActivityFeedback(saved.duplicate ? "Activity date already corrected" : "Activity date corrected"); setMealError("");
    } catch { setMealError("The activity date was not corrected. The existing date remains authoritative."); }
  }

  async function rejectIntake() {
    if (!intakeProposal) return;
    const proposal = intakeProposal; setIntakeProposal(null); setMealEstimate(null); setMealPhoto(null); setIntakeFile(null); setTonalCompletionTargetOrder(null);
    try { await persistStateMutation(state, { idempotencyKey: `reject-${proposal.id}`, action: "reject_proposal", rawInput: proposal.rawInput, sourceType: proposal.sourceType, proposal }); } catch { /* Rejection still changes no canonical totals. */ }
  }

  async function deleteSource(kind: "meal" | "activity" | "recovery", entryId: string) {
    setPersistStatus("saving"); persistInFlight.current = true;
    try {
      const response = await fetch("/executive-dashboard/concierge/personal/state", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: revisionRef.current, entryId, kind, idempotencyKey: uid("delete-source") }) });
      const payload = await response.json() as { ok: boolean; state?: PersonalState; revision?: number; error?: string };
      if (response.status === 409) {
        if (payload.state) setState(parsePersonalState(JSON.stringify(payload.state), today));
        const conflictRevision = payload.revision ?? 0; revisionRef.current = conflictRevision; setPersistStatus("conflict"); return;
      }
      if (!response.ok || !payload.ok || !payload.state) throw new Error(payload.error ?? "performance-source-delete-failed");
      const saved = parsePersonalState(JSON.stringify(payload.state), today); const savedRevision = payload.revision ?? revisionRef.current + 1;
      lastPersistedState.current = JSON.stringify(saved); setState(saved); revisionRef.current = savedRevision; setPersistStatus("saved");
    } catch { setPersistStatus("error"); setMealError("The private source file could not be deleted. No structured entry was removed."); }
    finally { persistInFlight.current = false; }
  }

  async function saveManualMeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const name = String(data.get("name") || "").trim(); if (!name) return;
    const item: MealItem = { id: uid("manual-item"), name, portion: String(data.get("portion") || "").trim(), calories: Number(data.get("calories")) || 0, protein: Number(data.get("protein")) || 0, carbs: Number(data.get("carbs")) || 0, fat: Number(data.get("fat")) || 0, confidence: "high" };
    const meal: MealLog = { id: uid("meal"), timestamp: new Date().toISOString(), occurredOn: mealTargetDate, mealType: (String(data.get("mealType") || "") || undefined) as MealLog["mealType"], items: [item], calories: item.calories, protein: item.protein, carbs: item.carbs, fat: item.fat, provenance: ["user_confirmed"] };
    const next = { ...state, meals: [meal, ...state.meals] };
    try {
      const saved = await persistStateMutation(next, { idempotencyKey: `manual-meal-${meal.id}`, action: "accept_meal", entryId: meal.id, sourceType: "text", accepted: meal });
      setState(saved.state); setLastAddedMealId(meal.id); form.reset();
    } catch { setMealError("The reviewed manual meal was not saved. Nothing was added."); }
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

  async function oneTapLog(frequent: FrequentMealCandidate) {
    const id = uid("meal"); const meal = { ...logFrequentMeal(frequent, new Date().toISOString(), id), occurredOn: mealTargetDate };
    try {
      const saved = await persistStateMutation({ ...state, meals: [meal, ...state.meals] }, { idempotencyKey: `frequent-meal-${id}`, action: "accept_meal", entryId: id, sourceType: "text", accepted: meal });
      setState(saved.state); setLastAddedMealId(id); setEditingMealId(null);
    } catch { setMealError("The frequent meal was not saved. Nothing was added."); }
  }

  function undoLastMeal() {
    if (!lastAddedMealId) return;
    void voidMeal(lastAddedMealId); setLastAddedMealId(null); setEditingMealId(null);
  }

  async function saveMealCorrection(mealId: string, items: MealItem[]) {
    const current = state.meals.find((meal) => meal.id === mealId); if (!current) return;
    const corrected = { ...current, items, ...totals(items), corrections: [...(current.corrections ?? []), { field: "items", from: current.items, to: items }] };
    const next = { ...state, meals: state.meals.map((meal) => meal.id === mealId ? corrected : meal) };
    try {
      const saved = await persistStateMutation(next, { idempotencyKey: `edit-meal-${mealId}-${Date.now()}`, action: "edit_meal", entryId: mealId, sourceType: current.sourceType ?? "text", accepted: corrected, corrections: corrected.corrections });
      setState(saved.state); setEditingMealId(null);
    } catch { setMealError("The meal correction was not saved. Existing nutrition remains unchanged."); }
  }

  async function voidMeal(mealId: string) {
    const current = state.meals.find((meal) => meal.id === mealId); if (!current || !window.confirm("Void this meal entry? Its audit history and source evidence remain preserved.")) return;
    try {
      const saved = await persistStateMutation({ ...state, meals: state.meals.filter((meal) => meal.id !== mealId) }, { idempotencyKey: `void-meal-${mealId}`, action: "edit_meal", entryId: mealId, sourceType: current.sourceType ?? "text", accepted: { voided: true, prior: current }, corrections: [{ field: "status", from: "accepted", to: "voided" }] });
      setState(saved.state); setEditingMealId(null);
    } catch { setMealError("The meal was not voided. Existing nutrition remains unchanged."); }
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
    { id: "today", label: "Week", href: "/executive-dashboard/concierge/personal" },
    { id: "progress", label: "Progress", href: "/executive-dashboard/concierge/personal/progress" },
  ];
  if (!ready) return <main className={styles.app}><section className={styles.card}>Opening Performance…</section></main>;

  if (initialView !== "progress") return <main className={styles.app} data-personal-performance data-weekly-performance>
    <header className={styles.header}><div><p className={styles.eyebrow}>Personal / Performance</p><h1>Your week, one day at a time.</h1><p>Meals, training, recovery, evidence, and corrections stay with the day they happened.</p></div><span className={styles.private}>Private · {state.program.status === "setup" ? "program not started" : `active since ${state.program.anchorDate}`} · {persistStatus === "saved" ? "saved" : persistStatus === "saving" ? "saving…" : persistStatus === "browser" ? "browser fallback" : persistStatus === "conflict" ? "refreshed after conflict" : persistStatus}</span></header>
    {activityFeedback ? <p aria-live="polite" className={styles.warning}>{activityFeedback}</p> : null}
    {mealError ? <p role="alert" className={styles.warning}>{mealError}</p> : null}
    <nav className={styles.tabs} aria-label="Performance sections">{tabs.map((tab) => <Link key={tab.id} href={tab.href} aria-current={tab.id === "today" ? "page" : undefined}>{tab.label}</Link>)}</nav>

    {state.program.status === "setup" ? <section className={`${styles.card} ${styles.hero}`} data-program-status="setup">
      <p className={styles.kicker}>Training program · not started / setup</p>
      <h2>Fit Over 40 begins only when you approve the start.</h2>
      <p>Three weekly Tonal slots, two run/walk days, protected recovery, and Sunday hard rest. Future workout titles arrive from Tonal screenshots just in time and are never invented.</p>
      <div className={styles.actions}><button className={styles.primary} onClick={() => void configureTonalSequence()} disabled={tonalConfigBusy}>{tonalConfigBusy ? "Saving…" : "Confirm Fit Over 40 enrollment"}</button></div>
      {tonalConfigFeedback ? <p aria-live="polite" className={styles.warning}>{tonalConfigFeedback}</p> : null}
      {tonalEnrollmentReady(state.tonal) ? <p className={styles.provenance}>Enrollment saved · 3 weekly sessions · 4 weeks · 12 prescribed sessions · activation remains separate.</p> : <p className={styles.provenance}>Activation is blocked until program identity and cadence are founder-confirmed.</p>}
      <div className={styles.formGrid}><label>Week 1 start (Monday)<input type="date" min={today} value={programStartDate} onChange={(event) => { setProgramStartDate(event.target.value); setActivationReview(false); setActivationError(""); }} /></label></div>
      <div className={styles.actions}><button className={styles.primary} onClick={reviewActivation} disabled={activationBusy}>Review Week 1</button></div>
      {activationError ? <p role="alert" className={styles.warning}>{activationError}</p> : null}
      {activationReview ? <div className={styles.proposal}><strong>Proposed — the program is still not started</strong><p>Week 1 begins {prettyDate(programStartDate)}. Existing accepted history stays unchanged.</p><div className={styles.proposalGrid}>{activationPreview.map((workout) => <div key={workout.id}><span>{prettyDate(workout.date)}</span><strong>{workout.prescription.name}</strong><small>{workout.prescription.durationMinutes} min · {workout.prescription.intent}</small></div>)}</div><div className={styles.actions}><button className={styles.primary} onClick={() => void confirmActivation()} disabled={activationBusy || !tonalEnrollmentReady(state.tonal)}>{activationBusy ? "Activating…" : "Confirm and activate"}</button><button onClick={() => setActivationReview(false)} disabled={activationBusy}>Cancel</button></div></div> : null}
    </section> : null}

    <section className={styles.weekNavigator} aria-label="Week navigation">
      <button type="button" onClick={() => { const prior = shiftDate(displayWeekStart, -7); setDisplayWeekStart(prior); setExpandedDays(new Set([prior])); }}>← Previous</button>
      <div><p className={styles.kicker}>Selected week</p><strong>{prettyDate(displayWeekStart)} – {prettyDate(shiftDate(displayWeekStart, 6))}</strong></div>
      <button type="button" onClick={() => { const current = mondayFor(today); setDisplayWeekStart(current); setExpandedDays(new Set([today])); }}>This week</button>
      <button type="button" onClick={() => { const next = shiftDate(displayWeekStart, 7); setDisplayWeekStart(next); setExpandedDays(new Set([next])); }}>Next →</button>
    </section>

    <div className={styles.dayList}>
      {visibleDays.map((day) => {
        const expanded = expandedDays.has(day.date);
        const isToday = day.date === today;
        const daySelectedWorkout = selectedWorkout?.date === day.date ? selectedWorkout : undefined;
        return <section className={`${styles.dayPanel} ${isToday ? styles.dayToday : ""}`} key={day.date} data-day={day.date}>
          <button type="button" className={styles.daySummary} aria-expanded={expanded} aria-controls={`performance-day-${day.date}`} onClick={() => setExpandedDays((current) => { const next = new Set(current); if (next.has(day.date)) next.delete(day.date); else next.add(day.date); return next; })}>
            <span><b>{prettyDate(day.date)}</b><small>{isToday ? "Today" : day.date < today ? "History" : "Planned"}</small></span>
            <span><b>{day.consumed.calories} / {day.targets.calories}</b><small>kcal</small></span>
            <span><b>{day.consumed.protein} / {day.targets.protein}g</b><small>protein</small></span>
            <span><b>{day.activityCount}</b><small>activities</small></span>
            <span aria-hidden="true">{expanded ? "−" : "+"}</span>
          </button>
          {expanded ? <div id={`performance-day-${day.date}`} className={styles.dayBody}>
            <section className={styles.daySection} aria-labelledby={`nutrition-${day.date}`}>
              <div className={styles.daySectionHeading}><div><p className={styles.kicker}>Nutrition</p><h2 id={`nutrition-${day.date}`}>Daily balance</h2></div><button type="button" aria-expanded={mealEntryOpen && mealTargetDate === day.date} onClick={() => mealEntryOpen && mealTargetDate === day.date ? setMealEntryOpen(false) : openMealEntry(day.date)}>{mealEntryOpen && mealTargetDate === day.date ? "Close Meal Entry" : "Add Meal"}</button></div>
              {mealEntryOpen && mealTargetDate === day.date ? <div className={styles.entryPanel} ref={mealEntryRef} tabIndex={-1} data-meal-entry-date={day.date}>
                <p className={styles.provenance}>New meal will be saved to {prettyDate(day.date)} after review.</p>
                <form className={styles.sterling} onSubmit={submitMealDescription}><textarea ref={mealTextRef} value={intakeText} onChange={(event) => setIntakeText(event.target.value)} placeholder="Describe the meal and portions." /><button className={styles.primary} disabled={intakeBusy || !intakeText.trim()}>{intakeBusy ? "Interpreting…" : "Interpret meal"}</button></form>
                <div className={styles.photoActions}><label className={`${styles.photoAction} ${styles.primary}`}>Take Meal Photo<input type="file" accept={PERFORMANCE_IMAGE_ACCEPT} capture="environment" onChange={chooseMealPhoto} disabled={intakeBusy} /></label><label className={styles.photoAction}>Upload Meal Photo<input type="file" accept={PERFORMANCE_IMAGE_ACCEPT} onChange={chooseMealPhoto} disabled={intakeBusy} /></label><label className={styles.photoAction}>Nutrition Label<input type="file" accept={PERFORMANCE_IMAGE_ACCEPT} onChange={chooseNutritionLabel} disabled={intakeBusy} /></label></div>
                {frequentlyEaten.length ? <div className={styles.frequentGrid}>{frequentlyEaten.slice(0, 6).map((frequent) => <button type="button" className={styles.frequentLog} key={frequent.id} onClick={() => void oneTapLog(frequent)}><strong>{frequent.name}</strong><small>{frequent.calories} kcal · {frequent.protein}P</small></button>)}</div> : null}
                {mealEstimate && intakeProposal?.kind === "meal" ? <div className={styles.proposal}><p className={styles.kicker}>Review required</p><MealReview estimate={mealEstimate} onChange={updateMealItem} onRemove={(id) => setMealEstimate((estimate) => estimate ? { ...estimate, items: estimate.items.filter((item) => item.id !== id) } : null)} onAdd={() => setMealEstimate((estimate) => estimate ? { ...estimate, items: [...estimate.items, { id: uid("meal-item"), name: "", portion: "", calories: 0, protein: 0, carbs: 0, fat: 0, confidence: "low" }] } : null)} onAccept={acceptMeal} onReject={() => void rejectIntake()} /></div> : null}
                <details><summary>Log manually</summary><form className={styles.recoveryForm} onSubmit={(event) => void saveManualMeal(event)}><div className={styles.formGrid}><label>Food<input name="name" required /></label><label>Portion<input name="portion" /></label><label>Meal type<select name="mealType"><option value="">Not supplied</option><option>breakfast</option><option>lunch</option><option>dinner</option><option>snack</option></select></label></div><div className={styles.formGrid}><label>Calories<input name="calories" type="number" min="0" required /></label><label>Protein<input name="protein" type="number" min="0" required /></label><label>Carbs<input name="carbs" type="number" min="0" required /></label><label>Fat<input name="fat" type="number" min="0" required /></label></div><button className={styles.primary}>Review and save manual meal</button></form></details>
              </div> : null}
              <div className={styles.dailyTotals}>
                {(["calories", "protein", "carbs", "fat"] as const).map((key) => <div key={key} className={day.remaining[key] < 0 ? styles.overTarget : ""}><span>{key}</span><strong>{day.consumed[key]} / {day.targets[key]}{key === "calories" ? "" : "g"}</strong><small>{day.remaining[key] >= 0 ? `${day.remaining[key]}${key === "calories" ? "" : "g"} remaining` : `${Math.abs(day.remaining[key])}${key === "calories" ? "" : "g"} over`}</small></div>)}
              </div>
              {day.meals.length ? <div className={styles.dayEntries}>{day.meals.map((meal) => <article className={styles.savedRow} key={meal.id}><span>{meal.mealType ?? "Meal"} · {meal.items.map((item) => item.name).join(", ")}</span><strong>{meal.calories} kcal · {meal.protein}P · {meal.carbs}C · {meal.fat}F</strong><small>{meal.aiEstimate ? "Sterling estimate reviewed" : meal.frequentMealId ? "Frequently Eaten" : "Founder entered"}{meal.photo ? " · source photo preserved" : ""}</small><div className={styles.compactActions}><button type="button" onClick={() => setEditingMealId((id) => id === meal.id ? null : meal.id)}>Edit</button><button type="button" onClick={() => saveAsFrequent(meal)}>Save as frequent</button><button type="button" onClick={() => void voidMeal(meal.id)}>Void</button>{meal.photo?.storagePath ? <button type="button" onClick={() => void deleteSource("meal", meal.id)}>Delete source image</button> : null}</div>{editingMealId === meal.id ? <MealOccurrenceEditor meal={meal} onSave={(items) => void saveMealCorrection(meal.id, items)} onDone={() => setEditingMealId(null)} /> : null}</article>)}</div> : <p className={styles.emptyState}>No accepted meals for this date.</p>}
            </section>

            <section className={styles.daySection} aria-labelledby={`training-${day.date}`}>
              <div className={styles.daySectionHeading}><div><p className={styles.kicker}>Training</p><h2 id={`training-${day.date}`}>Plan and actuals</h2></div>{day.date <= today ? <label className={styles.photoAction}>Log unplanned activity<input type="file" accept={PERFORMANCE_IMAGE_ACCEPT} onClick={() => { setPastActivityDate(day.date); setActivityDefaultDate(day.date); setActivityMaxDate(today); setPastActivityOpen(true); }} onChange={chooseActivityScreenshot} disabled={intakeBusy} /></label> : null}</div>
              {day.workouts.length ? <div className={styles.dayEntries}>{day.workouts.map((workout) => <article className={styles.workoutDetail} key={workout.id}>
                <button type="button" className={styles.workoutSelect} onClick={() => { const tonal = state.tonal.enrollment.sessions.find((session) => session.scheduledWorkoutId === workout.id); setSelectedWorkoutId(workout.id); setSelectedTonalSessionOrder(tonal?.order ?? null); setModifyOpen(false); setDeferOpen(false); }}><span>{workout.prescription.domain}</span><strong>{workout.prescription.name}</strong><small>{workout.status.replace("_", " ")} · {workout.prescription.durationMinutes} min</small></button>
                {daySelectedWorkout?.id === workout.id ? <div className={styles.workoutExpanded}>
                  <p>{workout.prescription.notes}</p>
                  {selectedWorkoutTonalSession ? <p className={styles.provenance}>Fit Over 40 · Session {selectedWorkoutTonalSession.order} · {selectedWorkoutTonalSession.plannedSource ? "approved Before Photo" : "Before Photo not attached"} · {selectedWorkoutTonalSession.completedActivityId ? "approved After Photo" : "After Photo not attached"}</p> : <p className={styles.provenance}>{workout.prescription.mode} · {day.activities.some((activity) => activity.scheduledWorkoutId === workout.id) ? "approved completion attached" : "completion not attached"}</p>}
                  {selectedWorkoutTonalSession?.movements.length ? <div className={styles.proposalGrid}>{selectedWorkoutTonalSession.movements.map((movement) => <div key={movement.name}><strong>{movement.name}</strong><small>{[movement.sets ? `${movement.sets} sets` : "", movement.reps ?? "", movement.prescribedResistance ?? ""].filter(Boolean).join(" · ") || "Details unknown"}</small></div>)}</div> : null}
                  <div className={styles.workoutControls}>{selectedWorkoutTonalSession ? <label className={styles.photoAction}>Before Photo<input type="file" accept={PERFORMANCE_IMAGE_ACCEPT} onChange={selectedWorkoutTonalSession.order === upcomingTonalSession?.order ? chooseUpcomingTonalScreenshot : chooseHistoricalTonalPlanScreenshot} disabled={tonalPlanBusy || Boolean(selectedWorkoutTonalSession.completedActivityId)} /></label> : <button type="button" disabled title="Before photos are optional and not needed for this activity type">Before Photo · optional</button>}{selectedWorkoutTonalSession ? <label className={`${styles.photoAction} ${styles.primary}`}>After Photo<input type="file" accept={PERFORMANCE_IMAGE_ACCEPT} onChange={chooseTonalCompletionScreenshot} disabled={intakeBusy || day.date > today} /></label> : <label className={`${styles.photoAction} ${styles.primary}`}>After Photo<input type="file" accept={PERFORMANCE_IMAGE_ACCEPT} onChange={chooseSelectedWorkoutCompletion} disabled={intakeBusy || day.date > today || ["deferred", "skipped", "replaced"].includes(workout.status)} /></label>}<button type="button" onClick={() => setModifyOpen((open) => !open)} disabled={["completed", "deferred", "skipped", "replaced"].includes(workout.status)}>Edit</button><button type="button" onClick={() => workout.status === "planned" || workout.status === "unresolved" ? startWorkout(workout) : setActivityFeedback(`Reviewing ${workout.prescription.name}: ${workout.status.replace("_", " ")}.`)}>Review / Complete</button>{["planned", "unresolved", "in_progress"].includes(workout.status) ? <><button type="button" onClick={() => setDeferOpen((open) => !open)}>Defer</button><button type="button" onClick={skipWorkout}>Skip</button></> : null}</div>
                  {modifyOpen ? <form className={styles.editPanel} onSubmit={saveModification}><label>Name<input name="name" defaultValue={workout.prescription.name} /></label><label>Minutes<input name="duration" type="number" min="5" max="180" defaultValue={workout.prescription.durationMinutes} /></label><label>Notes<textarea name="notes" defaultValue={workout.prescription.notes} /></label><button className={styles.primary}>Save reviewed edit</button></form> : null}
                  {deferOpen ? <form className={styles.editPanel} onSubmit={deferWorkout}><label>Move to<input name="date" type="date" min={shiftDate(workout.date, 1)} defaultValue={shiftDate(workout.date, 1)} /></label><p>Later sessions reflow; this occurrence keeps its identity and history.</p><button className={styles.primary}>Confirm defer</button></form> : null}
                  {selectedWorkoutTonalSession && !selectedWorkoutTonalSession.plannedSource ? <p className={styles.warning}>A Tonal completion remains blocked until the matching Before Photo is reviewed. No plan details will be fabricated.</p> : null}
                </div> : null}
              </article>)}</div> : <p className={styles.emptyState}>No scheduled workout for this date.</p>}
              {day.activities.length ? <div className={styles.dayEntries}>{day.activities.map((activity) => <ActivityRow key={activity.id} activity={activity} maxDate={today} onCorrectDate={(date) => void correctActivityDate(activity.id, date)} onDeleteSource={activity.source?.storagePath ? () => void deleteSource("activity", activity.id) : undefined} />)}</div> : null}
              {(pastActivityOpen || tonalCompletionTargetOrder !== null) && activityDefaultDate === day.date && intakeProposal?.kind === "activity" ? <div className={styles.proposal} ref={tonalCompletionTargetOrder !== null ? completionReviewRef : undefined} tabIndex={-1} data-completion-review={tonalCompletionTargetOrder ?? undefined}><p className={styles.kicker}>{tonalCompletionTargetOrder !== null ? `Review Fit Over 40 · Session ${tonalCompletionTargetOrder}` : "Review completed activity"}</p>{tonalCompletionTargetOrder !== null ? <p className={styles.provenance}>Approve & Save enriches this exact session. It does not create a second completion or advance Session {tonalCompletionTargetOrder + 1}.</p> : null}<ActivityReview proposal={intakeProposal} defaultDate={activityDefaultDate} maxDate={activityMaxDate} onAccept={acceptActivity} onReject={() => void rejectIntake()} acceptLabel="Approve & Save" /></div> : null}
              {tonalPlanBusy || intakeBusy && (tonalCompletionFeedback || completionWorkoutId) ? <p aria-live="polite">Sterling is reading visible workout evidence…</p> : null}
              {tonalPlanFeedback ? <p aria-live="polite" className={styles.warning}>{tonalPlanFeedback}</p> : null}{tonalCompletionFeedback ? <p aria-live="polite" className={styles.warning}>{tonalCompletionFeedback}</p> : null}
              {tonalPlanProposal && selectedWorkoutTonalSession && tonalPlanTargetOrder === selectedWorkoutTonalSession.order ? <TonalPlanReview sequencePosition={selectedWorkoutTonalSession.order} proposal={tonalPlanProposal} onAccept={acceptUpcomingTonalPlan} onReject={() => { setTonalPlanProposal(null); setTonalPlanFile(null); setTonalPlanTargetOrder(null); setTonalPlanFeedback("Proposal rejected; nothing was saved."); }} /> : null}
            </section>

            <section className={styles.daySection} aria-labelledby={`recovery-${day.date}`}>
              <div className={styles.daySectionHeading}><div><p className={styles.kicker}>Recovery</p><h2 id={`recovery-${day.date}`}>{day.recovery ? "Accepted context" : "No recovery entry"}</h2></div><button type="button" aria-expanded={recoveryEntryOpen && recoveryTargetDate === day.date} onClick={() => { setRecoveryTargetDate(day.date); setRecoveryEntryOpen(recoveryTargetDate === day.date ? !recoveryEntryOpen : true); setRecoveryProposal(null); setRecoveryFile(null); setRecoveryFeedback(""); }}>{recoveryEntryOpen && recoveryTargetDate === day.date ? "Close Recovery" : day.recovery ? "Edit Recovery" : "Add Recovery"}</button></div>
              {day.recovery ? <div className={styles.metricGrid}>{Object.entries(day.recovery).filter(([, value]) => value && typeof value === "object" && "source" in value).map(([key, value]) => { const metric = value as { value: string | number; source: string }; return <div key={key}><span>{key === "strain" ? "Daily strain" : key}</span><strong>{metric.value}</strong><small>{metric.source}{key === "strain" ? " · not activity-specific" : ""}</small></div>; })}</div> : <p className={styles.emptyState}>Unknown values remain unknown.</p>}
              {recoveryEntryOpen && recoveryTargetDate === day.date ? <div className={styles.entryPanel} data-recovery-entry-date={day.date}><p className={styles.provenance}>Recovery evidence will be saved to {prettyDate(day.date)} only after review.</p><div className={styles.photoActions}><label className={`${styles.photoAction} ${styles.primary}`}>Take Recovery Photo<input type="file" accept={PERFORMANCE_IMAGE_ACCEPT} capture="environment" onChange={chooseRecoveryScreenshot} disabled={recoveryBusy} /></label><label className={styles.photoAction}>Upload Recovery Screenshot<input type="file" accept={PERFORMANCE_IMAGE_ACCEPT} onChange={chooseRecoveryScreenshot} disabled={recoveryBusy} /></label></div>{recoveryBusy ? <p aria-live="polite">Sterling is reading visible daily recovery evidence…</p> : null}{recoveryFeedback ? <p aria-live="polite" className={styles.warning}>{recoveryFeedback}</p> : null}{recoveryProposal ? <div ref={recoveryReviewRef} tabIndex={-1}><RecoveryReview proposal={recoveryProposal} defaultDate={day.date} maxDate={today} onAccept={acceptRecovery} onReject={() => void rejectRecovery()} /></div> : <details><summary>Enter recovery manually</summary><RecoveryForm existing={day.recovery} onSubmit={(event) => void saveRecovery(event)} /></details>}</div> : recoveryFeedback && recoveryTargetDate === day.date ? <p aria-live="polite" className={styles.warning}>{recoveryFeedback}</p> : null}
              {day.recovery?.source?.storagePath ? <div className={styles.compactActions}><button type="button" onClick={() => void deleteSource("recovery", day.recovery!.id)}>Delete source image</button></div> : null}
            </section>
          </div> : null}
        </section>;
      })}
    </div>

    {state.program.status === "active" ? <section className={styles.card}><p className={styles.kicker}>Adaptive Coach · week-level adjustment</p><h2>What changed in real life?</h2><form className={styles.sterling} onSubmit={askSterling}><textarea value={sterlingText} onChange={(event) => setSterlingText(event.target.value)} placeholder="I’m golfing Thursday. Move Thursday’s planned workout to Friday." required /><button className={styles.primary} disabled={sterlingBusy}>{sterlingBusy ? "Reviewing…" : "Review adjustment"}</button></form>{sterlingError ? <p role="alert" className={styles.warning}>{sterlingError}</p> : null}{sterlingProposal ? <div className={styles.proposal}><strong>Proposed — nothing has changed yet</strong><p>{sterlingProposal.summary}</p>{sterlingProposal.warnings.map((warning) => <p key={warning} className={styles.warning}>{warning}</p>)}{sterlingProposal.displacedWorkouts?.length ? <div className={styles.warning}><strong>Other planned sessions that will move</strong>{sterlingProposal.displacedWorkouts.map((workout) => <p key={workout.workoutId}>{workout.name}: {prettyDate(workout.fromDate)} → {prettyDate(workout.toDate)}</p>)}</div> : null}<div className={styles.actions}><button className={styles.primary} onClick={() => void confirmSterling()} disabled={sterlingBusy}>Confirm changes</button><button onClick={() => setSterlingProposal(null)} disabled={sterlingBusy}>Reject</button></div></div> : null}</section> : null}
  </main>;

  return <main className={styles.app} data-personal-performance>
    <header className={styles.header}><div><p className={styles.eyebrow}>Personal / Performance</p><h1>Tell Sterling what happened. Keep the plan alive.</h1><p>Daily training, recovery, and nutrition with explicit decisions and durable context.</p></div><span className={styles.private}>Private · {state.program.status === "setup" ? "program not started" : `active since ${state.program.anchorDate}`} · {persistStatus === "saved" ? "saved" : persistStatus === "saving" ? "saving…" : persistStatus === "browser" ? "browser fallback" : persistStatus === "conflict" ? "refreshed after conflict" : persistStatus}</span></header>
    {activityFeedback ? <p aria-live="polite" className={styles.warning}>{activityFeedback}</p> : null}
    <nav className={styles.tabs} aria-label="Performance sections">{tabs.map((tab) => <Link key={tab.id} href={tab.href} aria-current={view === tab.id ? "page" : undefined}>{tab.label}</Link>)}</nav>

    {state.program.status === "setup" ? <section className={`${styles.card} ${styles.hero}`} data-program-status="setup">
      <p className={styles.kicker}>Training program · not started / setup</p>
      <h2>Fit Over 40 first. Three weekly slots, with each workout revealed just in time.</h2>
      <p>{TONAL_PROGRAM_CATALOG["fit-over-40"].trainer} · 4 weeks · founder-confirmed 3 strength workouts per week · 12 prescribed sessions · 35–55 minutes. Tonal remains the source of truth for the workout order and details.</p>
      <p>No workout is missed, no progression advances, and no catch-up session is created while setup is active. Next Level Strength and 12 Weeks to Jacked remain future, founder-approved blocks.</p>
      <div className={styles.inlineEditor}>
        <strong>Confirm enrollment</strong>
        <p>Confirm the cadence shown by the Tonal app or machine. Future workout titles are not required and will not be invented.</p>
        <p><strong>Founder-confirmed cadence:</strong> 3 Tonal workouts per week · 4 weeks · 12 prescribed sessions.</p>
        <div className={styles.actions}><button className={styles.primary} onClick={() => void configureTonalSequence()} disabled={tonalConfigBusy}>{tonalConfigBusy ? "Saving…" : "Confirm Fit Over 40 enrollment"}</button></div>
        {tonalConfigFeedback ? <p aria-live="polite" className={styles.warning}>{tonalConfigFeedback}</p> : null}
        {tonalEnrollmentReady(state.tonal) ? <p className={styles.provenance}>Enrollment saved · {state.tonal.enrollment.weeklyFrequency} weekly sessions · titles arrive from screenshots just in time · activation remains separate.</p> : <p className={styles.provenance}>Activation is blocked until program identity and cadence are founder-confirmed.</p>}
      </div>
      <div className={styles.formGrid}><label>Week 1 start (Monday)<input type="date" min={today} value={programStartDate} onChange={(event) => { setProgramStartDate(event.target.value); setActivationReview(false); setActivationError(""); }} /></label></div>
      <div className={styles.actions}><button className={styles.primary} onClick={reviewActivation} disabled={activationBusy}>Review Week 1</button></div>
      {activationError ? <p role="alert" className={styles.warning}>{activationError}</p> : null}
      {activationReview ? <div className={styles.proposal}><strong>Proposed — the program is still not started</strong><p>Week 1 begins {prettyDate(programStartDate)} with {state.tonal.enrollment.weeklyFrequency} Tonal slots, two run/walk sessions, protected recovery, and Sunday hard rest. Each Tonal slot needs its own approved upcoming-workout screenshot before use. Existing accepted history stays unchanged.</p><div className={styles.proposalGrid}>{activationPreview.map((workout) => <div key={workout.id}><span>{prettyDate(workout.date)}</span><strong>{workout.prescription.name}</strong><small>{workout.prescription.durationMinutes} min · {workout.prescription.intent}</small></div>)}</div><div className={styles.actions}><button className={styles.primary} onClick={() => void confirmActivation()} disabled={activationBusy || !tonalEnrollmentReady(state.tonal)}>{activationBusy ? "Activating…" : "Confirm and activate"}</button><button onClick={() => setActivationReview(false)} disabled={activationBusy}>Cancel</button></div></div> : null}
    </section> : null}

    {view === "today" ? <div className={styles.stack}>
      {state.program.status === "active" ? <section className={styles.card} data-unified-workout-cards>
        <p className={styles.kicker}>Today · upcoming · history</p>
        <h2>Training schedule</h2>
        <p>Select one activity. Its plan, outcome, and evidence stay attached to that exact scheduled occurrence.</p>
        <div className={styles.workoutCards} role="list" aria-label="Scheduled activities">
          {selectableWorkouts.map((workout) => <button type="button" role="listitem" className={selectedWorkout?.id === workout.id ? styles.workoutCardSelected : styles.workoutCard} key={workout.id} onClick={() => { const tonal = state.tonal.enrollment.sessions.find((session) => session.scheduledWorkoutId === workout.id); setSelectedWorkoutId(workout.id); setSelectedTonalSessionOrder(tonal?.order ?? null); setTonalCompletionTargetOrder(null); setCompletionWorkoutId(null); setModifyOpen(false); setTonalCompletionFeedback(""); setTonalPlanFeedback(""); }}>
            <span>{workout.date === today ? "Today" : prettyDate(workout.date)}</span><strong>{workout.prescription.name}</strong><small>{workout.status === "completed" ? "Completed" : workout.status === "deferred" ? "Deferred" : workout.status === "skipped" ? "Skipped" : workout.status === "in_progress" ? "In progress" : "Pending"}</small>
          </button>)}
        </div>
        {selectedWorkout ? <div className={styles.workoutDetail}>
          <div className={styles.cardTop}><div><p className={styles.kicker}>{prettyDate(selectedWorkout.date)} · {selectedWorkout.status.replace("_", " ")}</p><h3>{selectedWorkout.prescription.name}</h3></div><span>{selectedWorkout.prescription.durationMinutes} min</span></div>
          <p>{selectedWorkout.prescription.notes}</p>
          {selectedWorkoutTonalSession ? <p className={styles.provenance}>Fit Over 40 · Session {selectedWorkoutTonalSession.order} · {selectedWorkoutTonalSession.plannedSource ? "approved before evidence" : "before evidence not attached"} · {selectedWorkoutTonalSession.completedActivityId ? "approved after evidence" : "after evidence not attached"}</p> : <p className={styles.provenance}>{selectedWorkout.prescription.mode} · {state.activities.some((activity) => activity.scheduledWorkoutId === selectedWorkout.id) ? "approved completion evidence attached" : "completion evidence not attached"}</p>}
          {selectedWorkoutTonalSession?.movements.length ? <div className={styles.proposalGrid}>{selectedWorkoutTonalSession.movements.map((movement) => <div key={movement.name}><strong>{movement.name}</strong><small>{[movement.sets ? `${movement.sets} sets` : "", movement.reps ?? "", movement.prescribedResistance ?? ""].filter(Boolean).join(" · ") || "Details unknown"}</small></div>)}</div> : null}
          <div className={styles.workoutControls}>
            {selectedWorkoutTonalSession ? <label className={styles.photoAction}>Add Before Photo<input type="file" accept={PERFORMANCE_IMAGE_ACCEPT} onChange={selectedWorkoutTonalSession.order === upcomingTonalSession?.order ? chooseUpcomingTonalScreenshot : chooseHistoricalTonalPlanScreenshot} disabled={tonalPlanBusy || Boolean(selectedWorkoutTonalSession.completedActivityId)} /></label> : <button type="button" disabled title="Before photos are optional and not needed for this activity type">Add Before Photo · optional</button>}
            {selectedWorkoutTonalSession ? <label className={`${styles.photoAction} ${styles.primary}`}>Add After Photo<input type="file" accept={PERFORMANCE_IMAGE_ACCEPT} onChange={chooseTonalCompletionScreenshot} disabled={intakeBusy || selectedWorkout.date > today} /></label> : <label className={`${styles.photoAction} ${styles.primary}`}>Add After Photo<input type="file" accept={PERFORMANCE_IMAGE_ACCEPT} onChange={chooseSelectedWorkoutCompletion} disabled={intakeBusy || selectedWorkout.date > today || ["deferred", "skipped", "replaced"].includes(selectedWorkout.status)} /></label>}
            <button type="button" onClick={() => setModifyOpen((open) => !open)} disabled={["completed", "deferred", "skipped", "replaced"].includes(selectedWorkout.status)}>Edit Workout</button>
            <button type="button" onClick={() => selectedWorkout.status === "planned" || selectedWorkout.status === "unresolved" ? startWorkout(selectedWorkout) : setActivityFeedback(`Reviewing ${selectedWorkout.prescription.name}: ${selectedWorkout.status.replace("_", " ")}.`)}>Review / Complete Workout</button>
          </div>
          {modifyOpen ? <form className={styles.editPanel} onSubmit={saveModification}><label>Name<input name="name" defaultValue={selectedWorkout.prescription.name} /></label><label>Minutes<input name="duration" type="number" min="5" max="180" defaultValue={selectedWorkout.prescription.durationMinutes} /></label><label>Notes<textarea name="notes" defaultValue={selectedWorkout.prescription.notes} /></label><button className={styles.primary}>Save reviewed edit</button></form> : null}
          {selectedWorkoutTonalSession && !selectedWorkoutTonalSession.plannedSource ? <p className={styles.warning}>A Tonal completion remains blocked until the matching Before Photo is reviewed. No plan details will be fabricated.</p> : null}
          {selectedWorkoutTonalSession && ["deferred", "skipped"].includes(tonalSessionStatus(state, selectedWorkoutTonalSession)) ? <p className={styles.warning}>This outcome remains {tonalSessionOutcome(state, selectedWorkoutTonalSession)} until its existing reviewed correction path is approved.</p> : null}
        </div> : null}
        {tonalPlanBusy ? <p aria-live="polite">Sterling is reading the visible planned workout…</p> : null}
        {intakeBusy && (tonalCompletionFeedback || completionWorkoutId) ? <p aria-live="polite">Sterling is reading visible completion facts…</p> : null}
        {tonalPlanFeedback ? <p aria-live="polite" className={styles.warning}>{tonalPlanFeedback}</p> : null}
        {tonalCompletionFeedback ? <p aria-live="polite" className={styles.warning}>{tonalCompletionFeedback}</p> : null}
        {tonalPlanProposal && selectedWorkoutTonalSession && tonalPlanTargetOrder === selectedWorkoutTonalSession.order ? <TonalPlanReview sequencePosition={selectedWorkoutTonalSession.order} proposal={tonalPlanProposal} onAccept={acceptUpcomingTonalPlan} onReject={() => { setTonalPlanProposal(null); setTonalPlanFile(null); setTonalPlanTargetOrder(null); setTonalPlanFeedback("Proposal rejected; nothing was saved."); }} /> : null}
      </section> : null}
      <section className={`${styles.card} ${styles.hero}`}>
        <div className={styles.cardTop}><div><p className={styles.kicker}>{prettyDate(today)} · {state.program.status === "setup" ? "setup" : todayWorkout?.status.replace("_", " ") ?? "no planned session"}</p><h2>{state.program.status === "setup" ? "No training session is active yet" : todayWorkout ? `${todayWorkout.prescription.name} · ${todayWorkout.status === "completed" ? "Completed" : todayWorkout.status === "deferred" ? "Deferred" : todayWorkout.status === "skipped" ? "Skipped" : "Pending"}` : "No planned session today"}</h2></div>{todayWorkout && state.program.status === "active" ? <span>{todayWorkout.prescription.durationMinutes} min</span> : null}</div>
        {activeToday && state.program.status === "active" ? <><p>{activeToday.prescription.notes}</p><p className={styles.provenance}>Planned by {activeToday.prescription.trainingBlock} · {activeToday.provenance.join(" · ")}</p>
          {activeSession ? <WorkoutLogger workout={activeToday} session={activeSession} onSet={updateSet} onComplete={completeWorkout} /> : <div className={styles.actions}><button className={styles.primary} onClick={() => startWorkout(activeToday)}>Start</button><button onClick={() => setDeferOpen((open) => !open)}>Defer</button><button onClick={skipWorkout}>Skip</button>{activeToday.prescription.alternative ? <button onClick={() => swapWorkout(activeToday.id)}>Swap equivalent</button> : null}</div>}
          {deferOpen ? <form className={styles.editPanel} onSubmit={deferWorkout}><label>Move to<input name="date" type="date" min={shiftDate(today, 1)} defaultValue={shiftDate(today, 1)} /></label><p>Later sessions will reflow; this workout keeps its prescription and history.</p><button className={styles.primary}>Confirm defer</button></form> : null}
        </> : <p>{state.program.status === "setup" ? "Use Performance for nutrition and completed activity testing. Training begins only after explicit activation above." : "Completed, deferred, or consciously skipped sessions remain in the week history."}</p>}
      </section>
      {state.program.status === "active" ? <section className={styles.card}><p className={styles.kicker}>Ask Sterling · adaptive coach</p><h2>What changed in real life?</h2><form className={styles.sterling} onSubmit={askSterling}><textarea value={sterlingText} onChange={(event) => setSterlingText(event.target.value)} placeholder="I’m golfing Thursday. Move Thursday’s planned workout to Friday." required /><button className={styles.primary} disabled={sterlingBusy}>{sterlingBusy ? "Reviewing…" : "Review adjustment"}</button></form>
        {sterlingError ? <p role="alert" className={styles.warning}>{sterlingError}</p> : null}
        {sterlingProposal ? <div className={styles.proposal}><strong>Proposed — nothing has changed yet</strong><p>{sterlingProposal.summary}</p>{sterlingProposal.warnings.map((warning) => <p key={warning} className={styles.warning}>{warning}</p>)}{sterlingProposal.sourceWorkoutId && sterlingProposal.targetDate ? <label>Move selected workout to<input type="date" min={shiftDate(state.schedule.find((item) => item.id === sterlingProposal.sourceWorkoutId)?.date ?? today, 1)} value={sterlingProposal.targetDate} onChange={(event) => changeSterlingTarget(event.target.value)} disabled={sterlingBusy} /></label> : null}{sterlingProposal.displacedWorkouts?.length ? <div className={styles.warning}><strong>Other planned sessions that will move</strong>{sterlingProposal.displacedWorkouts.map((workout) => <p key={workout.workoutId}>{workout.name}: {prettyDate(workout.fromDate)} → {prettyDate(workout.toDate)}</p>)}</div> : null}<div className={styles.proposalGrid}>{sterlingProposal.nextSchedule.filter((item) => item.date >= today && item.status !== "deferred").slice(0, 5).map((item) => <div key={`${item.id}-${item.date}`}><span>{prettyDate(item.date)}</span><strong>{item.prescription.name}</strong><small>{item.prescription.intent} · {item.prescription.durationMinutes} min</small></div>)}</div><div className={styles.actions}><button className={styles.primary} onClick={() => void confirmSterling()} disabled={sterlingBusy}>{sterlingBusy ? "Saving…" : "Confirm changes"}</button><button onClick={() => { setSterlingProposal(null); setSterlingError(""); }} disabled={sterlingBusy}>Reject</button></div></div> : null}
      </section> : null}
      <section className={styles.card}><div className={styles.cardTop}><div><p className={styles.kicker}>Retrospective activity</p><h2>Log Past Activity</h2></div><button onClick={() => setPastActivityOpen((open) => !open)}>{pastActivityOpen ? "Close" : "Log Past Activity"}</button></div><p>Upload a WHOOP, Tonal, Peloton, golf, run, or ruck screenshot. This records completed history; it does not reschedule a planned workout.</p>{pastActivityOpen ? <div className={styles.editPanel}><label>Activity date<input type="date" max={shiftDate(today, -1)} value={pastActivityDate} onChange={(event) => setPastActivityDate(event.target.value)} /></label><label className={`${styles.photoAction} ${styles.primary}`}>UPLOAD ACTIVITY SCREENSHOT<input type="file" accept={PERFORMANCE_IMAGE_ACCEPT} onChange={chooseActivityScreenshot} disabled={intakeBusy || !pastActivityDate} /></label>{intakeBusy ? <p aria-live="polite">Sterling is reading only the visible activity facts…</p> : null}{mealError ? <p role="alert" className={styles.warning}>{mealError}</p> : null}</div> : null}</section>
      {view === "today" && intakeProposal?.kind === "activity" ? <section className={styles.card}><p className={styles.kicker}>Review required</p><h2>Edit visible metrics before saving.</h2><ActivityReview proposal={intakeProposal} defaultDate={activityDefaultDate} maxDate={activityMaxDate} onAccept={acceptActivity} onReject={() => void rejectIntake()} /></section> : null}
      {latestRecovery ? <section className={styles.card}><p className={styles.kicker}>Today’s recovery context</p><h2>{latestRecovery.sleepHours ? `${latestRecovery.sleepHours.value}h sleep` : "Recovery logged"}{latestRecovery.fatigue ? ` · ${latestRecovery.fatigue.value} fatigue` : ""}</h2><p>Only supplied values are recorded. Missing WHOOP metrics remain blank.</p></section> : null}
      {state.progressionProposals.some((proposal) => proposal.status === "pending" || proposal.status === "edited") ? <section className={styles.card}><p className={styles.kicker}>Next-session proposals</p><h2>Review before progression changes.</h2>{state.progressionProposals.filter((proposal) => proposal.status === "pending" || proposal.status === "edited").map((proposal) => <div className={styles.savedRow} key={proposal.id}><strong>{proposal.action.toUpperCase()}{proposal.proposedLoad !== undefined ? ` · ${proposal.proposedLoad} lb` : ""}</strong><span>{proposal.reason}</span><div className={styles.actions}><button className={styles.primary} onClick={() => resolveProgression(proposal.id, "accepted")}>Accept</button><button onClick={() => resolveProgression(proposal.id, "edited")}>Edit</button><button onClick={() => resolveProgression(proposal.id, "rejected")}>Reject</button></div></div>)}</section> : null}
      {todayActivities.length ? <section className={styles.card}><p className={styles.kicker}>Accepted activity today</p>{todayActivities.map((activity) => <ActivityRow key={activity.id} activity={activity} maxDate={shiftDate(today, -1)} onCorrectDate={(date) => void correctActivityDate(activity.id, date)} onDeleteSource={activity.source?.storagePath ? () => void deleteSource("activity", activity.id) : undefined} />)}</section> : null}
      <section className={styles.card}><div className={styles.cardTop}><div><p className={styles.kicker}>Nutrition today</p><h2>{nutrition.calories} / {state.nutritionTargets.calories} kcal · {nutrition.protein} / {state.nutritionTargets.protein}g protein</h2></div><Link href="/executive-dashboard/concierge/personal/food">Log meal</Link></div></section>
    </div> : null}

    {view === "nutrition" ? <div className={styles.stack}>
      <section className={styles.card}><p className={styles.kicker}>Today’s targets</p><h2>{nutrition.calories} / {state.nutritionTargets.calories} kcal · {nutrition.protein} / {state.nutritionTargets.protein}g protein</h2><p>{nutrition.carbs} / {state.nutritionTargets.carbs}g carbs · {nutrition.fat} / {state.nutritionTargets.fat}g fat</p></section>
      <section className={`${styles.card} ${styles.quickLog}`}><p className={styles.kicker}>Natural intake</p><h2>Describe it, photograph it, or show Sterling the label.</h2><form className={styles.sterling} onSubmit={submitMealDescription}><textarea value={intakeText} onChange={(event) => setIntakeText(event.target.value)} placeholder="8 oz Dawg Food chicken blend, 1 tablespoon butter, 2 baby bok choy, and 1/2 cup Kevin's cauliflower puree." /><button className={styles.primary} disabled={intakeBusy || !intakeText.trim()}>Interpret meal</button></form><div className={styles.photoActions}><label className={`${styles.photoAction} ${styles.primary}`}>TAKE MEAL PHOTO<input type="file" accept={PERFORMANCE_IMAGE_ACCEPT} capture="environment" onChange={chooseMealPhoto} disabled={intakeBusy} /></label><label className={styles.photoAction}>UPLOAD MEAL PHOTO<input type="file" accept={PERFORMANCE_IMAGE_ACCEPT} onChange={chooseMealPhoto} disabled={intakeBusy} /></label><label className={styles.photoAction}>NUTRITION LABEL<input type="file" accept={PERFORMANCE_IMAGE_ACCEPT} onChange={chooseNutritionLabel} disabled={intakeBusy} /></label></div>{mealBusy ? <p aria-live="polite">Sterling is interpreting the input…</p> : null}{mealError ? <p role="alert" className={styles.warning}>{mealError}</p> : null}</section>
      <section className={styles.card}><div className={styles.cardTop}><div><p className={styles.kicker}>Frequently Eaten</p><h2>{frequentlyEaten.length ? "Your regulars, ready in one tap." : "Regular meals will appear here."}</h2></div></div><p>Meals repeat automatically after two accepted logs. You can also pin any saved meal.</p>{frequentlyEaten.length ? <div className={styles.frequentGrid}>{frequentlyEaten.map((frequent) => <div className={styles.frequentCard} key={frequent.id}><button className={styles.frequentLog} onClick={() => oneTapLog(frequent)} aria-label={`Log ${frequent.name}`}><strong>{frequent.name}</strong><span>{frequent.items.map((item) => item.portion).filter(Boolean).join(" · ") || "Saved serving"}</span><small>{frequent.calories} kcal · {frequent.protein}P · {frequent.carbs}C · {frequent.fat}F{frequent.mealType ? ` · ${frequent.mealType}` : ""}</small></button><div className={styles.compactActions}><button onClick={() => storeFrequent(frequent, { pinned: !frequent.pinned })}>{frequent.pinned ? "Unpin" : "Pin"}</button><button onClick={() => setEditingFrequentId((id) => id === frequent.id ? null : frequent.id)}>Edit default</button><button onClick={() => storeFrequent(frequent, { hidden: true })}>Hide</button></div>{editingFrequentId === frequent.id ? <FrequentDefaultEditor frequent={frequent} onChange={(itemId, patch) => updateFrequentDefault(frequent, itemId, patch)} onDone={() => setEditingFrequentId(null)} /> : null}</div>)}</div> : null}</section>
      {lastAddedMealId && state.meals.some((meal) => meal.id === lastAddedMealId) ? <section className={`${styles.card} ${styles.undoBar}`} aria-live="polite"><div><p className={styles.kicker}>Logged</p><strong>{state.meals.find((meal) => meal.id === lastAddedMealId)?.items.map((item) => item.name).join(", ")}</strong></div><div className={styles.actions}><button onClick={() => setEditingMealId((id) => id === lastAddedMealId ? null : lastAddedMealId)}>Edit</button><button onClick={undoLastMeal}>Undo</button></div>{editingMealId === lastAddedMealId ? <MealOccurrenceEditor meal={state.meals.find((meal) => meal.id === lastAddedMealId)!} onSave={(items) => void saveMealCorrection(lastAddedMealId, items)} onDone={() => setEditingMealId(null)} /> : null}</section> : null}
      {mealEstimate ? <section className={styles.card}><p className={styles.kicker}>Review required</p><h2>Human input → Sterling proposal → your approval</h2><p>Nothing is saved until you accept the editable values below. The untouched Sterling estimate, assumptions, and your corrections are retained separately for provenance.</p>{intakeProposal?.assumptions.map((assumption) => <p key={assumption} className={styles.provenance}>Assumption · {assumption}</p>)}<MealReview estimate={mealEstimate} onChange={updateMealItem} onRemove={(id) => setMealEstimate((estimate) => estimate ? { ...estimate, items: estimate.items.filter((item) => item.id !== id) } : null)} onAdd={() => setMealEstimate((estimate) => estimate ? { ...estimate, items: [...estimate.items, { id: uid("meal-item"), name: "", portion: "", calories: 0, protein: 0, carbs: 0, fat: 0, confidence: "low" }] } : null)} onAccept={acceptMeal} onReject={() => void rejectIntake()} /></section> : null}
      <section className={styles.card}><p className={styles.kicker}>Manual meal</p><h2>Log without a photo.</h2><form className={styles.recoveryForm} onSubmit={saveManualMeal}><div className={styles.formGrid}><label>Food<input name="name" placeholder="Chicken, rice, greens" required /></label><label>Portion<input name="portion" placeholder="6 oz / 1 cup" /></label><label>Meal type<select name="mealType"><option value="">Not supplied</option><option>breakfast</option><option>lunch</option><option>dinner</option><option>snack</option></select></label></div><div className={styles.formGrid}><label>Calories<input name="calories" type="number" min="0" required /></label><label>Protein<input name="protein" type="number" min="0" required /></label><label>Carbs<input name="carbs" type="number" min="0" required /></label><label>Fat<input name="fat" type="number" min="0" required /></label></div><button className={styles.primary}>Save manual meal</button></form></section>
      <section className={styles.card}><p className={styles.kicker}>Saved meals · canonical</p>{state.meals.length ? state.meals.slice(0, 10).map((meal) => <div className={styles.savedRow} key={meal.id}><span>{meal.items.map((item) => item.name).join(", ")}</span><strong>{meal.calories} kcal · {meal.protein}P · {meal.carbs}C · {meal.fat}F</strong><small>{meal.aiEstimate ? "AI estimate retained · user-approved values canonical" : meal.frequentMealId ? "one-tap relog" : "manual"}</small><div className={styles.compactActions}><button onClick={() => saveAsFrequent(meal)}>{state.frequentMeals.some((item) => item.signature === mealSignature(meal)) ? "Update frequent" : "Save as frequent"}</button>{meal.photo?.storagePath ? <button onClick={() => void deleteSource("meal", meal.id)}>Delete source image</button> : null}</div></div>) : <p>No meals saved yet.</p>}</section>
    </div> : null}

    {view === "recovery" ? <div className={styles.stack}><section className={styles.card}><p className={styles.kicker}>Morning check-in</p><h2>Log only what you know.</h2><p>Every field is optional. Measured/manual numbers stay distinct from subjective ratings; absent WHOOP metrics remain absent.</p><RecoveryForm existing={latestRecovery} onSubmit={saveRecovery} /></section>{latestRecovery ? <section className={styles.card}><p className={styles.kicker}>Saved today</p><div className={styles.metricGrid}>{Object.entries(latestRecovery).filter(([, value]) => value && typeof value === "object" && "source" in value).map(([key, value]) => { const metric = value as { value: string | number; source: string }; return <div key={key}><span>{key}</span><strong>{metric.value}</strong><small>{metric.source}</small></div>; })}</div></section> : null}</div> : null}

    {view === "week" ? <div className={styles.stack}><section className={styles.card}><p className={styles.kicker}>Completed activity intake</p><h2>Log Past Activity</h2><p>This adds completed history without changing planned workouts.</p><div className={styles.formGrid}><label>Activity date<input type="date" max={shiftDate(today, -1)} value={pastActivityDate} onChange={(event) => setPastActivityDate(event.target.value)} /></label><label className={`${styles.photoAction} ${styles.primary}`}>UPLOAD ACTIVITY SCREENSHOT<input type="file" accept={PERFORMANCE_IMAGE_ACCEPT} onChange={chooseActivityScreenshot} disabled={intakeBusy || !pastActivityDate} /></label></div>{intakeBusy ? <p aria-live="polite">Sterling is reading the visible workout facts…</p> : null}{mealError ? <p role="alert" className={styles.warning}>{mealError}</p> : null}</section>{intakeProposal?.kind === "activity" ? <section className={styles.card}><p className={styles.kicker}>Review required</p><h2>Observed facts stay distinct from estimates.</h2><ActivityReview proposal={intakeProposal} defaultDate={activityDefaultDate} maxDate={shiftDate(today, -1)} onAccept={acceptActivity} onReject={() => void rejectIntake()} /></section> : null}<section className={styles.week}>{week.map((workout) => <article className={styles.card} key={`${workout.id}-${workout.date}-${workout.status}`}><div className={styles.cardTop}><div><p className={styles.kicker}>{prettyDate(workout.date)} · {workout.status.replace("_", " ")}</p><h3>{workout.prescription.name}</h3></div><span>{workout.prescription.domain}</span></div><p>{workout.prescription.notes}</p><small>{workout.history.at(-1)?.note}</small><div className={styles.actions}><Link href="/executive-dashboard/concierge/personal">Open workout detail</Link>{workout.prescription.alternative && workout.status === "planned" ? <button onClick={() => swapWorkout(workout.id)}>Swap equivalent</button> : null}</div></article>)}</section><section className={styles.card}><p className={styles.kicker}>Accepted activity history</p>{state.activities.length ? state.activities.slice(0, 12).map((activity) => <ActivityRow key={activity.id} activity={activity} maxDate={shiftDate(today, -1)} onCorrectDate={(date) => void correctActivityDate(activity.id, date)} />) : <p>No accepted activities yet.</p>}</section></div> : null}

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
  return <div className={styles.mealReview}><div className={styles.reviewTop}><strong>AI estimate · review every value</strong><span>{estimate.confidence} confidence</span></div>{estimate.clarification ? <p className={styles.warning}>{estimate.clarification}</p> : null}<p>{estimate.caveat}</p>{estimate.items.map((item) => <div className={styles.mealItem} key={item.id}><label>Food<input value={item.name} onChange={(event) => onChange(item.id, { name: event.target.value })} /></label><label>Portion<input value={item.portion} onChange={(event) => onChange(item.id, { portion: event.target.value })} /></label>{(["calories", "protein", "carbs", "fat"] as const).map((key) => <label key={key}>{key}<input type="number" min="0" value={item[key]} onChange={(event) => onChange(item.id, { [key]: Number(event.target.value) })} /></label>)}<button onClick={() => onRemove(item.id)}>Remove</button></div>)}<button onClick={onAdd}>Add missing food</button><div className={styles.estimateTotal}><span>Reviewed total</span><strong>{sum.calories} kcal · {sum.protein}g protein · {sum.carbs}g carbs · {sum.fat}g fat</strong></div><label>Meal type · optional<select value={mealType ?? ""} onChange={(event) => setMealType((event.target.value || undefined) as MealLog["mealType"])}><option value="">Not supplied</option><option>breakfast</option><option>lunch</option><option>dinner</option><option>snack</option></select></label><div className={styles.actions}><button className={styles.primary} disabled={!estimate.items.length || estimate.items.some((item) => !item.name.trim())} onClick={() => onAccept(mealType)}>Approve & Save Meal</button><button onClick={onReject}>Reject</button></div></div>;
}

function MacroItemEditor({ item, onChange }: { item: MealItem; onChange: (patch: Partial<MealItem>) => void }) {
  return <div className={styles.mealItem}><label>Food<input value={item.name} onChange={(event) => onChange({ name: event.target.value })} /></label><label>Portion<input value={item.portion} onChange={(event) => onChange({ portion: event.target.value })} /></label>{(["calories", "protein", "carbs", "fat"] as const).map((key) => <label key={key}>{key}<input type="number" min="0" value={item[key]} onChange={(event) => onChange({ [key]: Math.max(0, Number(event.target.value) || 0) })} /></label>)}</div>;
}

function FrequentDefaultEditor({ frequent, onChange, onDone }: { frequent: FrequentMealCandidate; onChange: (itemId: string, patch: Partial<MealItem>) => void; onDone: () => void }) {
  return <div className={styles.inlineEditor}><strong>Edit saved default</strong><p>Future one-tap logs use these values. Existing meal occurrences stay unchanged.</p>{frequent.items.map((item) => <MacroItemEditor key={item.id} item={item} onChange={(patch) => onChange(item.id, patch)} />)}<button className={styles.primary} onClick={onDone}>Done</button></div>;
}

function MealOccurrenceEditor({ meal, onSave, onDone }: { meal: MealLog; onSave: (items: MealItem[]) => void; onDone: () => void }) {
  const [items, setItems] = useState(() => meal.items.map((item) => ({ ...item })));
  return <div className={styles.inlineEditor}><strong>Edit this occurrence</strong><p>Nothing changes until you save. The prior accepted values remain in the audit history, and your frequent default will not change.</p>{items.map((item) => <MacroItemEditor key={item.id} item={item} onChange={(patch) => setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, ...patch } : candidate))} />)}<div className={styles.actions}><button className={styles.primary} onClick={() => onSave(items)}>Save audited correction</button><button onClick={onDone}>Cancel</button></div></div>;
}

function TonalPlanReview({ sequencePosition, proposal, onAccept, onReject }: { sequencePosition: number; proposal: Extract<NaturalIngestionProposal, { kind: "activity" }>; onAccept: (input: { title?: string; movements: TonalProgramMovement[] }) => void | Promise<void>; onReject: () => void }) {
  const [title, setTitle] = useState(proposal.activity.workoutTitle ?? "");
  const [movements, setMovements] = useState<TonalProgramMovement[]>(proposal.activity.tonalMovements ?? []);
  const update = (index: number, patch: Partial<TonalProgramMovement>) => setMovements((current) => current.map((movement, candidate) => candidate === index ? { ...movement, ...patch } : movement));
  return <div className={styles.mealReview}><div className={styles.reviewTop}><strong>Review Tonal sequence {sequencePosition}</strong><span>{proposal.confidence} confidence</span></div>{proposal.assumptions.map((assumption) => <p key={assumption} className={styles.provenance}>Assumption · {assumption}</p>)}<label>Workout title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Unknown unless visible" /></label>{movements.map((movement, index) => <div className={styles.inlineEditor} key={`${movement.name}-${index}`}><div className={styles.formGrid}><label>Movement<input value={movement.name} onChange={(event) => update(index, { name: event.target.value })} /></label><label>Sets<input type="number" min="1" value={movement.sets ?? ""} onChange={(event) => update(index, { sets: event.target.value ? Math.max(1, Number(event.target.value)) : undefined })} /></label><label>Reps<input value={movement.reps ?? ""} onChange={(event) => update(index, { reps: event.target.value || undefined })} placeholder="Unknown" /></label><label>Prescribed resistance<input value={movement.prescribedResistance ?? ""} onChange={(event) => update(index, { prescribedResistance: event.target.value || undefined })} placeholder="Unknown" /></label></div><label>Displayed details<input value={movement.details ?? ""} onChange={(event) => update(index, { details: event.target.value || undefined })} /></label><button onClick={() => setMovements((current) => current.filter((_, candidate) => candidate !== index))}>Remove movement</button></div>)}<div className={styles.actions}><button onClick={() => setMovements((current) => [...current, { name: "" }])}>Add visible movement</button><button className={styles.primary} disabled={!title.trim() && !movements.some((movement) => movement.name.trim())} onClick={() => void onAccept({ title: title.trim() || undefined, movements: movements.filter((movement) => movement.name.trim()) })}>Approve planned session</button><button onClick={onReject}>Reject</button></div><p className={styles.provenance}>Approval plans only this explicit sequence position. Missing fields remain unknown; this does not complete the workout or advance the program.</p></div>;
}

function RecoveryReview({ proposal, defaultDate, maxDate, onAccept, onReject }: { proposal: Extract<NaturalIngestionProposal, { kind: "recovery" }>; defaultDate: string; maxDate: string; onAccept: (facts: RecoveryProposalFacts, date: string, dateConflictConfirmed: boolean) => void | Promise<void>; onReject: () => void }) {
  const [facts, setFacts] = useState<RecoveryProposalFacts>(() => structuredClone(proposal.recovery));
  const [date, setDate] = useState(defaultDate);
  const [dateConflictConfirmed, setDateConflictConfirmed] = useState(false);
  const dateConflict = compareActivityDate(proposal.sourceDate, date) === "conflict";
  const fields: Array<{ key: keyof RecoveryProposalFacts; label: string; max: number; step: number }> = [
    { key: "recoveryScore", label: "Recovery · %", max: 100, step: 1 }, { key: "hrvMs", label: "HRV · ms", max: 1_000, step: 1 },
    { key: "restingHeartRate", label: "Resting heart rate", max: 250, step: 1 }, { key: "sleepHours", label: "Sleep · hours", max: 24, step: .01 },
    { key: "sleepPerformance", label: "Sleep performance · %", max: 100, step: 1 }, { key: "strain", label: "Daily strain · not workout-specific", max: 21, step: .1 },
  ];
  const setMetric = (key: keyof RecoveryProposalFacts, value: string) => setFacts((current) => ({ ...current, [key]: value === "" ? undefined : { value: Math.max(0, Number(value) || 0), source: "manual" } }));
  const hasMetric = Object.values(facts).some(Boolean);
  return <div className={styles.mealReview} data-recovery-review><div className={styles.reviewTop}><strong>{proposal.summary}</strong><span>{proposal.confidence} confidence</span></div><p className={styles.provenance}>Private screenshot · SHA-256 {proposal.sourceDigest?.slice(0, 12)}… · unknown values remain blank</p>{proposal.assumptions.map((assumption) => <p key={assumption} className={styles.provenance}>Assumption · {assumption}</p>)}<label>Recovery date<input type="date" max={maxDate} value={date} onChange={(event) => { setDate(event.target.value); setDateConflictConfirmed(false); }} /></label>{proposal.sourceDate ? <p className={styles.provenance}>Visible screenshot date · {visibleActivityDateLabel(proposal.sourceDate)}</p> : <p className={styles.provenance}>No reliable date was visible; confirm the selected day.</p>}{dateConflict ? <div role="alert" className={styles.warning}><p>The selected date conflicts with the visible screenshot date. Nothing can be saved until you explicitly confirm the selected date.</p><label><input type="checkbox" checked={dateConflictConfirmed} onChange={(event) => setDateConflictConfirmed(event.target.checked)} /> Save under {prettyDate(date)} despite the visible source date</label></div> : null}<div className={styles.formGrid}>{fields.map((field) => <label key={field.key}>{field.label}<input type="number" min="0" max={field.max} step={field.step} value={facts[field.key]?.value ?? ""} onChange={(event) => setMetric(field.key, event.target.value)} /></label>)}</div><p>{proposal.guidance}</p><div className={styles.actions}><button className={styles.primary} disabled={!hasMetric || !date || date > maxDate || (dateConflict && !dateConflictConfirmed)} onClick={() => void onAccept(facts, date, dateConflictConfirmed)}>Approve & Save Recovery</button><button onClick={onReject}>Reject</button></div></div>;
}

function ActivityReview({ proposal, defaultDate, maxDate, onAccept, onReject, acceptLabel = "Accept activity" }: { proposal: Extract<NaturalIngestionProposal, { kind: "activity" }>; defaultDate: string; maxDate: string; onAccept: (facts: ActivityFacts[], occurredOn: string, dateConflictConfirmed: boolean) => void | Promise<void>; onReject: () => void; acceptLabel?: string }) {
  const [activities, setActivities] = useState<ActivityFacts[]>(() => structuredClone(proposal.activities?.length ? proposal.activities : [proposal.activity]));
  const [occurredOn, setOccurredOn] = useState(defaultDate);
  const [dateConflictConfirmed, setDateConflictConfirmed] = useState(false);
  const dateConflict = compareActivityDate(proposal.sourceDate, occurredOn) === "conflict";
  const numericFields: Array<{ key: keyof Pick<ActivityFacts, "durationMinutes" | "distanceMiles" | "averageSpeedMph" | "averageHeartRate" | "maxHeartRate" | "elevationFeet" | "reportedCalories" | "whoopStrain" | "steps" | "ruckWeightLb" | "tonalSessionOrder" | "totalVolumeLb" | "maxResistanceLb" | "completedSets" | "completedReps">; label: string; step?: number }> = [
    { key: "durationMinutes", label: "Duration · min", step: .1 }, { key: "distanceMiles", label: "Distance · mi", step: .01 },
    { key: "averageSpeedMph", label: "Average speed · mph", step: .1 }, { key: "averageHeartRate", label: "Average HR", step: 1 },
    { key: "maxHeartRate", label: "Max HR", step: 1 }, { key: "elevationFeet", label: "Elevation · ft", step: 1 },
    { key: "reportedCalories", label: "Reported calories", step: 1 }, { key: "whoopStrain", label: "WHOOP strain", step: .1 },
    { key: "steps", label: "Steps", step: 1 }, { key: "ruckWeightLb", label: "Ruck / vest · lb", step: .1 },
    { key: "tonalSessionOrder", label: "Tonal session order", step: 1 }, { key: "totalVolumeLb", label: "Tonal volume · lb", step: 1 },
    { key: "maxResistanceLb", label: "Max resistance · lb", step: .1 }, { key: "completedSets", label: "Completed sets", step: 1 }, { key: "completedReps", label: "Completed reps", step: 1 },
  ];
  const updateActivity = (index: number, updater: (facts: ActivityFacts) => ActivityFacts) => setActivities((current) => current.map((facts, candidate) => candidate === index ? updater(facts) : facts));
  const updateMovement = (activityIndex: number, movementIndex: number, patch: Partial<TonalProgramMovement>) => updateActivity(activityIndex, (current) => ({ ...current, tonalMovements: (current.tonalMovements ?? []).map((movement, candidate) => candidate === movementIndex ? { ...movement, ...patch } : movement) }));
  const setNumeric = (index: number, key: typeof numericFields[number]["key"], value: string) => updateActivity(index, (current) => ({ ...current, [key]: value === "" ? undefined : { value: Math.max(0, Number(value) || 0), evidence: "user_supplied" } }));
  const hasUsableMetrics = activities.some((facts) => numericFields.some((field) => Boolean(facts[field.key])) || Boolean(facts.tonalMovements?.length) || Boolean(facts.workoutTitle));
  return <div className={styles.mealReview}><div className={styles.reviewTop}><strong>{proposal.summary}</strong><span>{proposal.confidence} confidence</span></div>{!hasUsableMetrics ? <p role="alert" className={styles.warning}>No usable completion metrics were extracted. Enter only values visible in the screenshot, or reject this proposal.</p> : null}{proposal.assumptions.map((assumption) => <p key={assumption} className={styles.provenance}>Assumption · {assumption}</p>)}<label>Activity date<input type="date" max={maxDate} value={occurredOn} onChange={(event) => { setOccurredOn(event.target.value); setDateConflictConfirmed(false); }} /></label>{proposal.sourceDate ? <p className={styles.provenance}>Visible screenshot date · {visibleActivityDateLabel(proposal.sourceDate)}</p> : <p className={styles.provenance}>No reliable date was visible in the screenshot; review the selected date.</p>}{dateConflict ? <div role="alert" className={styles.warning}><p>The selected date conflicts with the visible screenshot date. Nothing can be saved until you explicitly confirm the selected date.</p><label><input type="checkbox" checked={dateConflictConfirmed} onChange={(event) => setDateConflictConfirmed(event.target.checked)} /> Save under {prettyDate(occurredOn)} despite the visible source date</label></div> : null}{activities.map((facts, index) => <div key={index} className={styles.inlineEditor}><strong>Activity {index + 1}</strong><div className={styles.formGrid}><label>Activity<input value={facts.activityType} onChange={(event) => updateActivity(index, (current) => ({ ...current, activityType: event.target.value }))} /></label><label>Tonal workout title<input value={facts.workoutTitle ?? ""} onChange={(event) => updateActivity(index, (current) => ({ ...current, workoutTitle: event.target.value || undefined }))} /></label><label>Tonal program<input value={facts.tonalProgramTitle ?? ""} onChange={(event) => updateActivity(index, (current) => ({ ...current, tonalProgramTitle: event.target.value || undefined }))} /></label><label>Trainer<input value={facts.trainer ?? ""} onChange={(event) => updateActivity(index, (current) => ({ ...current, trainer: event.target.value || undefined }))} /></label><label>Pace<input value={facts.pace?.value ?? ""} onChange={(event) => updateActivity(index, (current) => ({ ...current, pace: event.target.value ? { value: event.target.value, evidence: "user_supplied" } : undefined }))} /></label>{numericFields.map((field) => <label key={field.key}>{field.label}<input type="number" min="0" step={field.step} value={(facts[field.key] as { value?: number } | undefined)?.value ?? ""} onChange={(event) => setNumeric(index, field.key, event.target.value)} /></label>)}</div>{facts.tonalMovements?.map((movement, movementIndex) => <div className={styles.formGrid} key={`${movement.name}-${movementIndex}`}><label>Completed movement<input value={movement.name} onChange={(event) => updateMovement(index, movementIndex, { name: event.target.value })} /></label><label>Sets<input type="number" min="1" value={movement.sets ?? ""} onChange={(event) => updateMovement(index, movementIndex, { sets: event.target.value ? Math.max(1, Number(event.target.value)) : undefined })} /></label><label>Reps<input value={movement.reps ?? ""} onChange={(event) => updateMovement(index, movementIndex, { reps: event.target.value || undefined })} /></label><label>Resistance<input value={movement.prescribedResistance ?? ""} onChange={(event) => updateMovement(index, movementIndex, { prescribedResistance: event.target.value || undefined })} /></label></div>)}<label>Notes<textarea value={facts.notes ?? ""} onChange={(event) => updateActivity(index, (current) => ({ ...current, notes: event.target.value }))} /></label></div>)}{proposal.dailySummary ? <p className={styles.provenance}>Daily WHOOP summary — not saved as an individual activity{proposal.dailySummary.whoopStrain ? ` · strain ${proposal.dailySummary.whoopStrain.value}` : ""}{proposal.dailySummary.notes ? ` · ${proposal.dailySummary.notes}` : ""}</p> : null}<p>{proposal.guidance}</p><p className={styles.provenance}>Visible values retain observed provenance. Any field you change becomes user supplied. A Tonal session advances only when its explicit sequence position, approved program, and workout title all match. Distinct activities remain separate, and accepting them does not otherwise reschedule a planned workout.</p><div className={styles.actions}><button className={styles.primary} disabled={activities.some((facts) => !facts.activityType.trim()) || !occurredOn || occurredOn > maxDate || (dateConflict && !dateConflictConfirmed)} onClick={() => void onAccept(activities, occurredOn, dateConflictConfirmed)}>{acceptLabel}</button><button onClick={onReject}>Reject</button></div></div>;
}

function ActivityRow({ activity, maxDate, onCorrectDate, onDeleteSource }: { activity: ActivityLog; maxDate?: string; onCorrectDate?: (date: string) => void; onDeleteSource?: () => void }) {
  const [editingDate, setEditingDate] = useState(false);
  const [correctedDate, setCorrectedDate] = useState(activity.occurredOn);
  const metrics = Object.entries(activity.facts).flatMap(([key, value]) => value && typeof value === "object" && "value" in value ? [`${key.replace(/([A-Z])/g, " $1").toLowerCase()}: ${String((value as { value: unknown }).value)} (${String((value as { evidence: unknown }).evidence)})`] : []);
  return <div className={styles.savedRow}><span>{prettyDate(activity.occurredOn)} · {activity.facts.activityType}</span><strong>{metrics.join(" · ") || "No numeric metrics supplied"}</strong><small>{activity.guidance}</small>{editingDate && onCorrectDate ? <div className={styles.inlineEditor}><label>Correct activity date<input type="date" max={maxDate} value={correctedDate} onChange={(event) => setCorrectedDate(event.target.value)} /></label><p className={styles.provenance}>The existing entry and source remain intact. Saving creates an audited date correction, not a duplicate activity.</p><div className={styles.compactActions}><button className={styles.primary} disabled={!correctedDate || correctedDate === activity.occurredOn || Boolean(maxDate && correctedDate > maxDate)} onClick={() => { onCorrectDate(correctedDate); setEditingDate(false); }}>Save correction</button><button onClick={() => { setCorrectedDate(activity.occurredOn); setEditingDate(false); }}>Cancel</button></div></div> : null}<div className={styles.compactActions}>{onCorrectDate ? <button onClick={() => setEditingDate((open) => !open)}>Correct date</button> : null}{onDeleteSource ? <button onClick={onDeleteSource}>Delete source image</button> : null}</div></div>;
}
