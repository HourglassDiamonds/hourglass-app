"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createInitialPersonalState, planForDate } from "@/lib/continuum/personal/program";
import { proposeProgression } from "@/lib/continuum/personal/progression";
import { parsePersonalState } from "@/lib/continuum/personal/state";
import { isSameLocalDay, nutritionTotals, remainingNutrition, weeklySummary } from "@/lib/continuum/personal/summary";
import type { FoodEntry, PerformedSet, PersonalSection, PersonalState, ProgressionProposal, WorkoutPlan, WorkoutSession } from "@/lib/continuum/personal/types";
import styles from "../personal.module.css";

const STORAGE_KEY = "continuum.personal.v1";
const root = "/executive-dashboard/concierge/personal";
const nav: { section: PersonalSection; label: string; href: string }[] = [
  { section: "today", label: "Today", href: root },
  { section: "workouts", label: "Workouts", href: `${root}/workouts` },
  { section: "food", label: "Food", href: `${root}/food` },
  { section: "progress", label: "Progress", href: `${root}/progress` },
];

function uid(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
function numberValue(value: FormDataEntryValue | null) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function withPerformanceHistory(plan: WorkoutPlan, sessions: WorkoutSession[], excludeSessionId?: string): WorkoutPlan {
  const completed = sessions.filter((session) => session.completedAt && session.planId === plan.id && session.id !== excludeSessionId).sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!));
  const latest = completed[0];
  if (!latest) return plan;
  return { ...plan, exercises: plan.exercises.map((exercise) => { const sets = latest.sets.filter((set) => set.exerciseId === exercise.id && set.completed && !set.skipped); return sets.length ? { ...exercise, previous: { load: sets.find((set) => set.load !== undefined)?.load, reps: sets.map((set) => set.reps), quality: sets.some((set) => set.pain) ? "pain flagged" : "completed" } } : exercise; }) };
}
function recentMinimumMisses(plan: WorkoutPlan, exerciseId: string, sessions: WorkoutSession[], excludeSessionId?: string): number {
  const exercise = plan.exercises.find((item) => item.id === exerciseId);
  if (!exercise) return 0;
  return sessions
    .filter((session) => session.id !== excludeSessionId && session.planId === plan.id && session.completedAt)
    .sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!))
    .slice(0, 2)
    .filter((session) => {
      const performed = session.sets.filter((set) => set.exerciseId === exerciseId && set.completed && !set.skipped);
      return performed.length < exercise.sets || performed.some((set) => set.reps < exercise.targetReps[0]);
    }).length;
}
function loadState(): PersonalState {
  try { return parsePersonalState(window.localStorage?.getItem(STORAGE_KEY) ?? null); } catch { return createInitialPersonalState(); }
}

