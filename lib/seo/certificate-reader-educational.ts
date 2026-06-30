/** Shared FAQ copy for how-to-read-a-diamond-certificate article and schema. */

export type CertificateReaderFaq = {
  question: string;
  answer: string;
};

export const CERTIFICATE_READER_FAQS: CertificateReaderFaq[] = [
  {
    question: "What does a diamond certificate tell you?",
    answer:
      "A diamond certificate documents measurable traits a laboratory observed under controlled conditions: carat weight, color, clarity, proportions, fluorescence when listed, and often an inclusion plot. It confirms identity through a report number. It does not guarantee how the diamond will look on the hand, in your setting, or in daily light.",
  },
  {
    question: "Does a GIA report prove a diamond is beautiful?",
    answer:
      "No. A GIA report describes grading results using consistent standards. It can support comparison and trust, but beauty depends on cut precision within a grade, inclusion placement, and how the stone performs when viewed. Two Excellent-cut rounds on paper can still look different in person.",
  },
  {
    question: "How do you compare two diamond reports?",
    answer:
      "Confirm both laboratories and that report numbers match the stones. Compare proportions and inclusion plots, not only the summary line. Read fluorescence and measurements. Then view the diamonds side by side in similar light. Reports narrow the field; your eyes finish the decision.",
  },
  {
    question: "When should you use Diamond Intelligence?",
    answer:
      "Use Diamond Intelligence when you have a specific report in hand and want help translating proportions and grades into practical performance context before you buy or compare stones. It supports judgment. It does not replace viewing the diamond in person or a conversation with a gemologist when the purchase is significant.",
  },
  {
    question: "When should you ask a Graduate Gemologist?",
    answer:
      "Ask a Graduate Gemologist when two reports look alike but prices differ sharply, when you are unsure whether an inclusion will matter in your setting, when fancy-shape proportions are hard to interpret, or when you want a second opinion before a major purchase. Trained review reads the same page with performance and wear in mind.",
  },
];
