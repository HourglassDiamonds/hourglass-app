/**
 * First-party analytics consent — visitor choice for Google Analytics only.
 *
 * Attribution sessionStorage is separate and continues on public routes.
 * Necessary site functionality does not depend on this choice.
 */

export const ANALYTICS_CONSENT_STORAGE_KEY = "hg-analytics-consent";
export const ANALYTICS_CONSENT_CHANGE_EVENT = "hg-analytics-consent-change";
export const ANALYTICS_CONSENT_MANAGE_EVENT = "hg-analytics-consent-manage";

export type AnalyticsConsentChoice = "granted" | "denied";
export type AnalyticsConsentState = AnalyticsConsentChoice | "undecided";

let memoryFallback: AnalyticsConsentState = "undecided";

function isChoice(value: string | null): value is AnalyticsConsentChoice {
  return value === "granted" || value === "denied";
}

export function readAnalyticsConsent(): AnalyticsConsentState {
  if (typeof window === "undefined") return "undecided";
  try {
    const stored = window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
    if (isChoice(stored)) return stored;
  } catch {
    /* private mode / blocked storage */
  }
  return memoryFallback;
}

function emitConsentEvent(name: string): void {
  if (typeof window === "undefined") return;
  if (typeof window.dispatchEvent !== "function") return;
  window.dispatchEvent(new Event(name));
}

export function writeAnalyticsConsent(choice: AnalyticsConsentChoice): void {
  memoryFallback = choice;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, choice);
  } catch {
    /* choice still lives in memory for this tab */
  }
  emitConsentEvent(ANALYTICS_CONSENT_CHANGE_EVENT);
}

export function resetAnalyticsConsent(): void {
  memoryFallback = "undecided";
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ANALYTICS_CONSENT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  emitConsentEvent(ANALYTICS_CONSENT_CHANGE_EVENT);
}

export function requestAnalyticsConsentManager(): void {
  emitConsentEvent(ANALYTICS_CONSENT_MANAGE_EVENT);
}

export function subscribeAnalyticsConsent(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onChange = () => onStoreChange();
  window.addEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Test helper — clears memory fallback without requiring window. */
export function resetAnalyticsConsentMemoryForTests(): void {
  memoryFallback = "undecided";
}
