/**
 * Continuum command-center home model.
 * Dashboard is a consumer — do not put cross-domain reasoning here.
 */

export type GreetingPeriod = "morning" | "afternoon" | "evening";

export type ChiefOfStaffItem = {
  id: string;
  title: string;
  summary: string;
  href?: string;
};

export type ContinuumHomeModel = {
  greeting: {
    period: GreetingPeriod;
    displayName: "Justin";
  };
  chiefOfStaff: {
    status: "quiet";
    items: ChiefOfStaffItem[];
  };
};