export function PersonalApp({ section }: { section: PersonalSection }) {
  const [state, setState] = useState<PersonalState>(() => createInitialPersonalState());
  const [ready, setReady] = useState(false);
  const [photoName, setPhotoName] = useState("");
  const [foodMode, setFoodMode] = useState<"text" | "photo">("text");
  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    const hydration = window.setTimeout(() => { setState(loadState()); setReady(true); }, 0);
    return () => window.clearTimeout(hydration);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Storage may be unavailable in locked-down browsers. */ }
  }, [ready, state]);

  const todayPlan = withPerformanceHistory(planForDate(state.plans, today), state.sessions, state.activePlanId ?? undefined);
  const activeSession = state.sessions.find((item) => item.id === state.activePlanId);
  const activePlanBase = activeSession ? state.plans.find((plan) => plan.id === activeSession.planId) : undefined;
  const activePlan = activePlanBase ? withPerformanceHistory(activePlanBase, state.sessions, activeSession?.id) : undefined;
  const todayFood = state.foodEntries.filter((entry) => isSameLocalDay(entry.timestamp, today));
  const totals = nutritionTotals(todayFood);
  const remaining = remainingNutrition(todayFood, state.nutritionTargets);
  const week = weeklySummary(state, today);

  function startWorkout(plan: WorkoutPlan) {
    const session: WorkoutSession = { id: uid("session"), planId: plan.id, startedAt: new Date().toISOString(), readiness: 3, soreness: 2, sets: [] };
    setState((current) => ({ ...current, activePlanId: session.id, sessions: [...current.sessions, session] }));
  }

  function updateSession(patch: Partial<WorkoutSession>) {
    if (!activeSession) return;
    setState((current) => ({ ...current, sessions: current.sessions.map((session) => session.id === activeSession.id ? { ...session, ...patch } : session) }));
  }

  function updateSet(exerciseId: string, setNumber: number, patch: Partial<PerformedSet>) {
    if (!activeSession) return;
    const existing = activeSession.sets.find((set) => set.exerciseId === exerciseId && set.setNumber === setNumber);
    const base: PerformedSet = existing ?? { id: uid("set"), exerciseId, setNumber, reps: 0, completed: false, skipped: false, pain: false };
    const next = { ...base, ...patch };
    updateSession({ sets: [...activeSession.sets.filter((set) => !(set.exerciseId === exerciseId && set.setNumber === setNumber)), next] });
  }

  function completeWorkout() {
    if (!activeSession || !activePlan) return;
    const proposals = activePlan.exercises.map((exercise) => proposeProgression({ exercise, sets: activeSession.sets.filter((set) => set.exerciseId === exercise.id), recentMisses: recentMinimumMisses(activePlan, exercise.id, state.sessions, activeSession.id), readiness: activeSession.readiness, soreness: activeSession.soreness }));
    setState((current) => ({ ...current, activePlanId: null, sessions: current.sessions.map((session) => session.id === activeSession.id ? { ...session, completedAt: new Date().toISOString() } : session), proposals: [...current.proposals, ...proposals] }));
  }

  function swapPlan(planId: string) {
    setState((current) => ({ ...current, plans: current.plans.map((plan) => {
      if (plan.id !== planId || !plan.swap) return plan;
      return {
        ...plan,
        name: plan.swap.name,
        mode: plan.swap.mode,
        intent: plan.swap.intent,
        durationMinutes: plan.swap.durationMinutes,
        notes: plan.swap.notes,
        exercises: plan.swap.exercises,
        swap: {
          name: plan.name,
          mode: plan.mode,
          intent: plan.intent,
          durationMinutes: plan.durationMinutes,
          notes: plan.notes,
          exercises: plan.exercises,
        },
      };
    }) }));
  }

  function saveFood(formData: FormData) {
    const entry: FoodEntry = { id: uid("food"), timestamp: new Date().toISOString(), meal: String(formData.get("meal")) as FoodEntry["meal"], description: String(formData.get("description") ?? "").trim(), calories: numberValue(formData.get("calories")), protein: numberValue(formData.get("protein")), carbs: numberValue(formData.get("carbs")), fat: numberValue(formData.get("fat")), source: photoName ? "photo-manual" : "text", confidence: "confirmed", notes: String(formData.get("notes") ?? "").trim() || undefined, imageName: photoName || undefined };
    if (!entry.description) return;
    setState((current) => ({ ...current, foodEntries: [entry, ...current.foodEntries] }));
    setPhotoName("");
    const form = document.getElementById("food-form") as HTMLFormElement | null; form?.reset();
  }

  function setProposalStatus(id: string, status: ProgressionProposal["status"]) {
    setState((current) => {
      const selected = current.proposals.find((proposal) => proposal.id === id);
      const plans = status === "accepted" && selected ? current.plans.map((plan) => ({ ...plan, exercises: plan.exercises.map((exercise) => exercise.id === selected.exerciseId ? { ...exercise, targetLoad: selected.proposedLoad ?? exercise.targetLoad, targetReps: selected.proposedReps ?? exercise.targetReps, sets: selected.proposedSets ?? exercise.sets, progressionStage: selected.proposedStage ?? exercise.progressionStage } : exercise) })) : current.plans;
      return { ...current, plans, proposals: current.proposals.map((proposal) => proposal.id === id ? { ...proposal, status } : proposal) };
    });
  }
  function editProposal(proposal: ProgressionProposal) {
    const next = window.prompt("Proposed load for next time (leave blank for bodyweight/reps)", proposal.proposedLoad?.toString() ?? "");
    if (next === null) return;
    const value = next.trim() === "" ? undefined : Number(next);
    if (value !== undefined && !Number.isFinite(value)) return;
    setState((current) => ({ ...current, proposals: current.proposals.map((item) => item.id === proposal.id ? { ...item, proposedLoad: value, status: "edited" } : item) }));
  }

  return (
    <main className={styles.app} data-personal-home>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>Personal Continuum</p><h1>Build the week you can repeat.</h1></div>
        <span className={styles.localBadge}>Private · this device</span>
      </header>
      <nav className={styles.nav} aria-label="Personal">
        {nav.map((item) => <Link key={item.section} href={item.href} aria-current={section === item.section ? "page" : undefined}>{item.label}</Link>)}
      </nav>
      {!ready ? <section className={styles.card}><p>Loading your Personal plan…</p></section> : null}
      {ready && section === "today" ? <TodayView plan={todayPlan} activePlan={activePlan} activeSession={activeSession} totals={totals} remaining={remaining} food={todayFood} proposals={state.proposals.filter((item) => item.status === "pending" || item.status === "edited")} latestWeight={state.bodyMeasurements.at(-1)?.weight} onStart={() => startWorkout(todayPlan)} onComplete={completeWorkout} onUpdateSet={updateSet} onUpdateSession={updateSession} onProposal={setProposalStatus} onEditProposal={editProposal} /> : null}
      {ready && section === "workouts" ? <WorkoutsView state={state} activePlan={activePlan} activeSession={activeSession} onStart={startWorkout} onComplete={completeWorkout} onUpdateSet={updateSet} onUpdateSession={updateSession} onSwap={swapPlan} proposals={state.proposals} onProposal={setProposalStatus} onEditProposal={editProposal} /> : null}
      {ready && section === "food" ? <FoodView entries={state.foodEntries} targets={state.nutritionTargets} totals={totals} remaining={remaining} mode={foodMode} photoName={photoName} onMode={setFoodMode} onPhoto={setPhotoName} onSave={saveFood} /> : null}
      {ready && section === "progress" ? <ProgressView state={state} week={week} onWeight={(weight) => setState((current) => ({ ...current, bodyMeasurements: [...current.bodyMeasurements, { id: uid("weight"), timestamp: new Date().toISOString(), weight, unit: "lb" }] }))} /> : null}
    </main>
  );
}

