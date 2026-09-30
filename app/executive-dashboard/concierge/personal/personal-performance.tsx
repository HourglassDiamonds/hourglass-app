"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  PERFORMANCE_PARAMETERS,
  prescriptionForDate,
  programPositionForDate,
  weekDateKeys,
} from "@/lib/continuum/personal-performance/program";
import {
  createInitialPerformanceState,
  parsePerformanceState,
  rollingWeightAverage,
  type DayLog,
  type MealEntry,
  type PerformanceState,
} from "@/lib/continuum/personal-performance/state";
import styles from "./personal-performance.module.css";

const STORAGE_KEY = "continuum.personal-performance.v1";

function shortDate(dateKey: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(`${dateKey}T12:00:00`),
  );
}

function dayLetter(dateKey: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "narrow" }).format(
    new Date(`${dateKey}T12:00:00`),
  );
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function shiftDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function TrendChart({ entries }: { entries: PerformanceState["weights"] }) {
  const recent = entries.slice(-8);
  if (!recent.length) {
    return <div className={styles.chartEmpty}>Rolling trend begins with the Week 1 baseline.</div>;
  }
  const values = recent.map((entry) => entry.weight);
  const min = Math.min(...values) - 0.5;
  const max = Math.max(...values) + 0.5;
  const range = Math.max(1, max - min);
  const points = recent.map((entry, index) => ({
    x: recent.length === 1 ? 50 : (index / (recent.length - 1)) * 100,
    y: 35 - ((entry.weight - min) / range) * 28,
  }));
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");

  return (
    <svg className={styles.trendChart} viewBox="0 0 100 40" role="img" aria-label="Recent weight measurements">
      <path d="M0 35H100" className={styles.chartBaseline} />
      <path d={path} className={styles.chartLine} />
      {points.map((point, index) => (
        <circle key={`${recent[index].date}-${index}`} cx={point.x} cy={point.y} r="1.8" className={styles.chartPoint} />
      ))}
    </svg>
  );
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles.progress} aria-label={label}>
      <span style={{ width: `${clamp(value)}%` }} />
    </div>
  );
}

function readStoredState(): { state: PerformanceState | null; recovered: boolean } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: null, recovered: false };
    const state = parsePerformanceState(JSON.parse(raw));
    return { state, recovered: state === null };
  } catch {
    return { state: null, recovered: true };
  }
}

