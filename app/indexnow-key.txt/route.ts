import { isValidIndexNowKey } from "@/lib/seo/indexnow-core";

export async function GET() {
  const configuredKey = (process.env.INDEXNOW_KEY ?? "").trim();

  if (!isValidIndexNowKey(configuredKey)) {
    return new Response("Not Found", { status: 404 });
  }

  return new Response(configuredKey, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
