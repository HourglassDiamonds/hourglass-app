import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { loadPublicDigitalCard } from "@/lib/continuum/digital-card/public-load";
import { parseSlug } from "@/lib/continuum/digital-card/parse";
import { buildPublicVcard, vcardFilename } from "@/lib/continuum/digital-card/vcard";
import {
  checkDigitalCardReadRateLimit,
  getDigitalCardClientIp,
} from "@/lib/continuum/digital-card/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const headerList = await headers();
  const limited = checkDigitalCardReadRateLimit(getDigitalCardClientIp(headerList));
  if (!limited.allowed) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfterSeconds) },
    });
  }

  const { slug } = await context.params;
  const parsed = parseSlug(slug);
  if (!parsed.ok) notFound();

  const result = await loadPublicDigitalCard(parsed.slug);
  if (result.status !== "found") notFound();

  const body = buildPublicVcard(result.card);
  const filename = vcardFilename(result.card.displayName);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
