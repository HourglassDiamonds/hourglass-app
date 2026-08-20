export type ProposalPlanningArticleRef = {
  title: string;
  href: string;
  description?: string;
};

export const proposalPlanningArticles: ProposalPlanningArticleRef[] = [
  {
    title: "Best Places to Propose in Charlotte",
    href: "/diamond-guide/best-places-to-propose-in-charlotte",
    description:
      "Charlotte settings worth considering when you want the moment to feel intentional, not improvised.",
  },
  {
    title: "How to Plan a Proposal in Charlotte",
    href: "/diamond-guide/how-to-plan-a-proposal-in-charlotte",
    description:
      "Timing, logistics, and the details that separate a smooth proposal from a stressful one.",
  },
  {
    title: "Best Proposal Photographers in Charlotte",
    href: "/diamond-guide/best-proposal-photographers-in-charlotte",
    description:
      "How to capture the moment without turning the proposal into a production.",
  },
  {
    title: "Most Romantic Restaurants in Charlotte for an Engagement Celebration",
    href: "/diamond-guide/most-romantic-restaurants-charlotte-engagement-celebration",
    description:
      "Where to celebrate after she says yes, with atmosphere that matches the occasion.",
  },
  {
    title: "Best Charlotte Rooftop Proposal Locations",
    href: "/diamond-guide/best-charlotte-rooftop-proposal-locations",
    description:
      "Skyline views, privacy tradeoffs, and what to confirm before you book.",
  },
  {
    title: "How to Plan a Proposal She'll Never Forget",
    href: "/diamond-guide/how-to-plan-a-proposal-she-will-never-forget",
    description:
      "What makes a proposal memorable beyond the ring and the location.",
  },
  {
    title: "The First 30 Days After You Get Engaged",
    href: "/diamond-guide/first-30-days-after-you-get-engaged",
    description:
      "The practical and emotional rhythm of the month after the question.",
  },
];

export const beginHereGuides = proposalPlanningArticles.slice(0, 3);

export const mostReadGuides = proposalPlanningArticles.slice(3);

export const articleGroups = [
  {
    title: "Charlotte Locations",
    description:
      "Where to propose in Charlotte when setting and atmosphere matter as much as the ring.",
    articles: proposalPlanningArticles.filter((article) =>
      [
        "/diamond-guide/best-places-to-propose-in-charlotte",
        "/diamond-guide/best-charlotte-rooftop-proposal-locations",
      ].includes(article.href),
    ),
  },
  {
    title: "Planning the Moment",
    description:
      "How to prepare logistically and emotionally so the proposal feels natural, not performative.",
    articles: proposalPlanningArticles.filter((article) =>
      [
        "/diamond-guide/how-to-plan-a-proposal-in-charlotte",
        "/diamond-guide/how-to-plan-a-proposal-she-will-never-forget",
        "/diamond-guide/best-proposal-photographers-in-charlotte",
      ].includes(article.href),
    ),
  },
  {
    title: "Celebration & After",
    description:
      "What comes next once the question is asked, from dinner reservations to the first month engaged.",
    articles: proposalPlanningArticles.filter((article) =>
      [
        "/diamond-guide/most-romantic-restaurants-charlotte-engagement-celebration",
        "/diamond-guide/first-30-days-after-you-get-engaged",
      ].includes(article.href),
    ),
  },
];

export const relatedTopics = [
  {
    title: "Buying Strategy",
    href: "/diamond-guide/buying-strategy",
    description:
      "How to choose the ring with clarity before the proposal date arrives.",
  },
  {
    title: "Charlotte Guides",
    href: "/diamond-guide/charlotte-guides",
    description:
      "Local guidance for navigating the Charlotte diamond market with confidence.",
  },
  {
    title: "Certification",
    href: "/diamond-guide/certification",
    description:
      "How to read grading reports when the ring decision still needs verification.",
  },
];
