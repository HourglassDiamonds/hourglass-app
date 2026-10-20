export type TrainingMode = "tonal" | "peloton" | "bodyweight" | "ruck" | "run" | "recovery" | "combination";
export type TrainingDomain = "strength" | "engine" | "recovery";
export type WorkoutStatus = "planned" | "unresolved" | "in_progress" | "completed" | "deferred" | "skipped" | "replaced";
export type Provenance = "program" | "user" | "sterling" | "manual_recovery" | "ai_meal_estimate" | "user_confirmed";
export type PerformanceSourceType = "text" | "meal_photo" | "nutrition_label" | "activity_screenshot" | "recovery_screenshot" | "tonal_program_screenshot";
export type ProposalConfidence = "low" | "medium" | "high";
export type EvidenceKind = "observed" | "estimated" | "user_supplied";
export type TonalProgramId = "fit-over-40" | "next-level-strength" | "12-weeks-to-jacked";

export type SourceReference = {
  name: string;
  type: string;
  size: number;
  storagePath?: string;
};

export type AuditFact = {
  field: string;
  from: unknown;
  to: unknown;
};

export type ExercisePrescription = {
  id: string;
  name: string;
  equipment: string;
  sets: number;
  targetReps: [number, number];
  targetLoad?: number;
  notes: string;
  progressionContext?: string;
  previous?: { load?: number; reps: number[] };
};

export type WorkoutPrescription = {
  id: string;
  name: string;
  domain: TrainingDomain;
  mode: TrainingMode;
  intent: "easy" | "aerobic" | "moderate" | "hard";
  durationMinutes: number;
  notes: string;
  trainingBlock: string;
  lowerBodyLoad: "none" | "low" | "moderate" | "high";
  exercises: ExercisePrescription[];
  tonalProgramId?: TonalProgramId;
  tonalSessionOrder?: number;
  alternative?: WorkoutAlternative;
};

export type WorkoutAlternative = {
  name: string;
  domain: TrainingDomain;
  mode: TrainingMode;
  intent: "easy" | "aerobic" | "moderate" | "hard";
  durationMinutes: number;
  notes: string;
  lowerBodyLoad: "none" | "low" | "moderate" | "high";
  exercises: ExercisePrescription[];
};

export type WorkoutHistoryEvent = {
  at: string;
  action: "planned" | "started" | "modified" | "deferred" | "skipped" | "completed" | "rolled_unresolved" | "reflowed" | "replaced";
  actor: "program" | "user" | "sterling" | "system";
  note: string;
};

export type ScheduledWorkout = {
  id: string;
  date: string;
  originalDate: string;
  status: WorkoutStatus;
  prescription: WorkoutPrescription;
  provenance: Provenance[];
  history: WorkoutHistoryEvent[];
  deferredTo?: string;
  replacesWorkoutId?: string;
};

export type PerformedSet = {
  id: string;
  exerciseId: string;
  setNumber: number;
  load?: number;
  reps: number;
  rir?: number;
  completed: boolean;
  skipped: boolean;
  pain: boolean;
};

export type WorkoutSession = {
  id: string;
  scheduledWorkoutId: string;
  startedAt: string;
  completedAt?: string;
  perceivedEffort?: number;
  notes?: string;
  sets: PerformedSet[];
};

export type MetricSource = "measured" | "manual" | "subjective" | "inferred" | "observed";
export type RecoveryMetric<T> = { value: T; source: MetricSource };
export type RecoveryEntry = {
  id: string;
  date: string;
  recordedAt: string;
  sleepHours?: RecoveryMetric<number>;
  sleepQuality?: RecoveryMetric<number>;
  sleepPerformance?: RecoveryMetric<number>;
  recoveryScore?: RecoveryMetric<number>;
  strain?: RecoveryMetric<number>;
  restingHeartRate?: RecoveryMetric<number>;
  hrvMs?: RecoveryMetric<number>;
  bodyweightLb?: RecoveryMetric<number>;
  fatigue?: RecoveryMetric<"low" | "moderate" | "high">;
  soreness?: RecoveryMetric<"none" | "mild" | "moderate" | "high">;
  pain?: RecoveryMetric<"none" | "mild" | "moderate" | "high">;
  notes?: string;
  rawNarrative?: string;
  sourceType?: "recovery_screenshot";
  source?: SourceReference;
  sterlingProposal?: RecoveryIngestionProposal;
  assumptions?: string[];
  corrections?: AuditFact[];
  idempotencyKey?: string;
  provenance: Provenance[];
};