export function PersonalPerformance({ todayKey }: { todayKey: string }) {
  const [state, setState] = useState<PerformanceState>(createInitialPerformanceState);
  const hydrated = useRef(false);
  const skipNextPersist = useRef(false);
  const [storageRecovered, setStorageRecovered] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [waistInput, setWaistInput] = useState("");
  const [mealName, setMealName] = useState("");
  const [mealCalories, setMealCalories] = useState("");
  const [mealProtein, setMealProtein] = useState("");

  useEffect(() => {
    const stored = readStoredState();
    if (stored.state) {
      skipNextPersist.current = true;
      // Storage is the V1 source of current truth after the server-safe first render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(stored.state);
    }
    if (stored.recovered) {
      setStorageRecovered(true);
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // The module remains usable in-memory when browser storage is unavailable.
    }
  }, [state]);

  const position = programPositionForDate(todayKey);
  const isPrep = position.status === "prep";
  const isActive = position.status === "active";
  const today = prescriptionForDate(todayKey);
  const todayLog = state.days[todayKey] ?? {};
  const todayMeals = useMemo(() => state.meals[todayKey] ?? [], [state.meals, todayKey]);
  const currentWeight = state.weights.at(-1)?.weight ?? null;
  const currentWaist = [...state.weights].reverse().find((entry) => entry.waist)?.waist;
  const rollingWeight = rollingWeightAverage(state.weights);
  const hasTrend = state.weights.length >= 3 && rollingWeight !== null;
  const bodyProgress = hasTrend
    ? ((PERFORMANCE_PARAMETERS.body.startingWeightLb - rollingWeight)
      / (PERFORMANCE_PARAMETERS.body.startingWeightLb - PERFORMANCE_PARAMETERS.body.targetWeightLb)) * 100
    : 0;
  const weekKeys = isPrep
    ? weekDateKeys(PERFORMANCE_PARAMETERS.startDate)
    : weekDateKeys(todayKey);
  const scheduledThroughToday = isActive
    ? weekKeys.filter((key) => key <= todayKey && prescriptionForDate(key).title !== "Rest")
    : [];
  const completedCount = scheduledThroughToday.filter(
    (key) => state.days[key]?.status === "completed",
  ).length;
  const skippedCount = scheduledThroughToday.filter(
    (key) => state.days[key]?.status === "skipped",
  ).length;
  const unrecordedCount = scheduledThroughToday.length - completedCount - skippedCount;
  const saturdayKey = !isPrep && todayKey > weekKeys[5]
    ? shiftDateKey(weekKeys[5], 7)
    : weekKeys[5];
  const saturday = prescriptionForDate(saturdayKey);
  const caloriesTarget = state.parameters.dailyCalories;
  const proteinTarget = state.parameters.dailyProteinG;
  const nutrition = useMemo(
    () => todayMeals.reduce(
      (total, meal) => ({ calories: total.calories + meal.calories, protein: total.protein + meal.protein }),
      { calories: 0, protein: 0 },
    ),
    [todayMeals],
  );
  const recentConditioning = Object.entries(state.days)
    .filter(([key, log]) => key <= todayKey && log.status === "completed" && prescriptionForDate(key).domain === "engine")
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 3);
  const recentStrength = Object.entries(state.days)
    .filter(([key, log]) => key <= todayKey && log.status === "completed" && prescriptionForDate(key).domain === "strength")
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 3);
  const unusualSoreness = todayLog.readiness === "sore" && !todayLog.status;
  const currentCapability = recentConditioning[0]
    ? `${shortDate(recentConditioning[0][0])} · ${prescriptionForDate(recentConditioning[0][0]).title}`
    : "Baseline not established";

  const todayState = isPrep
    ? "PREP"
    : todayLog.status === "completed"
      ? "COMPLETED"
      : todayLog.status === "skipped"
        ? "SKIPPED"
        : unusualSoreness
          ? "ADAPTED"
          : "PLANNED";
  const todayTitle = isPrep
    ? today.title
    : todayLog.status === "completed"
      ? "Done for today."
      : todayLog.status === "skipped"
        ? "Skipped, without debt."
        : unusualSoreness
          ? "Recovery replaces training."
          : today.title;
  const todaySummary = isPrep
    ? today.summary
    : todayLog.status === "completed"
      ? "The work is recorded. Recover, eat simply, and leave tomorrow where it is."
      : todayLog.status === "skipped"
        ? "Continue with the next scheduled day. Do not combine sessions to catch up."
        : unusualSoreness
          ? "Choose 15–20 minutes of easy walking or Peloton plus gentle mobility. Resume the schedule when movement feels normal."
          : today.summary;

  function updateDay(updater: (current: DayLog) => DayLog) {
    if (!isActive) return;
    setState((current) => ({
      ...current,
      days: { ...current.days, [todayKey]: updater(current.days[todayKey] ?? {}) },
    }));
  }

  function logWeight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isActive) return;
    const weight = Number(weightInput);
    const waist = waistInput ? Number(waistInput) : undefined;
    if (!Number.isFinite(weight) || weight < 100 || weight > 400) return;
    if (waist !== undefined && (!Number.isFinite(waist) || waist < 20 || waist > 80)) return;
    setState((current) => ({
      ...current,
      weights: [
        ...current.weights.filter((entry) => entry.date !== todayKey),
        { date: todayKey, weight, ...(waist === undefined ? {} : { waist }) },
      ].sort((a, b) => a.date.localeCompare(b.date)),
    }));
    setWeightInput("");
    setWaistInput("");
  }

  function logMeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isActive) return;
    const calories = Number(mealCalories);
    const protein = Number(mealProtein);
    if (!mealName.trim() || !Number.isFinite(calories) || !Number.isFinite(protein) || calories < 0 || protein < 0) return;
    const meal: MealEntry = {
      id: `${todayKey}-${Date.now()}`,
      name: mealName.trim().slice(0, 120),
      calories,
      protein,
    };
    setState((current) => ({
      ...current,
      meals: { ...current.meals, [todayKey]: [...(current.meals[todayKey] ?? []), meal] },
    }));
    setMealName("");
    setMealCalories("");
    setMealProtein("");
  }

  function removeMeal(mealId: string) {
    setState((current) => ({
      ...current,
      meals: {
        ...current.meals,
        [todayKey]: (current.meals[todayKey] ?? []).filter((meal) => meal.id !== mealId),
      },
    }));
  }

  function resetLocalState() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // In-memory reset still succeeds when browser storage is unavailable.
    }
    setState(createInitialPerformanceState());
    setResetArmed(false);
    setStorageRecovered(false);
  }

  return (
    <main data-personal-home data-personal-performance className={`${styles.root} hg-concierge-fade`}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Personal / performance</p>
          <h1>Return to form.</h1>
          <p className={styles.intro}>A twelve-week practice in current truth, calm progression, and the next useful action.</p>
        </div>
        <div className={styles.programMark} aria-label={isPrep ? `Prep, starts in ${position.startsInDays} days` : `Week ${position.week} of ${PERFORMANCE_PARAMETERS.durationWeeks}, ${position.phase}`}>
          <span className={isPrep ? styles.programMarkWord : undefined}>{isPrep ? "PREP" : String(position.week).padStart(2, "0")}</span>
          <small>{isPrep ? "starts Oct 5" : `of ${PERFORMANCE_PARAMETERS.durationWeeks}`}</small>
        </div>
      </header>

      {storageRecovered ? <p className={styles.recoveryNotice}>Stored local data was incompatible or malformed. Continuum opened a clean local state safely.</p> : null}

      <section className={styles.truthStrip} aria-label="Current program truth">
        <div><span>Current phase</span><strong>{isPrep ? "PREP · NOT STARTED" : position.status === "complete" ? "COMPLETE" : position.phase}</strong></div>
        <div><span>Body</span><strong>{currentWeight ? `${currentWeight.toFixed(1)} → ${PERFORMANCE_PARAMETERS.body.targetWeightLb} lb` : `Baseline Oct 5 · ${PERFORMANCE_PARAMETERS.body.startingWeightLb} lb planned`}</strong></div>
        <div><span>5K target</span><strong>{shortDate(PERFORMANCE_PARAMETERS.eventDate)} · Week 11</strong></div>
      </section>

      <section className={`${styles.today} ${todayLog.status === "completed" ? styles.todayComplete : ""}`}>
        <div className={styles.todayTopline}>
          <p className={styles.eyebrow}>Today · {today.day}</p>
          <span className={styles.status}>{todayState}</span>
        </div>
        <div className={styles.todayGrid}>
          <div>
            <p className={styles.duration}>{unusualSoreness ? "15–20 min" : today.duration}</p>
            <h2>{todayTitle}</h2>
            <p className={styles.todaySummary}>{todaySummary}</p>
          </div>
          <div className={styles.targets}>
            <div><span>Protein</span><strong>{proteinTarget} g</strong></div>
            <div><span>Calories</span><strong>{caloriesTarget.toLocaleString()}</strong></div>
          </div>
        </div>

        {isActive && !todayLog.status && today.title !== "Rest" ? (
          <fieldset className={styles.readiness}>
            <legend>Current readiness</legend>
            <button type="button" data-selected={todayLog.readiness === "ready" || undefined} onClick={() => updateDay((current) => ({ ...current, readiness: "ready" }))}>Ready</button>
            <button type="button" data-selected={todayLog.readiness === "sore" || undefined} onClick={() => updateDay((current) => ({ ...current, readiness: "sore" }))}>Unusually sore</button>
          </fieldset>
        ) : null}

        {isActive && todayLog.status !== "skipped" && !unusualSoreness && today.exercises.length > 0 ? (
          <div className={styles.exerciseList}>
            {today.exercises.map((exercise) => (
              <label key={exercise.name}>
                <span><strong>{exercise.name}</strong><small>{exercise.prescription}</small></span>
                <input
                  value={todayLog.exerciseNotes?.[exercise.name] ?? ""}
                  onChange={(event) => updateDay((current) => ({
                    ...current,
                    exerciseNotes: { ...current.exerciseNotes, [exercise.name]: event.target.value.slice(0, 240) },
                  }))}
                  placeholder="actual / note"
                  aria-label={`${exercise.name} performance`}
                />
              </label>
            ))}
          </div>
        ) : null}

        <div className={styles.recovery}><span>Recovery</span><p>{unusualSoreness ? "Easy movement only. No make-up volume and no loaded ruck today." : today.recovery}</p></div>
        {isActive && today.title !== "Rest" ? (
          <div className={styles.todayActions}>
            <button type="button" className={todayLog.status === "completed" ? styles.secondaryButton : styles.primaryButton} onClick={() => updateDay((current) => ({ ...current, status: current.status === "completed" ? undefined : "completed" }))}>
              {todayLog.status === "completed" ? "Return to planned" : "Complete today’s work"}
            </button>
            <button type="button" className={styles.secondaryButton} onClick={() => updateDay((current) => ({ ...current, status: current.status === "skipped" ? undefined : "skipped" }))}>
              {todayLog.status === "skipped" ? "Return to planned" : "Record skipped"}
            </button>
          </div>
        ) : null}
      </section>

      <div className={styles.book}>
        <details open>
          <summary><span>Body</span><small>trend, not noise</small></summary>
          <div className={styles.panel}>
            <div className={styles.bodyMeasure}>
              <div><span>Current</span><strong>{currentWeight ? `${currentWeight.toFixed(1)} lb` : "Not logged"}</strong></div>
              <div><span>Rolling trend</span><strong>{hasTrend ? `${rollingWeight.toFixed(1)} lb avg` : "Establishing"}</strong></div>
              <div><span>Waist</span><strong>{currentWaist ? `${currentWaist.toFixed(1)} in` : "Optional"}</strong></div>
            </div>
            <TrendChart entries={state.weights} />
            <div className={styles.targetLine}><span>Progress to {PERFORMANCE_PARAMETERS.body.targetWeightLb} lb</span><span>{hasTrend ? `${Math.round(clamp(bodyProgress))}%` : "after 3 entries"}</span></div>
            <ProgressBar value={bodyProgress} label="Progress toward bodyweight target from rolling trend" />
            {isPrep ? <p className={styles.empty}>Starting measurements become the Week 1 baseline on October 5. No pre-program trend is inferred.</p> : (
              <form className={styles.inlineForm} onSubmit={logWeight}>
                <label><span>Weight</span><input inputMode="decimal" type="number" step="0.1" min="100" max="400" value={weightInput} onChange={(event) => setWeightInput(event.target.value)} placeholder="lb" required /></label>
                <label><span>Waist · optional</span><input inputMode="decimal" type="number" step="0.1" min="20" max="80" value={waistInput} onChange={(event) => setWaistInput(event.target.value)} placeholder="in" /></label>
                <button type="submit">Log</button>
              </form>
            )}
          </div>
        </details>

        <details>
          <summary><span>Engine</span><small>December 5K</small></summary>
          <div className={styles.panel}>
            <div className={styles.currentTruthRow}><span>Current capability</span><strong>{currentCapability}</strong></div>
            <p className={styles.panelLead}>{isPrep ? "First progression · " : "Next progression · "}{saturday.title}</p>
            <p>{saturday.summary}</p>
            <p className={styles.quiet}>{shortDate(saturdayKey)} · {saturday.duration}. Early aerobic work favors the 20 lb ruck; the 90 lb ruck stays out of re-entry.</p>
            <div className={styles.historyBlock}>
              <span>Completed conditioning</span>
              {recentConditioning.length ? recentConditioning.map(([key]) => <p key={key}>{shortDate(key)} · {prescriptionForDate(key).title}</p>) : <p>No completed conditioning recorded.</p>}
            </div>
          </div>
        </details>

        <details>
          <summary><span>Strength</span><small>quality, then load</small></summary>
          <div className={styles.panel}>
            <p className={styles.panelLead}>{isPrep ? "Planned for Oct 5 · Foundation A" : `${today.domain === "strength" ? "Today" : "Weekly plan"} · repeatable strength`}</p>
            <p>Monday and Thursday use Foundation A; Tuesday uses Foundation B; Friday stays upper-body and trunk focused so Saturday’s progression is not compromised.</p>
            <div className={styles.historyBlock}>
              <span>Completed performance</span>
              {recentStrength.length ? recentStrength.map(([key, log]) => {
                const notes = Object.values(log.exerciseNotes ?? {}).filter(Boolean);
                return <p key={key}>{shortDate(key)} · {prescriptionForDate(key).title}{notes.length ? ` · ${notes.join(" / ")}` : " · completed"}</p>;
              }) : <p>No completed strength session recorded.</p>}
            </div>
          </div>
        </details>

        <details>
          <summary><span>Nutrition</span><small>simple and adjustable</small></summary>
          <div className={styles.panel}>
            <div className={styles.nutritionTotals}>
              <div><span>Calories</span><strong>{isPrep ? caloriesTarget.toLocaleString() : `${nutrition.calories.toLocaleString()} / ${caloriesTarget.toLocaleString()}`}</strong>{!isPrep ? <ProgressBar value={(nutrition.calories / caloriesTarget) * 100} label="Calories logged" /> : null}</div>
              <div><span>Protein</span><strong>{isPrep ? `${proteinTarget} g` : `${nutrition.protein} g / ${proteinTarget} g`}</strong>{!isPrep ? <ProgressBar value={(nutrition.protein / proteinTarget) * 100} label="Protein logged" /> : null}</div>
            </div>
            <p className={styles.quiet}>Initial working parameters, not universal truths: hold steady, then review against rolling weight trend, training performance, adherence, and recovery. No automatic adjustment is made.</p>
            {isPrep ? <p className={styles.empty}>Formal nutrition logging begins October 5. Prep can be as simple as choosing two repeatable high-protein meals.</p> : (
              <>
                <form className={styles.mealForm} onSubmit={logMeal}>
                  <label className={styles.mealName}><span>Meal</span><input value={mealName} onChange={(event) => setMealName(event.target.value)} placeholder="Chicken, rice, greens" required /></label>
                  <label><span>kcal</span><input inputMode="numeric" type="number" min="0" max="3000" value={mealCalories} onChange={(event) => setMealCalories(event.target.value)} placeholder="650" required /></label>
                  <label><span>protein</span><input inputMode="numeric" type="number" min="0" max="250" value={mealProtein} onChange={(event) => setMealProtein(event.target.value)} placeholder="55 g" required /></label>
                  <button type="submit">Add</button>
                </form>
                {nutrition.calories > caloriesTarget ? <p className={styles.empty}>Today is above the working target. Record it, then return to the normal plan—no punishment exercise or compensatory restriction.</p> : null}
                {todayMeals.length ? <ul className={styles.meals}>{todayMeals.map((meal) => <li key={meal.id}><span>{meal.name}</span><small>{meal.calories} kcal · {meal.protein} g <button type="button" onClick={() => removeMeal(meal.id)} aria-label={`Remove ${meal.name}`}>Remove</button></small></li>)}</ul> : <p className={styles.empty}>Nothing logged yet. Logging creates signal; it is not a score.</p>}
              </>
            )}
          </div>
        </details>

        <details>
          <summary><span>Consistency</span><small>return, don’t repay</small></summary>
          <div className={styles.panel}>
            {isPrep ? (
              <div className={styles.consistencyHeadline}><strong>Oct 5</strong><span>Week 1 begins. Prep is not part of adherence.</span></div>
            ) : (
              <>
                <div className={styles.consistencyHeadline}><strong>{completedCount}</strong><span>completed this week · {skippedCount} skipped · {unrecordedCount} not recorded</span></div>
                <ol className={styles.weekRail} aria-label="This week">
                  {weekKeys.map((key) => {
                    const plan = prescriptionForDate(key);
                    const status = state.days[key]?.status;
                    const rest = plan.title === "Rest";
                    const future = key > todayKey;
                    const label = rest ? "rest" : status ?? (future || key === todayKey ? "planned" : "not recorded");
                    return <li key={key} title={`${plan.day}: ${label}`} data-complete={status === "completed" || undefined} data-skipped={status === "skipped" || undefined} data-future={future || undefined} data-today={key === todayKey || undefined}><span>{dayLetter(key)}</span><i aria-hidden>{rest ? "—" : status === "completed" ? "✓" : status === "skipped" ? "○" : future || key === todayKey ? "·" : "?"}</i></li>;
                  })}
                </ol>
                <p className={styles.railLegend}>✓ completed &nbsp; ○ skipped &nbsp; · planned &nbsp; ? not recorded</p>
              </>
            )}
            <p className={styles.quiet}>No record is not a failure. A skipped session stays history, not debt; continue with the next scheduled day rather than combining workouts.</p>
            <div className={styles.localDataControl}>
              <span>Stored only in this browser</span>
              {resetArmed ? <div><button type="button" onClick={resetLocalState}>Confirm reset</button><button type="button" onClick={() => setResetArmed(false)}>Cancel</button></div> : <button type="button" onClick={() => setResetArmed(true)}>Reset local data</button>}
            </div>
          </div>
        </details>
      </div>
    </main>
  );
}
