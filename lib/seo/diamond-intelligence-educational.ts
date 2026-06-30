/** Shared educational copy for Diamond Intelligence UI and FAQ schema. */

export type DiamondIntelligenceFaq = {
  question: string;
  answer: string;
};

export const DIAMOND_INTELLIGENCE_FAQS: DiamondIntelligenceFaq[] = [
  {
    question: "What is Diamond Intelligence?",
    answer:
      "Diamond Intelligence is an independent report interpretation tool from Hourglass Diamonds. Upload an original grading report PDF and review how the stone's proportions, light performance, and craftsmanship read against trained gemological standards—not a sales script.",
  },
  {
    question: "Which grading reports does Diamond Intelligence accept?",
    answer:
      "Diamond Intelligence accepts original PDF grading reports from GIA, IGI, and GCAL 8X. The tool extracts measurements and performance data from the document you provide and interprets them through Hourglass review standards.",
  },
  {
    question: "How does Diamond Intelligence help read a GIA, IGI, or GCAL report?",
    answer:
      "A certificate summarizes grades and measurements, but the practical meaning of those numbers is not always obvious. Diamond Intelligence translates proportions, optical balance, and performance indicators into clearer context so you can understand what the report suggests before you buy.",
  },
  {
    question: "How is this different from GIA Report Check?",
    answer:
      "GIA Report Check confirms that a report number matches GIA's database. Diamond Intelligence goes further by interpreting proportions, light behavior, and craftsmanship signals in practical terms—without replacing the laboratory's official grades.",
  },
  {
    question: "Is a grading report enough to make a final buying decision?",
    answer:
      "A report is a strong starting point, not a substitute for seeing the diamond in person. Beauty, light performance in real environments, and how the stone works in your setting still matter. Diamond Intelligence is designed to sharpen judgment before that final viewing—not replace it.",
  },
];

export const DIAMOND_INTELLIGENCE_CERTIFICATION_LINKS = [
  {
    title: "How to Read a Diamond Certificate",
    href: "/diamond-guide/how-to-read-a-diamond-certificate",
  },
  {
    title: "GIA Diamond Certification Explained",
    href: "/diamond-guide/gia-diamond-certification-explained",
  },
  {
    title: "IGI Diamond Certification Explained",
    href: "/diamond-guide/igi-diamond-certification-explained",
  },
  {
    title: "GCAL 8X Diamond Certification Explained",
    href: "/diamond-guide/gcal-8x-diamond-certification-explained",
  },
  {
    title: "What is a Diamond Certificate",
    href: "/diamond-guide/what-is-a-diamond-certificate",
  },
  {
    title: "Diamond Certification Guide",
    href: "/diamond-guide/certification",
  },
] as const;
