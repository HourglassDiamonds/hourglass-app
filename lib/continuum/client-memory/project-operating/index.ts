/**
 * Internal Concierge Custom / Repair operating-detail surface.
 * App Router code must import the Supabase adapter from project-spec/server.
 */

export {
  CUSTOM_OPERATING_DETAIL_FIELDS,
  CUSTOM_OPERATING_LAYER_TITLE,
  OPERATING_DETAIL_FIELDS,
  OPERATING_DETAIL_FIELD_LABELS,
  OPERATING_DETAIL_MAX_LENGTH,
  OPERATING_DETAIL_NOT_SET,
  REPAIR_OPERATING_DETAIL_FIELDS,
  REPAIR_OPERATING_LAYER_TITLE,
  currentCustomFieldValue,
  currentRepairFieldValue,
  emptyCustomDetails,
  emptyRepairDetails,
  isCustomOperatingDetailField,
  isOperatingDetailField,
  isRepairOperatingDetailField,
  operatingLayerRouteForField,
  requiredKindForOperatingField,
} from "./fields";
export type {
  CustomOperatingDetailField,
  OperatingDetailField,
  RepairOperatingDetailField,
} from "./fields";
export { validateOperatingDetailCorrection } from "./validate";
export { correctProjectOperatingDetail } from "./correct";
export type {
  CorrectOperatingDetailInput,
  CorrectOperatingDetailResult,
} from "./correct";
export { activeOperatingLayer } from "./layer";
export type { ProjectOperatingLayer } from "./layer";
