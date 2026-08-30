/**
 * Synthetic Cohort 1 evidence-synthesis fixtures matching live stored/recovered
 * shapes. Not production Project IDs. Not live mailbox payloads.
 * automaticApply: false.
 */

export const COHORT_SYNTHESIS_PROJECT_A_ID =
  "aaaaaaaa-1111-4111-8111-aaaaaaaaaaa1" as const;
export const COHORT_SYNTHESIS_PROJECT_B_ID =
  "bbbbbbbb-2222-4222-8222-bbbbbbbbbbb2" as const;
export const COHORT_SYNTHESIS_PROJECT_C_ID =
  "cccccccc-3333-4333-8333-ccccccccccc3" as const;
export const COHORT_SYNTHESIS_PROJECT_D_ID =
  "dddddddd-4444-4444-8444-ddddddddddd4" as const;
export const COHORT_SYNTHESIS_PROJECT_E_ID =
  "eeeeeeee-5555-4555-8555-eeeeeeeeeee5" as const;

export const COHORT_SYNTHESIS_PROJECT_A = {
  cad: "C010657",
  order: "SP13040",
  fingerSize: "~11",
  storedThreadId: "thread-cohort-a",
  recoveredSubject: "RE: HGD - Chicken ring (his)-C010657-SP13040",
} as const;

export const COHORT_SYNTHESIS_PROJECT_B = {
  cad: "C015067",
  order: "SP12318 / SP12882",
  fingerSize: "69",
  storedThreadId: "thread-cohort-b",
  recoveredSubjects: [
    "RE: HGD - Henry-C015067-SP6934",
    "RE: HGD - Henry-C015067-SP12882",
  ],
  recoveredArtifact: "NL-H017-C015067-SP12318.xlsx",
  additionalRecoveredOrder: "SP6934",
} as const;

export const COHORT_SYNTHESIS_PROJECT_C = {
  cad: "C025216",
  order: "SP12883",
  fingerSize: "5.25",
  storedThreadId: "thread-cohort-c",
  recoveredSubject: "RE: HGD - Kaleb H.-C025216-SP12883",
  recoveredArtifact: "NL-H017-C025216-SP12883.pdf",
} as const;

export const COHORT_SYNTHESIS_PROJECT_D = {
  cad: "C007157",
  order: "SP3066",
  fingerSize: "212",
  storedThreadId: "thread-cohort-d",
} as const;

export const COHORT_SYNTHESIS_PROJECT_E = {
  cad: "C007040",
  order: "SP2976",
  fingerSize: "70",
  storedThreadId: "thread-cohort-e",
} as const;
