import { isFounderReportedProvenance } from "./provenance";
import { sourcePreview } from "./store";
import type { HumanSourceStore } from "./store";
import type {
  HumanCommunicationType,
  HumanReviewStatus,
  HumanSource,
  HumanSourceType,
} from "./types";

export type InboxSourceView = {
  id: string;
  sourceType: HumanSourceType;
  ingestedAt: string;
  capturedAt: string | null;
  communicationType: HumanCommunicationType;
  reviewStatus: HumanReviewStatus;
  personNames: string[];
  projectTitles: string[];
  preview: string | null;
  founderReported: boolean;
};

export type HumanSourceDetailView = {
  source: HumanSource;
  personNames: string[];
  projectTitles: string[];
  founderReported: boolean;
};

async function resolveLinkNames(
  store: HumanSourceStore,
  sourceId: string,
): Promise<{ personNames: string[]; projectTitles: string[] }> {
  const links = await store.listLinks(sourceId);
  const personNames: string[] = [];
  const projectTitles: string[] = [];
  for (const link of links) {
    if (link.entityKind === "person") {
      const name = await store.getPersonName(link.entityId);
      if (name) personNames.push(name);
    } else {
      const title = await store.getProjectTitle(link.entityId);
      if (title) projectTitles.push(title);
    }
  }
  return { personNames, projectTitles };
}

export async function composeInboxViews(
  store: HumanSourceStore,
): Promise<InboxSourceView[]> {
  const sources = await store.listSources();
  const views: InboxSourceView[] = [];
  for (const source of sources) {
    const names = await resolveLinkNames(store, source.id);
    views.push({
      id: source.id,
      sourceType: source.sourceType,
      ingestedAt: source.ingestedAt,
      capturedAt: source.capturedAt,
      communicationType: source.reportedCommunicationType,
      reviewStatus: source.reviewStatus,
      personNames: names.personNames,
      projectTitles: names.projectTitles,
      preview: sourcePreview(source.rawText),
      founderReported: isFounderReportedProvenance(
        source.reportedCommunicationType,
      ),
    });
  }
  return views;
}

export async function composeSourceDetail(
  store: HumanSourceStore,
  sourceId: string,
): Promise<HumanSourceDetailView | null> {
  const source = await store.getSource(sourceId);
  if (!source) return null;
  const names = await resolveLinkNames(store, source.id);
  return {
    source,
    personNames: names.personNames,
    projectTitles: names.projectTitles,
    founderReported: isFounderReportedProvenance(
      source.reportedCommunicationType,
    ),
  };
}
