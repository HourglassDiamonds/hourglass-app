/**
 * Internal Concierge Project Lifecycle surface.
 * App Router code must import the Supabase adapter from project-spec/server.
 */

export {
  CUSTOM_LIFECYCLE_STAGE_LABELS,
  CUSTOM_LIFECYCLE_STAGES,
  LIFECYCLE_KINDS,
  PROJECT_LIFECYCLE_CLEAR_LABEL,
  PROJECT_LIFECYCLE_CURRENT_LABEL,
  PROJECT_LIFECYCLE_EVENT_LIMIT,
  PROJECT_LIFECYCLE_HISTORY_TITLE,
  PROJECT_LIFECYCLE_NOT_SET_LABEL,
  PROJECT_LIFECYCLE_SECTION_TITLE,
  REPAIR_LIFECYCLE_STAGE_LABELS,
  REPAIR_LIFECYCLE_STAGES,
  isCustomLifecycleStage,
  isLifecycleKind,
  isRepairLifecycleStage,
  isStageAllowedForKind,
  lifecycleStageLabel,
  lifecycleTransitionLabel,
  parseLifecycleStageInput,
  stagesForLifecycleKind,
} from "../project-lifecycle";
export type {
  CustomLifecycleStage,
  LifecycleKind,
  ParseLifecycleStageResult,
  ProjectLifecycleStage,
  RepairLifecycleStage,
} from "../project-lifecycle";
export { setProjectLifecycle } from "./set";
export type {
  SetProjectLifecycleInput,
  SetProjectLifecycleResult,
} from "./set";
export { activeLifecycleView, compactLifecycleView } from "./view";
export type { ProjectLifecycleView } from "./view";
