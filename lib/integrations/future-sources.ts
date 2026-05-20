/** V1 stubs — wire Search Console, GBP, and HubSpot in a later pass. */

export type FutureSourceStatus = "not_configured";

export async function fetchSearchConsoleWeekly(): Promise<{
  status: FutureSourceStatus;
}> {
  return { status: "not_configured" };
}

export async function fetchGoogleBusinessProfileWeekly(): Promise<{
  status: FutureSourceStatus;
}> {
  return { status: "not_configured" };
}

export async function fetchHubSpotWeekly(): Promise<{
  status: FutureSourceStatus;
}> {
  return { status: "not_configured" };
}
