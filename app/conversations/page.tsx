import { notFound } from "next/navigation";
import JsonLd from "@/app/shared-components/JsonLd";
import {
  getListableEpisodes,
  isConversationsHubPublic,
  isProductionRuntime,
} from "@/lib/conversations/episodes";
import { conversationsHubMetadata } from "@/lib/seo/conversations-metadata";
import { buildConversationsHubJsonLd } from "@/lib/seo/schema/conversations";
import ConversationsHubClient from "./conversations-hub-client";

export const metadata = conversationsHubMetadata();

export default function ConversationsHubPage() {
  // Production: hub stays unavailable until a published episode exists.
  if (isProductionRuntime() && !isConversationsHubPublic()) {
    notFound();
  }

  const episodes = getListableEpisodes();
  if (episodes.length === 0) {
    notFound();
  }

  return (
    <>
      {isConversationsHubPublic() ? (
        <JsonLd data={buildConversationsHubJsonLd()} />
      ) : null}
      <ConversationsHubClient episodes={episodes} />
    </>
  );
}