export type MealItem = {
  id: string;
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: ProposalConfidence;
};

export type MealEstimate = {
  id: string;
  estimatedAt: string;
  items: MealItem[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: ProposalConfidence;
  clarification?: string;
  caveat: string;
  assumptions?: string[];
  model: string;
};

export type MealLog = {
  id: string;
  timestamp: string;
  occurredOn?: string;
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
  items: MealItem[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  photo?: SourceReference;
  sourceType?: PerformanceSourceType;
  rawInput?: string;
  aiEstimate?: MealEstimate;
  sterlingProposal?: NaturalIngestionProposal;
  assumptions?: string[];
  corrections?: AuditFact[];
  idempotencyKey?: string;
  frequentMealId?: string;
  provenance: Provenance[];
};

export type ActivityMetric<T> = {
  value: T;
  evidence: EvidenceKind;
};

export type ActivityFacts = {
  activityType: string;
  workoutTitle?: string;
  trainer?: string;
  tonalProgramTitle?: string;
  tonalSessionOrder?: ActivityMetric<number>;
  durationMinutes?: ActivityMetric<number>;
  distanceMiles?: ActivityMetric<number>;
  pace?: ActivityMetric<string>;
  averageSpeedMph?: ActivityMetric<number>;
  averageHeartRate?: ActivityMetric<number>;
  maxHeartRate?: ActivityMetric<number>;
  elevationFeet?: ActivityMetric<number>;
  reportedCalories?: ActivityMetric<number>;
  whoopStrain?: ActivityMetric<number>;
  steps?: ActivityMetric<number>;
  ruckWeightLb?: ActivityMetric<number>;
  totalVolumeLb?: ActivityMetric<number>;
  maxResistanceLb?: ActivityMetric<number>;
  completedSets?: ActivityMetric<number>;
  completedReps?: ActivityMetric<number>;
  tonalMovements?: TonalProgramMovement[];
  notes?: string;
};

export type VisibleActivityDate = {
  month: number;
  day: number;
  year?: number;
  evidence: "observed";
};

export type DailyActivitySummary = {
  whoopStrain?: ActivityMetric<number>;
  notes?: string;
};

export type ActivityLog = {
  id: string;
  timestamp: string;
  occurredOn: string;
  facts: ActivityFacts;
  rawInput?: string;
  sourceType: PerformanceSourceType;
  source?: SourceReference;
  sterlingProposal?: NaturalIngestionProposal;
  assumptions: string[];
  corrections: AuditFact[];
  guidance: string;
  idempotencyKey: string;
  scheduledWorkoutId?: string;
  provenance: Provenance[];
};

type ProposalBase = {
  id: string;
  proposedAt: string;
  sourceType: PerformanceSourceType;
  rawInput?: string;
  confidence: ProposalConfidence;
  assumptions: string[];
  summary: string;
  model: string;
  sourceDigest?: string;
  normalizedSourceDigest?: string;
};

export type MealIngestionProposal = ProposalBase & {
  kind: "meal";
  meal: MealEstimate;
};

export type ActivityIngestionProposal = ProposalBase & {
  kind: "activity";
  activity: ActivityFacts;
  activities?: ActivityFacts[];
  sourceDate?: VisibleActivityDate;
  dailySummary?: DailyActivitySummary;
  guidance: string;
};

export type RecoveryProposalFacts = {
  recoveryScore?: RecoveryMetric<number>;
  hrvMs?: RecoveryMetric<number>;
  restingHeartRate?: RecoveryMetric<number>;
  sleepHours?: RecoveryMetric<number>;
  sleepPerformance?: RecoveryMetric<number>;
  strain?: RecoveryMetric<number>;
};

export type RecoveryIngestionProposal = ProposalBase & {
  kind: "recovery";
  recovery: RecoveryProposalFacts;
  sourceDate?: VisibleActivityDate;
  guidance: string;
};

export type NaturalIngestionProposal = MealIngestionProposal | ActivityIngestionProposal | RecoveryIngestionProposal;

export type FrequentMeal = {
  id: string;
  signature: string;
  name: string;
  mealType?: MealLog["mealType"];
  items: MealItem[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  pinned: boolean;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProgressionProposal = {
  id: string;
  exerciseId: string;
  action: "increase" | "hold" | "reduce" | "regress";
  proposedLoad?: number;
  reason: string;
  status: "pending" | "accepted" | "edited" | "rejected";
};

export type TonalProgramSource = {
  kind: "tonal_app_screenshot" | "tonal_link" | "founder_confirmed";
  reference: string;
  digest?: string;
  file?: SourceReference;
  reviewedAt: string;
};

export type TonalProgramSession = {
  order: number;
  title?: string;
  movements: TonalProgramMovement[];
  plannedAt?: string;
  plannedSource?: TonalProgramSource;
  scheduledWorkoutId?: string;
  completedActivityId?: string;
};

export type TonalProgramMovement = {
  name: string;
  sets?: number;
  reps?: string;
  prescribedResistance?: string;
  details?: string;
};

export type TonalProgramEnrollment = {
  programId: TonalProgramId;
  weeklyFrequency: 2 | 3 | 4;
  status: "setup" | "active" | "completed" | "paused";
  sessions: TonalProgramSession[];
  sources: TonalProgramSource[];
  founderVerifiedAt?: string;
  startedOn?: string;
  completedAt?: string;
};

export type TonalProgramTransition = {
  from: TonalProgramId;
  to: TonalProgramId;
  reviewedAt: string;
  approvedAt?: string;
  readiness: {
    adherence: string;
    strengthProgression: string;
    recoveryAndFatigue: string;
    runningProgress: string;
    availableTrainingTime: string;
  };
};

export type TonalProgramPlan = {
  progression: TonalProgramId[];
  selectedProgramId: TonalProgramId;
  enrollment: TonalProgramEnrollment;
  completedEnrollments: TonalProgramEnrollment[];
  transitions: TonalProgramTransition[];
};

export type SterlingProposal = {
  id: string;
  command: string;
  createdAt: string;
  summary: string;
  recovery?: Omit<RecoveryEntry, "id" | "recordedAt">;
  nextSchedule: ScheduledWorkout[];
  affectedWorkoutIds: string[];
  displacedWorkouts: Array<{
    workoutId: string;
    name: string;
    fromDate: string;
    toDate: string;
  }>;
  warnings: string[];
  sourceWorkoutId?: string;
  targetDate?: string;
  confidence?: ProposalConfidence;
};

export type PersonalState = {
  version: 3;
  program: {
    status: "setup" | "active";
    anchorVersion: 1;
    anchorDate?: string;
    activatedAt?: string;
    legacyAnchorDate: string;
  };
  tonal: TonalProgramPlan;
  schedule: ScheduledWorkout[];
  sessions: WorkoutSession[];
  recoveryEntries: RecoveryEntry[];
  meals: MealLog[];
  activities: ActivityLog[];
  frequentMeals: FrequentMeal[];
  progressionProposals: ProgressionProposal[];
  nutritionTargets: { calories: number; protein: number; carbs: number; fat: number };
  nutritionTargetHistory?: Array<{
    effectiveOn: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>;
};
