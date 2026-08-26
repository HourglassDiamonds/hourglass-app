export const COS_PERSISTENCE_CODES = [
  "unavailable",
  "entity-not-found",
  "entity-kind-invalid",
] as const;

export type CosPersistenceCode = (typeof COS_PERSISTENCE_CODES)[number];

export class ChiefOfStaffPersistenceError extends Error {
  readonly code: CosPersistenceCode;

  constructor(code: CosPersistenceCode, message?: string) {
    super(message ?? code);
    this.name = "ChiefOfStaffPersistenceError";
    this.code = code;
  }
}

export function isChiefOfStaffPersistenceError(
  value: unknown,
): value is ChiefOfStaffPersistenceError {
  return value instanceof ChiefOfStaffPersistenceError;
}
