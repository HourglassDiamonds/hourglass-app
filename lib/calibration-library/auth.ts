import {
  verifyCronQuerySecret,
  verifyCronRequest,
} from "@/lib/intelligence/cron-auth";

/** Internal calibration routes — dev open; production requires CRON_SECRET. */
export function verifyCalibrationAccess(request: Request): boolean {
  if (process.env.NODE_ENV === "development") return true;
  return verifyCronRequest(request) || verifyCronQuerySecret(request);
}
