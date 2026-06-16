export type ApproachQuestion = {
  id: string;
  question: string;
  paragraphs: string[];
};

export type ApproachChapter = {
  id: string;
  number: string;
  title: string;
  intro: string;
  questions: ApproachQuestion[];
};

export const APPROACH_CHAPTERS: ApproachChapter[] = [
  {
    id: "selection-philosophy",
    number: "01",
    title: "Selection Philosophy",
    intro:
      "Selection is not about quantity. It is about identifying the few diamonds that deserve serious consideration.",
    questions: [
      {
        id: "why-not-thousands",
        question: "Why don't you list thousands of diamonds online?",
        paragraphs: [
          "The jewelry industry often presents volume as reassurance — the implication that somewhere in a vast inventory lies the right stone. We find that abundance without judgment rarely creates clarity.",
          "Hourglass maintains a curated selection reviewed through gemological standards, with emphasis on light performance and proportion quality. What we show has already earned consideration; what we recommend has earned conviction.",
        ],
      },
      {
        id: "no-public-search",
        question: "Why don't you offer a public inventory search?",
        paragraphs: [
          "Public search tools are built for comparison at scale. They reward filtering by grades and price, which are useful starting points but incomplete measures of how a diamond will actually perform.",
          "Our process begins with understanding what matters for your priorities — then we identify stones worth reviewing from trusted sources. Curation replaces endless scrolling with deliberate evaluation.",
        ],
      },
      {
        id: "would-buy-ourselves",
        question: "Do you sell diamonds you wouldn't buy yourself?",
        paragraphs: [
          "No. Every diamond we present has passed a threshold we would apply to our own purchase. That does not mean every diamond is flawless on paper — it means each one has a defensible reason to exist in our recommendation set.",
          "If we would not stand behind a stone personally, it does not enter our process. The goal is not to sell every diamond. The goal is to help people make better decisions.",
        ],
      },
      {
        id: "excellent-not-recommended",
        question:
          "Why do some diamonds receive excellent grades but still aren't recommended?",
        paragraphs: [
          "Laboratory grades describe measurable attributes — color, clarity, cut parameters — but they do not guarantee how a diamond returns light in real conditions. A Triple Excellent round may still lack the optical performance we prioritize.",
          "Excellent grades are a starting point, not a destination. We evaluate whether proportion, light return, and visual character align with what we believe a diamond should do: perform beautifully.",
        ],
      },
      {
        id: "worth-reviewing-vs-recommended",
        question:
          'What makes a diamond "worth reviewing" versus "recommended"?',
        paragraphs: [
          '"Worth reviewing" means a stone has sufficient promise to warrant closer examination — strong fundamentals, acceptable grades, and no immediate disqualifying concerns.',
          '"Recommended" means it has passed deeper evaluation: light performance assessment, proportion review, and alignment with your specific priorities. The distance between those two states is where gemological judgment matters most.',
        ],
      },
    ],
  },
  {
    id: "pricing-buying",
    number: "02",
    title: "Pricing & Buying",
    intro:
      "Price matters. Value matters more. Understanding the difference is often where the best decisions are made.",
    questions: [
      {
        id: "how-price",
        question: "How do you price diamonds?",
        paragraphs: [
          "We price based on what a diamond actually represents — its optical quality, proportion precision, rarity of its performance profile, and the integrity of its sourcing. Price reflects value, not just a discount from an inflated list.",
          "Transparency matters: you should understand what you are paying for and why it is priced as it is.",
        ],
      },
      {
        id: "compete-online",
        question: "Can you compete with online diamond prices?",
        paragraphs: [
          "Some online retailers operate at scale with minimal service, liberal return policies, and optimization for transaction volume. Hourglass operates differently — with gemologist-led evaluation, curated selection, and ongoing guidance through design and delivery.",
          "We are not always the lowest price on paper. We focus on ensuring the price you pay corresponds to genuine value rather than a grade that looks favorable on a screen but disappoints in person.",
        ],
      },
      {
        id: "cheapest-not-value",
        question: "Why aren't the cheapest diamonds always the best value?",
        paragraphs: [
          "The cheapest diamond in a given grade often carries compromises that grading reports do not capture — slightly off proportions, muted light return, or characteristics that affect visual beauty more than the certificate suggests.",
          "Value is the relationship between what you pay and what you receive. A modest premium for meaningfully better performance often represents stronger long-term value than marginal savings on paper.",
        ],
      },
      {
        id: "natural-and-lab",
        question:
          "Do you work with both natural and laboratory-grown diamonds?",
        paragraphs: [
          "Yes. Both can be beautiful when properly cut and carefully selected. Our standard remains the same regardless of origin: light performance, proportion quality, and visual character.",
          "We apply identical gemological rigor to both, and we are transparent about origin throughout the process.",
        ],
      },
      {
        id: "bring-diamond",
        question: "Can I bring you a diamond I found elsewhere?",
        paragraphs: [
          "Absolutely. Diamond Intelligence exists partly for this reason — to help you understand how a diamond from any source is likely to perform beyond its grading report.",
          "We can review reports, evaluate listings, and provide honest perspective on whether a stone warrants further consideration. Our role is to help you decide well, not only to sell what we source ourselves.",
        ],
      },
    ],
  },
  {
    id: "working-with-hourglass",
    number: "03",
    title: "Working With Hourglass",
    intro:
      "A more personal approach requires a different structure than a traditional jewelry store.",
    questions: [
      {
        id: "location",
        question: "Where are you located?",
        paragraphs: [
          "Hourglass is based in Charlotte, North Carolina. We work by appointment, creating space for unhurried conversation and careful review rather than showroom browsing. For a broader look at how to navigate the local market, see our [Charlotte Diamond Advisor Guide](/diamond-guide/charlotte-diamond-advisor-guide).",
        ],
      },
      {
        id: "need-nc",
        question: "Do I need to live in North Carolina to work with you?",
        paragraphs: [
          "No. A significant portion of our work happens with clients outside North Carolina — through remote consultation, report review, curated diamond selection, design collaboration, and secure shipping.",
          "Geography should not be a barrier to thoughtful guidance. Whether you are local or remote, it helps to understand [how an independent advisor differs from a traditional jewelry store](/diamond-guide/independent-diamond-advisor-vs-jewelry-store) before you begin.",
        ],
      },
      {
        id: "out-of-state",
        question: "How does the process work if I'm out of state?",
        paragraphs: [
          "The process mirrors our local approach, adapted for distance. We begin with conversation to understand your priorities and timeline.",
          "From there, we may review grading reports, share curated options with detailed context, develop designs collaboratively, and coordinate delivery. Communication remains personal and unhurried throughout.",
        ],
      },
      {
        id: "graduate-gemologist",
        question: "Why work with a Graduate Gemologist?",
        paragraphs: [
          "Diamond grading reports summarize measurable data, but interpreting that data — and understanding what it omits — requires trained gemological judgment.",
          "As a Graduate Gemologist, Justin brings credentials and years of trade experience to every evaluation. That expertise informs which diamonds enter consideration, how they are assessed, and what guidance you receive. For a fuller look at what that training means in practice, read [Why Work With a Graduate Gemologist?](/diamond-guide/why-work-with-a-graduate-gemologist).",
        ],
      },
      {
        id: "client-capacity",
        question: "How many clients do you take on at one time?",
        paragraphs: [
          "We intentionally limit active projects to preserve the quality of attention each client receives. Hourglass is not structured for volume.",
          "This restraint allows thorough evaluation, responsive communication, and a process that does not feel rushed.",
        ],
      },
      {
        id: "why-diamond-intelligence",
        question: "Why build Diamond Intelligence?",
        paragraphs: [
          "Consumers often make significant decisions armed only with a grading report and a price. Diamond Intelligence was built to translate report data into practical understanding — how a diamond is likely to perform in the real world, where its strengths lie, and what deserves closer scrutiny.",
          "It extends the same analytical perspective we apply internally to anyone evaluating a diamond independently.",
        ],
      },
    ],
  },
  {
    id: "questions-unasked",
    number: "04",
    title: "Questions People Don't Know They Have",
    intro:
      "Many of the most important diamond questions are rarely asked until after a purchase.",
    questions: [
      {
        id: "triple-excellent-not-exceptional",
        question: "Why isn't every Triple Excellent diamond exceptional?",
        paragraphs: [
          "Triple Excellent certifies that a round diamond meets specific proportion and symmetry thresholds. It confirms competence in cutting, not excellence in light performance.",
          "Two Triple Excellent diamonds can perform very differently — one returning crisp, bright light; another appearing flat or lifeless despite identical grades. The grade opens the conversation; it does not close it.",
        ],
      },
      {
        id: "smaller-looks-better",
        question: "Why do some diamonds look better than larger diamonds?",
        paragraphs: [
          "Visual beauty is not proportional to carat weight. A well-proportioned smaller diamond with superior light return often appears more brilliant and more present than a larger stone with compromised optics.",
          "What you perceive as size is partly an illusion created by how effectively a diamond returns light to the eye. Diamonds have one job: to return light beautifully.",
        ],
      },
      {
        id: "same-grades-different",
        question:
          "Why can two diamonds with the same grades look different in person?",
        paragraphs: [
          "Grading reports capture ranges, not identities. Two diamonds graded G/VS1/Excellent may differ in cut precision, fluorescence character, inclusion placement, and — most importantly — how their proportions interact with light.",
          "The report provides a framework; in-person evaluation reveals the diamond itself.",
        ],
      },
      {
        id: "reports-incomplete",
        question: "Why don't most grading reports tell the entire story?",
        paragraphs: [
          "Reports are standardized documents designed for consistency across laboratories, not for capturing the nuance of optical performance. Critical information — how a diamond actually returns light, whether proportions sit in an optimal range, how inclusions affect transparency — often requires interpretation beyond the certificate.",
          "This gap is precisely why we built Diamond Intelligence.",
        ],
      },
      {
        id: "identical-paper-different-price",
        question:
          "Why do I see different prices for diamonds that appear identical on paper?",
        paragraphs: [
          "Price reflects factors beyond the four Cs: sourcing relationships, market timing, inclusion character, cutting quality within the Excellent range, and the seller's margin structure.",
          "Two diamonds with matching grades can differ substantially in actual beauty and fair market value. Paper equivalence is a useful filter, not a reliable price anchor.",
        ],
      },
      {
        id: "jewelers-recommend-reject",
        question:
          "Why do some jewelers recommend diamonds I would reject?",
        paragraphs: [
          "Recommendation standards vary. Some prioritize moving inventory; others prioritize matching a budget to available stock; still others rely primarily on paper grades without deeper optical assessment. [How each buying model shapes advice](/diamond-guide/independent-diamond-advisor-vs-jewelry-store) is worth understanding before you evaluate a recommendation.",
          "Hourglass prioritizes light performance, proportion precision, and stones we would personally stand behind — even when that means recommending against a diamond that satisfies a simpler checklist.",
        ],
      },
    ],
  },
];