function TodayView({ plan, activePlan, activeSession, totals, remaining, food, proposals, latestWeight, onStart, onComplete, onUpdateSet, onUpdateSession, onProposal, onEditProposal }: { plan: WorkoutPlan; activePlan?: WorkoutPlan; activeSession?: WorkoutSession; totals: ReturnType<typeof nutritionTotals>; remaining: ReturnType<typeof remainingNutrition>; food: FoodEntry[]; proposals: ProgressionProposal[]; latestWeight?: number; onStart: () => void; onComplete: () => void; onUpdateSet: (exerciseId: string, setNumber: number, patch: Partial<PerformedSet>) => void; onUpdateSession: (patch: Partial<WorkoutSession>) => void; onProposal: (id: string, status: ProgressionProposal["status"]) => void; onEditProposal: (proposal: ProgressionProposal) => void }) {
  return <div className={styles.stack}>
    <section className={`${styles.card} ${styles.hero}`}><div className={styles.cardTop}><div><p className={styles.kicker}>Today · {plan.mode}</p><h2>{activePlan?.name ?? plan.name}</h2></div><span>{activePlan?.durationMinutes ?? plan.durationMinutes} min</span></div><p>{activePlan?.notes ?? plan.notes}</p>{activeSession && activePlan ? <WorkoutLogger plan={activePlan} session={activeSession} onSet={onUpdateSet} onSession={onUpdateSession} onComplete={onComplete} /> : <button className={styles.primary} onClick={onStart}>Start workout</button>}</section>
    {proposals.length ? <ProposalList proposals={proposals} onStatus={onProposal} onEdit={onEditProposal} /> : null}
    <section className={styles.card}><div className={styles.cardTop}><div><p className={styles.kicker}>Food</p><h2>{totals.calories} kcal · {totals.protein}g protein</h2></div><Link href={`${root}/food`}>Log meal</Link></div><MacroRail value={totals.calories} target={totals.calories + remaining.calories} label={`${Math.max(0, remaining.calories)} kcal remaining`} /><div className={styles.metrics}><span><strong>{totals.carbs}g</strong> carbs</span><span><strong>{totals.fat}g</strong> fat</span><span><strong>{food.length}</strong> meals</span></div>{food.slice(0, 3).map((entry) => <p className={styles.listLine} key={entry.id}><span>{entry.description}</span><span>{entry.calories} kcal</span></p>)}</section>
    <section className={styles.card}><p className={styles.kicker}>Body / activity</p><h2>{latestWeight ? `${latestWeight} lb` : "No weight logged"}</h2><p>Apple Health is not connected. The web app cannot read HealthKit directly; the future import boundary is intentionally inactive.</p><Link href={`${root}/progress`}>Open weekly progress</Link></section>
  </div>;
}

