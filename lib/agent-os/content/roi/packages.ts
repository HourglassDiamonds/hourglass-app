/**
 * Cluster consolidation + editorial package construction for Content ROI.
 */

import { GAP_CLUSTER_DEFINITIONS } from "../../search/fan-out/clusters";
import { normalizeText } from "../../search/fan-out/normalize";
import type { FanOutOpportunity } from "../../search/fan-out/types";
import {
  RESERVED_CONVERSATION_CYCLES,
} from "./reserved-sequence";
import {
  LOW_ROI_UNCOVERED_THRESHOLD,
  MAX_BACKLOG_ELIGIBLE_PACKAGES,
  MAX_FOUNDER_FACING_CONTENT_ROI,
  MIN_CONVERSATION_DEPTH,
  MIN_TASTE_ASSIGNMENT,
} from "./weights";
import type {
  ContentRoiBacklogCandidate,
  ContentRoiEditorialPackage,
  ContentRoiPrimaryFormat,
  ContentRoiQuestionAssessment,
  ContentRoiSequenceSlot,
  ContentRoiTopicKind,
} from "./types";

function slugify(s: string): string {
  return normalizeText(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
}

function effortFromScores(
  a: ContentRoiQuestionAssessment,
): "low" | "medium" | "high" {
  const eff = a.scores.dimensions.productionEfficiency;
  if (eff >= 72) return "low";
  if (eff >= 52) return "medium";
  return "high";
}

function balanceTagFor(
  pkg: ContentRoiEditorialPackage,
): ContentRoiSequenceSlot["balanceTag"] {
  if (pkg.gapClusterId === "decision-confidence") return "emotional-decision";
  if (pkg.gapClusterId === "post-contact-concierge") return "local-concierge";
  if (pkg.gapClusterId === "ownership-care-maintenance") return "post-purchase";
  if (pkg.primaryFormat === "a-matter-of-taste") return "humor-commentary";
  if (pkg.primaryFormat === "post-purchase-guide") return "post-purchase";
  if (pkg.primaryFormat === "local-landing-enhancement") return "local-concierge";
  if (pkg.primaryFormat === "concierge-explainer") return "local-concierge";
  if (
    pkg.queryFamilies.some((f) =>
      ["cut-and-sparkle", "diamond-quality", "shapes-and-appearance"].includes(f),
    )
  ) {
    return "diamond-expertise";
  }
  if (
    pkg.queryFamilies.some((f) =>
      ["pricing-and-budgeting", "jeweler-comparison", "buying-process-anxiety"].includes(
        f,
      ),
    )
  ) {
    return "practical-buying";
  }
  if (
    pkg.queryFamilies.some((f) =>
      ["luxury-and-private-client", "trust-ethics-credibility"].includes(f),
    )
  ) {
    return "brand-worldview";
  }
  return "emotional-decision";
}

function buildPackageFromMembers(
  id: string,
  workingTitle: string,
  members: ContentRoiQuestionAssessment[],
  topicKind: ContentRoiTopicKind,
  primaryFormat: ContentRoiPrimaryFormat,
  gapClusterId: string | null,
  reserved: { position: number } | null,
): ContentRoiEditorialPackage {
  const ranked = [...members].sort(
    (a, b) => b.scores.overall - a.scores.overall,
  );
  const lead = ranked[0]!;
  const supportingFormats = [
    ...new Set(ranked.flatMap((m) => m.supportingFormats)),
  ].filter((f) => f !== primaryFormat);
  const inappropriate = [
    ...new Set(ranked.flatMap((m) => m.inappropriateFormats)),
  ];

  const tasteOk =
    lead.scores.dimensions.tastePotential >= MIN_TASTE_ASSIGNMENT &&
    !inappropriate.includes("a-matter-of-taste");

  const angles = ranked
    .slice(0, 7)
    .map((m) => m.canonicalQuestion);

  const hooks = ranked.slice(0, 5).map((m) => {
    const q = m.canonicalQuestion;
    if (/budget|spend|price/i.test(q)) return "Everyone starts with a number — Justin starts with what you’ll actually see.";
    if (/online|local|jeweler/i.test(q)) return "The risky part isn’t the diamond — it’s buying without judgment.";
    if (/cut|certificate/i.test(q)) return "Two diamonds can share a grade and look nothing alike.";
    if (/care|clean|prong/i.test(q)) return "The proposal isn’t the finish line for the ring.";
    if (/concierge|contact|private/i.test(q)) return "What happens after you reach out should feel calmer, not opaque.";
    return `What buyers ask: “${q.slice(0, 72)}${q.length > 72 ? "…" : ""}”`;
  });

  const avg = {
    ...lead.scores,
    overall: clampAvg(ranked.map((m) => m.scores.overall)),
    reasons: [
      ...lead.scores.reasons.slice(0, 3),
      `Cluster of ${members.length} related questions; lead ROI ${lead.scores.overall}`,
    ],
  };

  return {
    id,
    workingTitle,
    coreBuyerQuestion: lead.canonicalQuestion,
    centralTension: tensionFor(lead, workingTitle),
    whyItMattersToBuyer: buyerWhy(lead),
    whyItMattersToHourglass: hourglassWhy(lead, topicKind),
    primaryFormat,
    supportingFormats: supportingFormats.slice(0, 6),
    inappropriateFormats: inappropriate,
    topicKind,
    supportingQuestionAngles: angles,
    shortFormHooks: hooks,
    tasteAngle: tasteOk
      ? tasteAngleFor(lead, workingTitle)
      : null,
    articleOrFaqOpportunity: articleFaqFor(primaryFormat, workingTitle, members.length),
    newsletterAngle: `One clear takeaway from “${workingTitle}” for buyers mid-research — no inventory pitch.`,
    salesUseAngle: salesAngleFor(lead),
    productionEffort: effortFromScores(lead),
    overallRoi: avg.overall,
    scoreBreakdown: avg,
    relatedQuestionIds: members.map((m) => m.questionId),
    gapClusterId,
    queryFamilies: [...new Set(members.map((m) => m.queryFamily))],
    reasoningSummary: `${workingTitle}: ROI ${avg.overall} via sales ${lead.scores.dimensions.salesInfluence}, brand ${lead.scores.dimensions.brandDifferentiation}, search ${lead.scores.dimensions.searchDiscovery}. Format=${primaryFormat}; ${members.length} related questions consolidated.`,
    reservedSequence: reserved != null,
    reservedPosition: reserved?.position ?? null,
  };
}

function clampAvg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function tensionFor(
  lead: ContentRoiQuestionAssessment,
  title: string,
): string {
  if (/budget|spend|price/i.test(title + lead.canonicalQuestion)) {
    return "Buyers want a number; the real decision is what visibly improves — and what does not.";
  }
  if (/where to buy|online|jeweler/i.test(title + lead.canonicalQuestion)) {
    return "More storefronts and listings create false confidence; judgment is still the scarce resource.";
  }
  if (/identical|cut|certificate/i.test(title + lead.canonicalQuestion)) {
    return "Paper equivalence hides optical and craft differences the eye notices immediately.";
  }
  if (/care|maintenance|insurance/i.test(lead.canonicalQuestion)) {
    return "Ownership questions are practical — but still shape trust after the emotional peak of the proposal.";
  }
  return `Buyers feel stuck on “${lead.canonicalQuestion}” without a calm Hourglass standard.`;
}

function buyerWhy(lead: ContentRoiQuestionAssessment): string {
  return `Answering “${lead.canonicalQuestion}” reduces uncertainty at the ${lead.audienceStage} stage and supports a better decision — not just more research.`;
}

function hourglassWhy(
  lead: ContentRoiQuestionAssessment,
  kind: ContentRoiTopicKind,
): string {
  return `Positions Hourglass as discernment-led (${kind}) rather than inventory-led; family=${lead.queryFamily}; commercial ${lead.commercialValue}/10.`;
}

function tasteAngleFor(
  lead: ContentRoiQuestionAssessment,
  title: string,
): string {
  if (/budget|price/i.test(title)) {
    return "Observational take on jewelry math theater and why “rules of thumb” flatten taste.";
  }
  if (/rare|lab|natural/i.test(lead.canonicalQuestion + title)) {
    return "Skewer inflated rarity language without picking a tribal fight.";
  }
  if (/jeweler|online|retail/i.test(lead.canonicalQuestion)) {
    return "Quiet irony about showroom inspection culture and dessert-menu diamond talk.";
  }
  return "Restrained commentary on industry language that takes itself too seriously.";
}

function articleFaqFor(
  format: ContentRoiPrimaryFormat,
  title: string,
  n: number,
): string {
  if (format === "diamond-guide-flagship") {
    return `Flagship Diamond Guide: “${title}” with ${n} supporting FAQ entries.`;
  }
  if (format === "post-purchase-guide") {
    return `Ownership/care guide section + FAQ cluster (${n} angles).`;
  }
  if (format === "faq-cluster") {
    return `FAQ-only cluster under existing pages (${n} questions).`;
  }
  return `Supporting article/FAQ angles under “${title}” (${n} related questions).`;
}

function salesAngleFor(lead: ContentRoiQuestionAssessment): string {
  return `Concierge follow-up: calmly address “${lead.canonicalQuestion}” with standards and next steps — never pressure.`;
}

/**
 * Consolidate assessments into packages: gap clusters first, then family singletons,
 * then reserved Conversation packages.
 */
export function buildEditorialPackages(
  assessments: ContentRoiQuestionAssessment[],
  fanOutOpportunities: FanOutOpportunity[] = [],
): ContentRoiEditorialPackage[] {
  const used = new Set<string>();
  const packages: ContentRoiEditorialPackage[] = [];

  // Reserved Conversation packages (planning placeholders — not scored as gaps only)
  for (const cycle of RESERVED_CONVERSATION_CYCLES) {
    const members = assessments.filter((a) =>
      cycle.relatedQuestionMatchers.some((m) =>
        normalizeText(a.canonicalQuestion).includes(normalizeText(m)),
      ),
    );
    const id = `content-roi:reserved:${cycle.position}`;
    if (members.length === 0) {
      // Synthetic reserved package from cycle metadata
      const syntheticLead = assessments[0];
      if (!syntheticLead) continue;
      packages.push({
        id,
        workingTitle: cycle.conversationTitle,
        coreBuyerQuestion: cycle.centralIdea,
        centralTension: cycle.centralIdea,
        whyItMattersToBuyer:
          "Gives buyers a clearer starting philosophy before infinite comparison.",
        whyItMattersToHourglass:
          "Preserves the founder-affirmed Conversation cadence already in motion.",
        primaryFormat: "conversation",
        supportingFormats: [
          "short-form-series",
          "a-matter-of-taste",
          "newsletter",
          "faq-cluster",
        ],
        inappropriateFormats: [],
        topicKind: "standalone-high-value",
        supportingQuestionAngles: [cycle.centralIdea],
        shortFormHooks: [
          `Conversation hook territory: ${cycle.conversationTitle}`,
        ],
        tasteAngle: cycle.tasteTitle,
        articleOrFaqOpportunity: `Paired Taste: ${cycle.tasteTitle}`,
        newsletterAngle: `Tease the principle behind “${cycle.conversationTitle}”.`,
        salesUseAngle:
          "Use after filming as a calm worldview reference in Concierge conversations.",
        productionEffort: "high",
        overallRoi: 95 - cycle.position, // keep reserved ahead without inventing gap scores
        scoreBreakdown: {
          dimensions: {
            salesInfluence: 90,
            brandDifferentiation: 95,
            searchDiscovery: 70,
            crossChannelLeverage: 92,
            conversationPotential: 95,
            strategicUrgency: 88,
            shortFormPotential: 85,
            evergreenValue: 90,
            productionEfficiency: 45,
            tastePotential: 80,
          },
          weights: assessments[0]!.scores.weights,
          weightedContribution: assessments[0]!.scores.weightedContribution,
          overall: 95 - cycle.position,
          reasons: ["Reserved founder Conversation cycle — not reordered by ROI"],
          evidence: [`reservedPosition=${cycle.position}`],
        },
        relatedQuestionIds: [],
        gapClusterId: null,
        queryFamilies: [],
        reasoningSummary: `Reserved cycle ${cycle.position}: ${cycle.conversationTitle}`,
        reservedSequence: true,
        reservedPosition: cycle.position,
      });
      continue;
    }
    for (const m of members) used.add(m.questionId);
    const pkg = buildPackageFromMembers(
      id,
      cycle.conversationTitle,
      members,
      "standalone-high-value",
      "conversation",
      members[0]?.gapClusterId ?? null,
      { position: cycle.position },
    );
    pkg.tasteAngle = cycle.tasteTitle;
    pkg.supportingFormats = [
      ...new Set<ContentRoiPrimaryFormat>([
        ...pkg.supportingFormats,
        "a-matter-of-taste",
        "short-form-series",
      ]),
    ];
    pkg.overallRoi = Math.max(pkg.overallRoi, 92 - cycle.position);
    pkg.reasoningSummary = `Reserved cycle ${cycle.position} preserved ahead of ROI backlog. ${pkg.reasoningSummary}`;
    packages.push(pkg);
  }

  // Fan-out gap clusters → flagship packages
  for (const def of GAP_CLUSTER_DEFINITIONS) {
    const members = assessments.filter(
      (a) => a.gapClusterId === def.id && !used.has(a.questionId),
    );
    if (members.length === 0) continue;
    for (const m of members) used.add(m.questionId);
    const primary: ContentRoiPrimaryFormat =
      def.id === "ownership-care-maintenance"
        ? "post-purchase-guide"
        : "diamond-guide-flagship";
    const pkg = buildPackageFromMembers(
      `content-roi:cluster:${def.id}`,
      def.flagshipTitle,
      members,
      "flagship-cluster",
      primary,
      def.id,
      null,
    );
    // Flagships earn consolidation + cross-channel premium (not raw search alone)
    pkg.overallRoi = Math.min(
      100,
      pkg.overallRoi + 6 + Math.min(8, members.length),
    );
    pkg.reasoningSummary += ` Flagship consolidation premium (+members=${members.length}).`;
    packages.push(pkg);
  }

  // Decision-anxiety consolidation — one Conversation package, not six adjacent slots
  {
    const DECISION_ANXIETY_MATCHERS = [
      "overpaying",
      "stop comparing",
      "wrong diamond",
      "regret it later",
      "too many diamond options",
      "too many options",
      "shop for an engagement ring alone",
      "bring my partner",
      "without ruining the surprise",
      "preserve the surprise",
      "choose the wrong",
    ];
    const members = assessments.filter(
      (a) =>
        !used.has(a.questionId) &&
        DECISION_ANXIETY_MATCHERS.some((m) =>
          normalizeText(a.canonicalQuestion).includes(normalizeText(m)),
        ),
    );
    if (members.length >= 2) {
      for (const m of members) used.add(m.questionId);
      const pkg = buildPackageFromMembers(
        "content-roi:cluster:decision-confidence",
        "How to Make a Confident Engagement-Ring Decision",
        members,
        "flagship-cluster",
        "conversation",
        "decision-confidence",
        null,
      );
      pkg.overallRoi = Math.min(
        100,
        pkg.overallRoi + 5 + Math.min(7, members.length),
      );
      pkg.tasteAngle = null; // reserved cycle #3 already owns related Taste territory
      pkg.inappropriateFormats = [
        ...new Set<ContentRoiPrimaryFormat>([
          ...pkg.inappropriateFormats,
          "a-matter-of-taste",
        ]),
      ];
      pkg.reasoningSummary +=
        ` Decision-anxiety consolidation (${members.length} related questions → one Conversation package).`;
      packages.push(pkg);
    }
  }

  // Post-contact concierge explainer (distinct from broader private-experience Conversation)
  {
    const members = assessments.filter(
      (a) =>
        !used.has(a.questionId) &&
        /what happens after i contact|after i (?:reach out|contact).*concierge/i.test(
          a.canonicalQuestion,
        ),
    );
    if (members.length >= 1) {
      for (const m of members) used.add(m.questionId);
      const pkg = buildPackageFromMembers(
        "content-roi:cluster:post-contact-concierge",
        "What Happens After You Contact a Concierge Jeweler",
        members,
        "sales-enablement",
        "concierge-explainer",
        "post-contact-concierge",
        null,
      );
      pkg.overallRoi = Math.min(100, pkg.overallRoi + 4);
      pkg.inappropriateFormats = [
        ...new Set<ContentRoiPrimaryFormat>([
          ...pkg.inappropriateFormats,
          "conversation",
          "a-matter-of-taste",
        ]),
      ];
      packages.push(pkg);
    }
  }

  // Thematic consolidation: private / concierge luxury questions
  {
    const members = assessments.filter(
      (a) =>
        !used.has(a.questionId) &&
        (a.queryFamily === "luxury-and-private-client" ||
          (/concierge|private jeweler/i.test(a.canonicalQuestion) &&
            a.queryFamily === "buying-process-anxiety")),
    );
    if (members.length >= 2) {
      for (const m of members) used.add(m.questionId);
      const pkg = buildPackageFromMembers(
        "content-roi:cluster:private-concierge-experience",
        "What a Private Concierge Diamond Experience Actually Feels Like",
        members,
        "flagship-cluster",
        "conversation",
        "private-concierge-experience",
        null,
      );
      pkg.overallRoi = Math.min(100, pkg.overallRoi + 5 + Math.min(6, members.length));
      pkg.tasteAngle =
        pkg.tasteAngle ??
        "Observational take on jewelry-theater appointments vs calm private guidance.";
      packages.push(pkg);
    }
  }

  // Remaining high-value questions as standalone / format-specific packages
  const remaining = assessments
    .filter((a) => !used.has(a.questionId))
    .sort((a, b) => b.scores.overall - a.scores.overall);

  for (const a of remaining) {
    // Skip low-ROI fully covered
    if (a.coverageBand === "fully-covered" && a.scores.overall < 55) continue;
    used.add(a.questionId);
    packages.push(
      buildPackageFromMembers(
        `content-roi:q:${slugify(a.questionId)}`,
        a.canonicalQuestion.replace(/\?$/, ""),
        [a],
        a.topicKindHint,
        a.primaryFormat,
        a.gapClusterId,
        null,
      ),
    );
  }

  // Boost packages that match top fan-out opportunities
  const foTitles = new Set(
    fanOutOpportunities.map((o) => normalizeText(o.flagshipTitle ?? o.question)),
  );
  for (const pkg of packages) {
    if (foTitles.has(normalizeText(pkg.workingTitle))) {
      pkg.overallRoi = Math.min(100, pkg.overallRoi + 3);
      pkg.reasoningSummary += " Aligned with top Fan-Out opportunity.";
    }
  }

  return packages.sort((a, b) => {
    if (a.reservedSequence && b.reservedSequence) {
      return (a.reservedPosition ?? 0) - (b.reservedPosition ?? 0);
    }
    if (a.reservedSequence) return -1;
    if (b.reservedSequence) return 1;
    return b.overallRoi - a.overallRoi;
  });
}

/** Post-sequence ranking with light editorial balance (not pure score sort). */
export function buildPostSequenceOrder(
  packages: ContentRoiEditorialPackage[],
): ContentRoiSequenceSlot[] {
  const reserved = packages
    .filter((p) => p.reservedSequence)
    .sort((a, b) => (a.reservedPosition ?? 0) - (b.reservedPosition ?? 0));
  const rest = packages
    .filter((p) => !p.reservedSequence)
    .filter((p) => p.topicKind !== "supporting-faq" || p.overallRoi >= 60);

  // Prefer ROI order; diversify only when a near-score alternate avoids theme streaks
  const ordered: ContentRoiEditorialPackage[] = [];
  const pool = [...rest].sort((a, b) => b.overallRoi - a.overallRoi);
  let lastTag: ContentRoiSequenceSlot["balanceTag"] | null = null;
  let streak = 0;
  while (pool.length > 0) {
    const top = pool[0]!;
    const topTag = balanceTagFor(top);
    let idx = 0;
    if (lastTag === topTag && streak >= 1) {
      const alt = pool.findIndex((p, i) => {
        if (i === 0) return false;
        if (balanceTagFor(p) === lastTag) return false;
        // Near-score only — do not force round-robin across large ROI gaps
        return top.overallRoi - p.overallRoi <= 8;
      });
      if (alt >= 0) idx = alt;
    }
    const next = pool.splice(idx, 1)[0]!;
    const tag = balanceTagFor(next);
    if (tag === lastTag) streak += 1;
    else {
      lastTag = tag;
      streak = 1;
    }
    ordered.push(next);
  }

  const slots: ContentRoiSequenceSlot[] = [];
  let order = 1;
  for (const p of reserved) {
    slots.push({
      order: order++,
      packageId: p.id,
      workingTitle: p.workingTitle,
      primaryFormat: p.primaryFormat,
      overallRoi: p.overallRoi,
      reserved: true,
      balanceTag: balanceTagFor(p),
    });
  }
  for (const p of ordered) {
    slots.push({
      order: order++,
      packageId: p.id,
      workingTitle: p.workingTitle,
      primaryFormat: p.primaryFormat,
      overallRoi: p.overallRoi,
      reserved: false,
      balanceTag: balanceTagFor(p),
    });
  }
  return slots;
}

export function classifySpecialBuckets(
  assessments: ContentRoiQuestionAssessment[],
  packages: ContentRoiEditorialPackage[],
): {
  faqOnly: ContentRoiQuestionAssessment[];
  salesSupportOnly: ContentRoiQuestionAssessment[];
  lowRoiUncovered: ContentRoiQuestionAssessment[];
  evidenceNeeded: ContentRoiQuestionAssessment[];
} {
  const inFlagship = new Set(
    packages
      .filter((p) => p.topicKind === "flagship-cluster")
      .flatMap((p) => p.relatedQuestionIds),
  );

  const faqOnly = assessments.filter(
    (a) =>
      (inFlagship.has(a.questionId) && a.scores.overall < 78) ||
      (a.queryFamily === "maintenance-repairs-ownership" &&
        a.scores.dimensions.conversationPotential < 45) ||
      (a.primaryFormat === "faq-cluster" &&
        a.scores.dimensions.conversationPotential < 50),
  );

  const salesSupportOnly = assessments.filter(
    (a) =>
      a.primaryFormat === "sales-support" ||
      a.topicKindHint === "sales-enablement" ||
      (a.audienceStage === "ready-to-contact" &&
        a.scores.dimensions.conversationPotential < MIN_CONVERSATION_DEPTH &&
        a.scores.dimensions.salesInfluence >= 75),
  );

  const uncovered = assessments.filter((a) => a.coverageBand === "uncovered");
  const uncoveredSorted = [...uncovered].sort(
    (a, b) => a.scores.overall - b.scores.overall,
  );
  const lowCutoff = uncoveredSorted[Math.floor(uncoveredSorted.length * 0.2)]?.scores
    .overall;
  const lowRoiUncovered = uncovered.filter(
    (a) =>
      a.scores.overall < LOW_ROI_UNCOVERED_THRESHOLD ||
      (lowCutoff != null && a.scores.overall <= lowCutoff),
  );

  // Needs better demand evidence before heavy production investment
  const evidenceNeeded = assessments.filter(
    (a) =>
      a.coverageBand !== "fully-covered" &&
      a.scores.overall >= 62 &&
      a.commercialValue >= 7 &&
      a.scores.dimensions.searchDiscovery >= 60 &&
      !a.scores.evidence.some((e) => e.includes("source=gsc-fixture")) &&
      a.primaryFormat === "conversation",
  );

  return { faqOnly, salesSupportOnly, lowRoiUncovered, evidenceNeeded };
}

export function selectTopPackages(
  packages: ContentRoiEditorialPackage[],
  n: number,
): ContentRoiEditorialPackage[] {
  const flagshipMemberIds = new Set(
    packages
      .filter((p) => p.topicKind === "flagship-cluster")
      .flatMap((p) => p.relatedQuestionIds),
  );
  return packages
    .filter((p) => !p.reservedSequence)
    .filter((p) => {
      // Suppress singleton packages that merely restate a flagship member question
      if (p.topicKind === "flagship-cluster") return true;
      if (p.relatedQuestionIds.length !== 1) return true;
      return !flagshipMemberIds.has(p.relatedQuestionIds[0]!);
    })
    .slice(0, n);
}

export function selectFounderFacingPackages(
  packages: ContentRoiEditorialPackage[],
  limit = MAX_FOUNDER_FACING_CONTENT_ROI,
): ContentRoiEditorialPackage[] {
  const flagshipIds = new Set(
    packages
      .filter((p) => p.topicKind === "flagship-cluster")
      .flatMap((p) => p.relatedQuestionIds),
  );
  return packages
    .filter((p) => !p.reservedSequence)
    .filter((p) => p.topicKind !== "supporting-faq")
    .filter((p) => p.overallRoi >= 55)
    // Standalone packages whose only question is already inside a flagship
    // must not compete in the founder queue
    .filter(
      (p) =>
        p.topicKind === "flagship-cluster" ||
        !p.relatedQuestionIds.every((id) => flagshipIds.has(id)) ||
        p.relatedQuestionIds.length === 0,
    )
    .slice(0, limit);
}

export function buildBacklogCandidates(
  packages: ContentRoiEditorialPackage[],
  evidenceNeededIds: Set<string>,
): ContentRoiBacklogCandidate[] {
  const reserved = packages
    .filter((p) => p.reservedSequence)
    .map((p) => ({
      id: `editorial-backlog:${p.id}`,
      title: p.workingTitle,
      primaryFormat: p.primaryFormat,
      relatedCanonicalQuestions: p.supportingQuestionAngles.slice(0, 5),
      overallRoi: p.overallRoi,
      productionEffort: p.productionEffort,
      reservedSequencePosition: p.reservedPosition,
      status: "reserved" as const,
      prerequisite: p.reservedPosition === 1 ? null : `Complete reserved cycle ${(p.reservedPosition ?? 1) - 1}`,
      nextAction: `Produce Conversation + paired Taste: ${p.tasteAngle ?? "TBD"}`,
      packageId: p.id,
    }));

  const ranked = selectTopPackages(packages, MAX_BACKLOG_ELIGIBLE_PACKAGES).map(
    (p) => {
      const needsEvidence = p.relatedQuestionIds.some((id) =>
        evidenceNeededIds.has(id),
      );
      const status =
        p.primaryFormat === "faq-cluster"
          ? ("faq-only" as const)
          : p.primaryFormat === "sales-support"
            ? ("sales-support-only" as const)
            : needsEvidence
              ? ("evidence-needed" as const)
              : ("ranked-ready" as const);
      return {
        id: `editorial-backlog:${p.id}`,
        title: p.workingTitle,
        primaryFormat: p.primaryFormat,
        relatedCanonicalQuestions: p.supportingQuestionAngles.slice(0, 5),
        overallRoi: p.overallRoi,
        productionEffort: p.productionEffort,
        reservedSequencePosition: null,
        status,
        prerequisite: "Complete reserved three Conversation cycles",
        nextAction: `Plan ${p.primaryFormat} package — outline only; do not publish from Agent OS`,
        packageId: p.id,
      };
    },
  );

  return [...reserved, ...ranked];
}

/** Supporting FAQs must not outrank their flagship in founder lists */
export function assertFlagshipBeforeSupporting(
  packages: ContentRoiEditorialPackage[],
): boolean {
  const flagships = packages.filter((p) => p.topicKind === "flagship-cluster");
  for (const f of flagships) {
    const support = packages.filter(
      (p) =>
        p.topicKind === "supporting-faq" &&
        p.gapClusterId &&
        p.gapClusterId === f.gapClusterId,
    );
    for (const s of support) {
      if (s.overallRoi > f.overallRoi + 5) return false;
    }
  }
  return true;
}

export function conversationRequiresDepth(
  assessment: ContentRoiQuestionAssessment,
): boolean {
  if (assessment.primaryFormat !== "conversation") return true;
  return assessment.scores.dimensions.conversationPotential >= MIN_CONVERSATION_DEPTH;
}
