export const ATTENTION_CREATION_PREREQUISITES = [
  "projectless-atomic-migration",
  "attention-migration",
  "attention-aware-readers-writers",
  "today-capture-phase-2",
] as const;

export type AttentionCreationReadiness = {
  projectlessAtomicMigration: boolean;
  attentionMigration: boolean;
  attentionAwareReadersWriters: boolean;
  todayCapturePhase2: boolean;
};

export function attentionCreationEnabled(readiness: AttentionCreationReadiness): boolean {
  return readiness.projectlessAtomicMigration && readiness.attentionMigration &&
    readiness.attentionAwareReadersWriters && readiness.todayCapturePhase2;
}

/** Phase 1 production boundary. Phase 2 must replace this with verified deployment capability. */
export const PHASE_1_ATTENTION_CREATION_ENABLED = false;