function WorkoutLogger({ plan, session, onSet, onSession, onComplete }: { plan: WorkoutPlan; session: WorkoutSession; onSet: (exerciseId: string, setNumber: number, patch: Partial<PerformedSet>) => void; onSession: (patch: Partial<WorkoutSession>) => void; onComplete: () => void }) {
  const completed = session.sets.filter((set) => set.completed || set.skipped).length;
  const total = plan.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  return <div className={styles.logger}><div className={styles.progressText}><span>{completed} / {total} sets recorded</span><span>{Math.round((completed / total) * 100)}%</span></div><MacroRail value={completed} target={total} label="Workout progress" />
    <div className={styles.readiness}><label>Readiness <select value={session.readiness} onChange={(event) => onSession({ readiness: Number(event.target.value) })}>{[1,2,3,4,5].map((n) => <option key={n}>{n}</option>)}</select></label><label>Soreness <select value={session.soreness} onChange={(event) => onSession({ soreness: Number(event.target.value) })}>{[1,2,3,4,5].map((n) => <option key={n}>{n}</option>)}</select></label></div>
    {plan.exercises.map((exercise) => <details className={styles.exercise} key={exercise.id} open><summary><span><strong>{exercise.name}</strong><small>{exercise.progressionStage ? `Stage ${exercise.progressionStage} · ` : ""}{exercise.equipment} · {exercise.sets} × {exercise.targetReps[0]}–{exercise.targetReps[1]}{exercise.targetLoad ? ` @ ${exercise.targetLoad} lb` : ""}</small></span><span>⌄</span></summary>{exercise.previous ? <p className={styles.previous}>Last: {exercise.previous.load ? `${exercise.previous.load} lb · ` : ""}{exercise.previous.reps.join(" / ")} reps</p> : <p className={styles.previous}>First baseline — keep 2–3 clean reps in reserve.</p>}<p>{exercise.notes}</p>{exercise.regression ? <p><strong>Make it easier:</strong> {exercise.regression}</p> : null}{exercise.progressionCriterion ? <p><strong>Advance when:</strong> {exercise.progressionCriterion}</p> : null}
      <div className={styles.setGrid}>{Array.from({ length: exercise.sets }, (_, index) => { const setNumber = index + 1; const logged = session.sets.find((set) => set.exerciseId === exercise.id && set.setNumber === setNumber); return <div className={styles.setRow} key={setNumber}><b>{setNumber}</b>{exercise.targetLoad !== undefined ? <label>lb<input inputMode="decimal" value={logged?.load ?? exercise.targetLoad} onChange={(event) => onSet(exercise.id, setNumber, { load: Number(event.target.value) })} /></label> : null}<label>{exercise.kind === "cardio" ? "min" : "reps"}<input inputMode="numeric" value={logged?.reps ?? ""} placeholder={String(exercise.targetReps[0])} onChange={(event) => onSet(exercise.id, setNumber, { reps: Number(event.target.value) })} /></label><label>RIR<input inputMode="numeric" value={logged?.rir ?? ""} placeholder="2" onChange={(event) => onSet(exercise.id, setNumber, { rir: Number(event.target.value) })} /></label><button className={logged?.completed ? styles.done : styles.setButton} onClick={() => onSet(exercise.id, setNumber, { completed: !logged?.completed, skipped: false })}>{logged?.completed ? "Done" : "Log"}</button><button className={logged?.skipped ? styles.warn : styles.ghost} onClick={() => onSet(exercise.id, setNumber, { skipped: !logged?.skipped, completed: false })}>Skip</button><label className={styles.pain}><input type="checkbox" checked={logged?.pain ?? false} onChange={(event) => onSet(exercise.id, setNumber, { pain: event.target.checked })} /> Pain</label></div>; })}</div>
    </details>)}
    <button className={styles.primary} onClick={onComplete}>Complete workout & review proposals</button>
  </div>;
}

