/** Shared FAQ copy for what-is-diamond-clarity article and schema. */

export type ClarityFaq = {
  question: string;
  answer: string;
};

export const CLARITY_FAQS: ClarityFaq[] = [
  {
    question: "What is diamond clarity?",
    answer:
      "Diamond clarity describes the number, size, type, and position of internal inclusions and surface blemishes in a diamond, as observed under ten-power magnification. It is one of the Four Cs on grading reports and ranges from Flawless down through Included grades.",
  },
  {
    question: "What clarity grade is best for an engagement ring?",
    answer:
      "There is no single best grade for every ring. Most strong engagement diamonds are eye clean in the VS or SI range when inclusion placement is favorable. Shape, size, setting, and cut all change how much clarity you need. The practical standard is clean on the hand, not flawless under a loupe.",
  },
  {
    question: "What does eye-clean mean?",
    answer:
      "Eye clean means inclusions are not visible to the naked eye from the top at normal viewing distance in everyday light. It is not a formal GIA grade. A diamond can be SI1 on the report and still be eye clean in wear when features are small, light, or tucked where prongs or sparkle hide them.",
  },
  {
    question: "Are SI1 or SI2 diamonds worth considering?",
    answer:
      "Often yes, when each stone is evaluated individually. Many SI1 diamonds are eye clean. SI2 can work in some shapes and settings but requires careful viewing. Inclusion location matters more than the letter alone. SI2 at Hourglass requires individual inspection before it is offered.",
  },
  {
    question: "Are flawless diamonds worth the extra cost?",
    answer:
      "For some collectors and buyers who value top-of-scale rarity, yes. For most engagement ring buyers, internally flawless or flawless grades look similar to well-chosen VS or SI stones in everyday wear. The premium often buys paper perfection rather than visible difference on the hand.",
  },
  {
    question: "Does clarity affect sparkle?",
    answer:
      "Clarity can influence appearance, but cut has a larger effect on sparkle. Tiny inclusions rarely block light return in eye-clean stones. Large or centered inclusions, or included grades that reduce transparency, can dull a diamond. A lively moderate-clarity stone usually outsparkles a dull higher-clarity one.",
  },
];
