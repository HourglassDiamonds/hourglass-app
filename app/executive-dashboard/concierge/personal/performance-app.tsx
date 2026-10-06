"use client";

import Link from "next/link";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { applySterlingProposal, deferAndReflow, proposeSterlingAdjustment } from "@/lib/continuum/personal/adaptation";
import { createInitialPersonalState, dateKey, shiftDate } from "@/lib/continuum/personal/program";
import { proposeProgression } from "@/lib/continuum/personal/progression";
import { migrateLegacyPersonalState, parsePersonalState } from "@/lib/continuum/personal/state";
import { deriveFrequentlyEaten, frequentFromMeal, logFrequentMeal, mealName, mealSignature, type FrequentMealCandidate } from "@/lib/continuum/personal/nutrition";
import type { FrequentMeal, MealEstimate, MealItem, MealLog, PerformedSet, PersonalState, RecoveryEntry, ScheduledWorkout, SterlingProposal, WorkoutSession } from "@/lib/continuum/personal/types";
import styles from "./performance.module.css";

const STORAGE_KEY = "continuum.personal.performance.v2";
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
  const [originalMealEstimate, setOriginalMealEstimate] = useState<MealEstimate | null>(null);
  const [mealPhoto, setMealPhoto] = useState<{ name: string; type: string; size: number } | null>(null);
  const [mealBusy, setMealBusy] = useState(false);
  const [mealError, setMealError] = useState("");
  const [lastAddedMealId, setLastAddedMealId] = useState<string | null>(null);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [editingFrequentId, setEditingFrequentId] = useState<string | null>(null);

  useEffect(() => {
    const key = localToday(); setToday(key);
    let next: PersonalState;
    try {
      const current = window.localStorage.getItem(STORAGE_KEY);
      next = current ? parsePersonalState(current, key) : migrateLegacyPersonalState(window.localStorage.getItem(LEGACY_STORAGE_KEY), key) ?? createInitialPersonalState(key);
    } catch { next = createInitialPersonalState(key); }
    setState(next); setReady(true);
  }, []);
  useEffect(() => { if (ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [ready, state]);

  const activeToday = state.schedule.find((workout) => workout.date === today && !["completed", "deferred", "skipped", "replaced"].includes(workout.status));
  const activeSession = activeToday ? state.sessions.find((session) => session.scheduledWorkoutId === activeToday.id && !session.completedAt) : undefined;
  const latestRecovery = state.recoveryEntries.find((entry) => entry.date === today);
  const todayMeals = state.meals.filter((meal) => meal.timestamp.slice(0, 10) === today);
  const nutrition = totals(todayMeals.flatMap((meal) => meal.items));
  const week = state.schedule.filter((workout) => workout.date >= shiftDate(today, -6) && workout.date <= shiftDate(today, 8));
  const weights = state.recoveryEntries.filter((entry) => entry.bodyweightLb).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const weekStart = shiftDate(today, -((new Date(`${today}T12:00:00`).getDay() + 6) % 7));
  const weekEnd = shiftDate(weekStart, 6);
  const thisWeekMeals = state.meals.filter((meal) => meal.timestamp.slice(0, 10) >= weekStart && meal.timestamp.slice(0, 10) <= weekEnd);
  const loggedDays = new Set(thisWeekMeals.map((meal) => meal.timestamp.slice(0, 10))).size;
  const weekNutrition = totals(thisWeekMeals.flatMap((meal) => meal.items));
  const frequentlyEaten = deriveFrequentlyEaten(state.meals, state.frequentMeals);

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

  async function analyzeMealFile(original: File) {
    setMealBusy(true); setMealError(""); setMealEstimate(null); setOriginalMealEstimate(null);
    try {
      const image = await compactImage(original); const body = new FormData(); body.set("image", image);
      const response = await fetch("/executive-dashboard/concierge/personal/meal-photo", { method: "POST", body });
      const payload = await response.json() as { ok: boolean; estimate?: MealEstimate; error?: string };
      if (!response.ok || !payload.ok || !payload.estimate) throw new Error(payload.error || "analysis-failed");
      setMealPhoto({ name: original.name, type: original.type, size: original.size }); setOriginalMealEstimate(structuredClone(payload.estimate)); setMealEstimate(payload.estimate);
    } catch (error) { setMealError(error instanceof Error && error.message === "meal-analysis-unavailable" ? "Photo analysis is not configured. Manual meal logging remains available below." : "The photo could not be estimated just now. You can retry or log the meal manually."); }
    finally { setMealBusy(false); }
  }

  function chooseMealPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (file) void analyzeMealFile(file);
  }

  function updateMealItem(id: string, patch: Partial<MealItem>) { setMealEstimate((estimate) => estimate ? { ...estimate, items: estimate.items.map((item) => item.id === id ? { ...item, ...patch } : item) } : null); }
  function acceptMeal(mealType?: MealLog["mealType"]) {
    if (!mealEstimate) return; const final = totals(mealEstimate.items);
    const meal: MealLog = { id: uid("meal"), timestamp: new Date().toISOString(), mealType, items: mealEstimate.items, ...final, photo: mealPhoto ?? undefined, aiEstimate: originalMealEstimate ?? undefined, provenance: ["ai_meal_estimate", "user_confirmed"] };
    setState((current) => ({ ...current, meals: [meal, ...current.meals] })); setMealEstimate(null); setOriginalMealEstimate(null); setMealPhoto(null);
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
    <header className={styles.header}><div><p className={styles.eyebrow}>Personal / Performance</p><h1>Tell Sterling what happened. Keep the plan alive.</h1><p>Daily training, recovery, and nutrition with explicit decisions and durable context.</p></div><span className={styles.private}>Private · this browser</span></header>
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
      <section className={styles.card}><div className={styles.cardTop}><div><p className={styles.kicker}>Nutrition today</p><h2>{nutrition.calories} / {state.nutritionTargets.calories} kcal · {nutrition.protein} / {state.nutritionTargets.protein}g protein</h2></div><Link href="/executive-dashboard/concierge/personal/food">Log meal</Link></div></section>
    </div> : null}

    {view === "nutrition" ? <div className={styles.stack}>
      <section className={styles.card}><p className={styles.kicker}>Today’s targets</p><h2>{nutrition.calories} / {state.nutritionTargets.calories} kcal · {nutrition.protein} / {state.nutritionTargets.protein}g protein</h2><p>{nutrition.carbs} / {state.nutritionTargets.carbs}g carbs · {nutrition.fat} / {state.nutritionTargets.fat}g fat</p></section>
      <section className={`${styles.card} ${styles.quickLog}`}><p className={styles.kicker}>Quick log</p><h2>Photo or one tap.</h2><div className={styles.photoActions}><label className={`${styles.photoAction} ${styles.primary}`}>TAKE PHOTO<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" capture="environment" onChange={chooseMealPhoto} disabled={mealBusy} /></label><label className={styles.photoAction}>UPLOAD PHOTO<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={chooseMealPhoto} disabled={mealBusy} /></label></div>{mealBusy ? <p aria-live="polite">Estimating meal…</p> : null}{mealError ? <p role="alert" className={styles.warning}>{mealError}</p> : null}</section>
      <section className={styles.card}><div className={styles.cardTop}><div><p className={styles.kicker}>Frequently Eaten</p><h2>{frequentlyEaten.length ? "Your regulars, ready in one tap." : "Regular meals will appear here."}</h2></div></div><p>Meals repeat automatically after two accepted logs. You can also pin any saved meal.</p>{frequentlyEaten.length ? <div className={styles.frequentGrid}>{frequentlyEaten.map((frequent) => <div className={styles.frequentCard} key={frequent.id}><button className={styles.frequentLog} onClick={() => oneTapLog(frequent)} aria-label={`Log ${frequent.name}`}><strong>{frequent.name}</strong><span>{frequent.items.map((item) => item.portion).filter(Boolean).join(" · ") || "Saved serving"}</span><small>{frequent.calories} kcal · {frequent.protein}P · {frequent.carbs}C · {frequent.fat}F{frequent.mealType ? ` · ${frequent.mealType}` : ""}</small></button><div className={styles.compactActions}><button onClick={() => storeFrequent(frequent, { pinned: !frequent.pinned })}>{frequent.pinned ? "Unpin" : "Pin"}</button><button onClick={() => setEditingFrequentId((id) => id === frequent.id ? null : frequent.id)}>Edit default</button><button onClick={() => storeFrequent(frequent, { hidden: true })}>Hide</button></div>{editingFrequentId === frequent.id ? <FrequentDefaultEditor frequent={frequent} onChange={(itemId, patch) => updateFrequentDefault(frequent, itemId, patch)} onDone={() => setEditingFrequentId(null)} /> : null}</div>)}</div> : null}</section>
      {lastAddedMealId && state.meals.some((meal) => meal.id === lastAddedMealId) ? <section className={`${styles.card} ${styles.undoBar}`} aria-live="polite"><div><p className={styles.kicker}>Logged</p><strong>{state.meals.find((meal) => meal.id === lastAddedMealId)?.items.map((item) => item.name).join(", ")}</strong></div><div className={styles.actions}><button onClick={() => setEditingMealId((id) => id === lastAddedMealId ? null : lastAddedMealId)}>Edit</button><button onClick={undoLastMeal}>Undo</button></div>{editingMealId === lastAddedMealId ? <MealOccurrenceEditor meal={state.meals.find((meal) => meal.id === lastAddedMealId)!} onChange={(itemId, patch) => updateMealOccurrence(lastAddedMealId, itemId, patch)} onDone={() => setEditingMealId(null)} /> : null}</section> : null}
      {mealEstimate ? <section className={styles.card}><p className={styles.kicker}>Review required</p><h2>Photo → AI estimate → your approval</h2><p>Nothing is saved until you accept the editable values below. The untouched AI estimate is retained separately for provenance.</p><MealReview estimate={mealEstimate} onChange={updateMealItem} onRemove={(id) => setMealEstimate((estimate) => estimate ? { ...estimate, items: estimate.items.filter((item) => item.id !== id) } : null)} onAdd={() => setMealEstimate((estimate) => estimate ? { ...estimate, items: [...estimate.items, { id: uid("meal-item"), name: "", portion: "", calories: 0, protein: 0, carbs: 0, fat: 0, confidence: "low" }] } : null)} onAccept={acceptMeal} onReject={() => { setMealEstimate(null); setOriginalMealEstimate(null); setMealPhoto(null); }} /></section> : null}
      <section className={styles.card}><p className={styles.kicker}>Manual meal</p><h2>Log without a photo.</h2><form className={styles.recoveryForm} onSubmit={saveManualMeal}><div className={styles.formGrid}><label>Food<input name="name" placeholder="Chicken, rice, greens" required /></label><label>Portion<input name="portion" placeholder="6 oz / 1 cup" /></label><label>Meal type<select name="mealType"><option value="">Not supplied</option><option>breakfast</option><option>lunch</option><option>dinner</option><option>snack</option></select></label></div><div className={styles.formGrid}><label>Calories<input name="calories" type="number" min="0" required /></label><label>Protein<input name="protein" type="number" min="0" required /></label><label>Carbs<input name="carbs" type="number" min="0" required /></label><label>Fat<input name="fat" type="number" min="0" required /></label></div><button className={styles.primary}>Save manual meal</button></form></section>
      <section className={styles.card}><p className={styles.kicker}>Saved meals · canonical</p>{state.meals.length ? state.meals.slice(0, 10).map((meal) => <div className={styles.savedRow} key={meal.id}><span>{meal.items.map((item) => item.name).join(", ")}</span><strong>{meal.calories} kcal · {meal.protein}P · {meal.carbs}C · {meal.fat}F</strong><small>{meal.aiEstimate ? "AI estimate retained · user-approved values canonical" : meal.frequentMealId ? "one-tap relog" : "manual"}</small><div className={styles.compactActions}><button onClick={() => saveAsFrequent(meal)}>{state.frequentMeals.some((item) => item.signature === mealSignature(meal)) ? "Update frequent" : "Save as frequent"}</button></div></div>) : <p>No meals saved yet.</p>}</section>
    </div> : null}

    {view === "recovery" ? <div className={styles.stack}><section className={styles.card}><p className={styles.kicker}>Morning check-in</p><h2>Log only what you know.</h2><p>Every field is optional. Measured/manual numbers stay distinct from subjective ratings; absent WHOOP metrics remain absent.</p><RecoveryForm existing={latestRecovery} onSubmit={saveRecovery} /></section>{latestRecovery ? <section className={styles.card}><p className={styles.kicker}>Saved today</p><div className={styles.metricGrid}>{Object.entries(latestRecovery).filter(([, value]) => value && typeof value === "object" && "source" in value).map(([key, value]) => { const metric = value as { value: string | number; source: string }; return <div key={key}><span>{key}</span><strong>{metric.value}</strong><small>{metric.source}</small></div>; })}</div></section> : null}</div> : null}

    {view === "week" ? <section className={styles.week}>{week.map((workout) => <article className={styles.card} key={`${workout.id}-${workout.date}-${workout.status}`}><div className={styles.cardTop}><div><p className={styles.kicker}>{prettyDate(workout.date)} · {workout.status.replace("_", " ")}</p><h3>{workout.prescription.name}</h3></div><span>{workout.prescription.domain}</span></div><p>{workout.prescription.notes}</p><small>{workout.history.at(-1)?.note}</small>{workout.prescription.alternative && workout.status === "planned" ? <div className={styles.actions}><button onClick={() => swapWorkout(workout.id)}>Swap equivalent</button></div> : null}</article>)}</section> : null}

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