function WorkoutsView({ state, activePlan, activeSession, onStart, onComplete, onUpdateSet, onUpdateSession, onSwap, proposals, onProposal, onEditProposal }: { state: PersonalState; activePlan?: WorkoutPlan; activeSession?: WorkoutSession; onStart: (plan: WorkoutPlan) => void; onComplete: () => void; onUpdateSet: (exerciseId: string, setNumber: number, patch: Partial<PerformedSet>) => void; onUpdateSession: (patch: Partial<WorkoutSession>) => void; onSwap: (id: string) => void; proposals: ProgressionProposal[]; onProposal: (id: string, status: ProgressionProposal["status"]) => void; onEditProposal: (proposal: ProgressionProposal) => void }) {
  return <div className={styles.stack}><section className={styles.intro}><p className={styles.eyebrow}>Foundation block</p><h2>Strength, capacity, control.</h2><p>Three Tonal-led strength days, aerobic work, beginner bodyweight progressions, and recovery. The 100 lb ruck remains locked as an advanced future option.</p></section>{activeSession && activePlan ? <section className={styles.card}><p className={styles.kicker}>Active workout</p><h2>{activePlan.name}</h2><WorkoutLogger plan={activePlan} session={activeSession} onSet={onUpdateSet} onSession={onUpdateSession} onComplete={onComplete} /></section> : null}<section className={styles.schedule}>{[1,2,3,4,5,6,0].map((day) => { const plan = state.plans.find((item) => item.weekday === day)!; return <article className={styles.card} key={plan.id}><div className={styles.cardTop}><div><p className={styles.kicker}>{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][day]} · {plan.mode}</p><h3>{plan.name}</h3></div><span>{plan.durationMinutes}m</span></div><p>{plan.notes}</p><p className={styles.muted}>{plan.exercises.map((item) => item.name).join(" · ")}</p><div className={styles.actions}><button onClick={() => onStart(plan)} disabled={Boolean(activeSession)}>Start</button>{plan.swap ? <button className={styles.ghost} onClick={() => onSwap(plan.id)}>Swap equivalent</button> : null}</div></article>; })}</section>{proposals.length ? <ProposalList proposals={proposals} onStatus={onProposal} onEdit={onEditProposal} /> : null}</div>;
}

function ProposalList({ proposals, onStatus, onEdit }: { proposals: ProgressionProposal[]; onStatus: (id: string, status: ProgressionProposal["status"]) => void; onEdit: (proposal: ProgressionProposal) => void }) {
  return <section className={styles.card}><p className={styles.kicker}>Next-session proposals</p><h2>Review every change</h2>{proposals.slice().reverse().map((proposal) => <div className={styles.proposal} key={proposal.id}><div><strong>{proposal.exerciseName}</strong><p>{proposal.action.toUpperCase()}{proposal.proposedLoad !== undefined ? ` · ${proposal.proposedLoad} lb` : ""}{proposal.proposedSets !== undefined ? ` · ${proposal.proposedSets} rounds` : ""}{proposal.proposedStage !== undefined ? ` · stage ${proposal.proposedStage}` : ""} — {proposal.reason}</p></div><span className={styles.status}>{proposal.status}</span>{proposal.status === "pending" || proposal.status === "edited" ? <div className={styles.actions}><button onClick={() => onStatus(proposal.id, "accepted")}>Accept</button><button className={styles.ghost} onClick={() => onEdit(proposal)}>Edit</button><button className={styles.ghost} onClick={() => onStatus(proposal.id, "rejected")}>Reject</button></div> : null}</div>)}</section>;
}

