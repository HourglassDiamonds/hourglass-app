import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length < 8_192;
}

export function parseRegistrationResponse(
  value: unknown,
): RegistrationResponseJSON | null {
  if (!isRecord(value)) return null;
  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.rawId)) return null;
  if (value.type !== "public-key") return null;
  if (!isRecord(value.response)) return null;
  if (
    !isNonEmptyString(value.response.clientDataJSON) ||
    !isNonEmptyString(value.response.attestationObject)
  ) {
    return null;
  }
  return value as unknown as RegistrationResponseJSON;
}

export function parseAuthenticationResponse(
  value: unknown,
): AuthenticationResponseJSON | null {
  if (!isRecord(value)) return null;
  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.rawId)) return null;
  if (value.type !== "public-key") return null;
  if (!isRecord(value.response)) return null;
  if (
    !isNonEmptyString(value.response.clientDataJSON) ||
    !isNonEmptyString(value.response.authenticatorData) ||
    !isNonEmptyString(value.response.signature)
  ) {
    return null;
  }
  return value as unknown as AuthenticationResponseJSON;
}
