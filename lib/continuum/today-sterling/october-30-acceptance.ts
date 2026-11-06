import type {
  SterlingAttentionPriority,
  SterlingFounderDisposition,
  SterlingRelationshipRole,
  SterlingResponsibleParty,
} from "./types";

export type October30CaseId =
  | "daniel-iles" | "melissa-ribeiro" | "reception-ballantyne" | "madi-rutledge" | "christie-jean-jones"
  | "audrey" | "morgan" | "ty-sheffield" | "james" | "sarah"
  | "zane" | "nate-p" | "abbey" | "jp"
  | "dylan" | "f-grant" | "tim-jenn" | "j-pennock" | "duane"
  | "justin-ckezepis" | "southpark-editor";

export type October30Expectation = {
  id: October30CaseId;
  authority: "founder" | "evidence_required";
  disposition: SterlingFounderDisposition | "investigate";
  lifecycleStage?: "cad" | "production" | "completed";
  waitingOn?: SterlingResponsibleParty;
  attentionPriority?: SterlingAttentionPriority;
  relationshipRole?: SterlingRelationshipRole;
  identityRule?: "exact_identity_required" | "distinct_from_j_pennock";
};

/** Acceptance data only. Runtime reasoning must never branch on these names. */
export const OCTOBER_30_FOUNDER_EXPECTATIONS: readonly October30Expectation[] = [
  { id: "daniel-iles", authority: "founder", disposition: "rejected_junk", attentionPriority: "no_attention" },
  { id: "melissa-ribeiro", authority: "founder", disposition: "solicitation", attentionPriority: "no_attention", relationshipRole: "salesperson_solicitation" },
  { id: "reception-ballantyne", authority: "founder", disposition: "operational_non_client", attentionPriority: "no_attention", relationshipRole: "business_contact" },
  { id: "madi-rutledge", authority: "founder", disposition: "declined", attentionPriority: "no_attention" },
  { id: "christie-jean-jones", authority: "founder", disposition: "dormant", attentionPriority: "no_attention" },
  { id: "audrey", authority: "founder", disposition: "active", lifecycleStage: "cad", waitingOn: "client", attentionPriority: "monitor" },
  { id: "morgan", authority: "founder", disposition: "active", lifecycleStage: "cad", waitingOn: "vendor_shop", attentionPriority: "monitor" },
  { id: "ty-sheffield", authority: "founder", disposition: "active", lifecycleStage: "cad", attentionPriority: "monitor" },
  { id: "james", authority: "founder", disposition: "active", lifecycleStage: "cad", attentionPriority: "monitor", identityRule: "exact_identity_required" },
  { id: "sarah", authority: "founder", disposition: "active", lifecycleStage: "cad", attentionPriority: "monitor" },
  { id: "zane", authority: "founder", disposition: "active", lifecycleStage: "production", attentionPriority: "monitor" },
  { id: "nate-p", authority: "founder", disposition: "active", lifecycleStage: "production", attentionPriority: "monitor" },
  { id: "abbey", authority: "founder", disposition: "active", lifecycleStage: "production", attentionPriority: "monitor" },
  { id: "jp", authority: "founder", disposition: "active", lifecycleStage: "production", attentionPriority: "monitor", identityRule: "distinct_from_j_pennock" },
  { id: "dylan", authority: "founder", disposition: "completed", lifecycleStage: "completed", attentionPriority: "no_attention" },
  { id: "f-grant", authority: "founder", disposition: "completed", lifecycleStage: "completed", attentionPriority: "no_attention" },
  { id: "tim-jenn", authority: "founder", disposition: "completed", lifecycleStage: "completed", attentionPriority: "no_attention" },
  { id: "j-pennock", authority: "founder", disposition: "completed", lifecycleStage: "completed", attentionPriority: "no_attention" },
  { id: "duane", authority: "founder", disposition: "completed", lifecycleStage: "completed", attentionPriority: "no_attention" },
  { id: "justin-ckezepis", authority: "evidence_required", disposition: "investigate", identityRule: "exact_identity_required" },
  { id: "southpark-editor", authority: "founder", disposition: "operational_non_client", relationshipRole: "business_contact", attentionPriority: "no_attention" },
] as const;

export type October30Observation = {
  id: October30CaseId;
  found: boolean;
  identityVerified: boolean;
  canonicalIdentity: string | null;
  disposition: SterlingFounderDisposition | "investigate";
  lifecycleStage: string | null;
  waitingOn: SterlingResponsibleParty | null;
  attentionPriority: SterlingAttentionPriority;
  relationshipRole: SterlingRelationshipRole | null;
};

export type October30AcceptanceResult = {
  passed: boolean;
  cases: readonly {
    id: October30CaseId;
    status: "pass" | "fail" | "unverified";
    failures: readonly string[];
  }[];
};

export function evaluateOctober30Acceptance(
  observations: readonly October30Observation[],
): October30AcceptanceResult {
  const byId = new Map(observations.map((row) => [row.id, row] as const));
  const pennockIdentity = byId.get("j-pennock")?.canonicalIdentity ?? null;
  const cases = OCTOBER_30_FOUNDER_EXPECTATIONS.map((expected) => {
    const observed = byId.get(expected.id);
    if (!observed?.found) return { id: expected.id, status: "unverified" as const, failures: ["missing-observation"] };
    const failures: string[] = [];
    if (observed.disposition !== expected.disposition) failures.push("wrong-disposition");
    if (expected.lifecycleStage && observed.lifecycleStage !== expected.lifecycleStage) failures.push("wrong-lifecycle-stage");
    if (expected.waitingOn && observed.waitingOn !== expected.waitingOn) failures.push("wrong-waiting-owner");
    if (expected.attentionPriority && observed.attentionPriority !== expected.attentionPriority) failures.push("wrong-attention-priority");
    if (expected.relationshipRole && observed.relationshipRole !== expected.relationshipRole) failures.push("wrong-relationship-role");
    if (expected.identityRule && !observed.identityVerified) failures.push("identity-unverified");
    if (expected.identityRule === "distinct_from_j_pennock" &&
        observed.canonicalIdentity && pennockIdentity && observed.canonicalIdentity === pennockIdentity) {
      failures.push("jp-j-pennock-identity-collision");
    }
    return {
      id: expected.id,
      status: failures.length === 0 ? "pass" as const : "fail" as const,
      failures,
    };
  });
  return { passed: cases.every((row) => row.status === "pass"), cases };
}