function FoodView({ entries, targets, totals, remaining, mode, photoName, onMode, onPhoto, onSave }: { entries: FoodEntry[]; targets: PersonalState["nutritionTargets"]; totals: ReturnType<typeof nutritionTotals>; remaining: ReturnType<typeof remainingNutrition>; mode: "text" | "photo"; photoName: string; onMode: (mode: "text" | "photo") => void; onPhoto: (name: string) => void; onSave: (data: FormData) => void }) {
  return <div className={styles.stack}><section className={styles.card}><p className={styles.kicker}>Today’s nutrition</p><h2>{totals.calories} / {targets.calories} kcal</h2><MacroRail value={totals.calories} target={targets.calories} label={`${remaining.calories} kcal · ${remaining.protein}g protein remaining`} /><div className={styles.metrics}><span><strong>{totals.protein}g</strong> protein</span><span><strong>{totals.carbs}g</strong> carbs</span><span><strong>{totals.fat}g</strong> fat</span></div></section>
    <section className={styles.card}><div className={styles.segment}><button className={mode === "text" ? styles.active : ""} onClick={() => onMode("text")}>Text / manual</button><button className={mode === "photo" ? styles.active : ""} onClick={() => onMode("photo")}>Meal photo</button></div><form id="food-form" action={onSave} className={styles.form}><label>Meal<select name="meal" defaultValue="lunch"><option>breakfast</option><option>lunch</option><option>dinner</option><option>snack</option></select></label>{mode === "photo" ? <><label className={styles.upload}>Choose meal photo<input type="file" accept="image/*" capture="environment" onChange={(event) => onPhoto(event.target.files?.[0]?.name ?? "")} /></label><div className={styles.notice}><strong>{photoName ? `${photoName} selected` : "Photo ready when you are"}</strong><p>Automatic plate estimation is not connected. Enter and review the values below; nothing is saved until you press Save. Oils, sauces, portions, and restaurant preparation can materially change the estimate.</p></div></> : null}<label>Description<input name="description" required placeholder="Chicken, rice and broccoli" /></label><div className={styles.nutritionGrid}><label>Calories<input name="calories" type="number" min="0" required /></label><label>Protein g<input name="protein" type="number" min="0" required /></label><label>Carbs g<input name="carbs" type="number" min="0" required /></label><label>Fat g<input name="fat" type="number" min="0" required /></label></div><label>Notes<input name="notes" placeholder="Sauce on side, half portion…" /></label><button className={styles.primary} type="submit">Review complete · save meal</button></form></section>
    <section className={styles.card}><p className={styles.kicker}>Recent meals</p>{entries.length ? entries.map((entry) => <div className={styles.meal} key={entry.id}><div><strong>{entry.description}</strong><small>{new Date(entry.timestamp).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })} · {entry.meal} · {entry.source}</small></div><span>{entry.calories} kcal<br />{entry.protein}g P</span></div>) : <p>No meals logged yet.</p>}</section>
  </div>;
}

function ProgressView({ state, week, onWeight }: { state: PersonalState; week: ReturnType<typeof weeklySummary>; onWeight: (weight: number) => void }) {
  return <div className={styles.stack}><section className={styles.intro}><p className={styles.eyebrow}>This week</p><h2>Change the smallest useful thing.</h2><p>Trends guide proposals; no single weigh-in or difficult session changes the plan.</p></section><section className={styles.metricGrid}><article className={styles.card}><span>Workouts</span><strong>{week.completed} / {week.planned}</strong><small>completed / planned</small></article><article className={styles.card}><span>Avg calories</span><strong>{week.averageCalories || "—"}</strong><small>{week.loggedNutritionDays} logged days</small></article><article className={styles.card}><span>Avg protein</span><strong>{week.averageProtein ? `${week.averageProtein}g` : "—"}</strong><small>daily average</small></article><article className={styles.card}><span>Weight trend</span><strong>{week.weightChange === null ? "—" : `${week.weightChange > 0 ? "+" : ""}${week.weightChange} lb`}</strong><small>this week</small></article></section><section className={styles.card}><p className={styles.kicker}>Next-week read</p><h2>{week.completed >= 5 ? "Hold the structure; earn the next progression." : "Protect consistency before adding work."}</h2><p>{week.completed >= 5 ? "Accept only the exercise proposals that match recovery and form. Keep the calorie target steady until there is a multi-week trend." : "Do not add make-up volume. Resume the next planned session and keep protein visible."}</p></section><section className={styles.card}><p className={styles.kicker}>Bodyweight</p><form action={(data) => onWeight(numberValue(data.get("weight")))} className={styles.inlineForm}><label>Weight (lb)<input name="weight" type="number" step="0.1" min="1" required /></label><button type="submit">Log weight</button></form>{state.bodyMeasurements.slice(-5).reverse().map((item) => <p className={styles.listLine} key={item.id}><span>{new Date(item.timestamp).toLocaleDateString()}</span><span>{item.weight} lb</span></p>)}</section><section className={styles.notice}><strong>Apple Health import: not connected</strong><p>This web/PWA runtime has no HealthKit bridge. A future native iOS companion can request permission and send versioned, authenticated workout, weight, energy, steps, and sleep records.</p></section></div>;
}

function MacroRail({ value, target, label }: { value: number; target: number; label: string }) { const percent = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0; return <div className={styles.railWrap}><div className={styles.rail}><i style={{ width: `${percent}%` }} /></div><small>{label}</small></div>; }
