import { conciergeForegroundModel } from "@/lib/continuum/concierge-sol/models";

export type SterlingModelRoute = {
  provider: "openai";
  model: string;
  configuration: string;
};

/** Sterling has its own configuration seam; Concierge policy is only the default. */
export function sterlingModelRoute(modelOverride?: string | null): SterlingModelRoute {
  const requested = modelOverride?.trim();
  return {
    provider: "openai",
    model: requested || conciergeForegroundModel(),
    configuration: requested ? "sterling-override" : "concierge-default",
  };
}
