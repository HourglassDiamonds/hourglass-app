const base = process.argv[2] ?? "http://localhost:3000";

const img = await fetch(`${base}/og/diamond-studio-og.jpg`, { method: "HEAD" });
console.log("image", img.status, img.headers.get("content-type"));

const page = await fetch(`${base}/diamond-studio`);
const html = await page.text();

for (const tag of [
  "og:image",
  "og:title",
  "og:description",
  "twitter:image",
  "twitter:card",
]) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)="${tag}"[^>]*>`,
    "g",
  );
  const matches = html.match(re);
  console.log(`${tag}:`, matches?.join("\n") ?? "NOT FOUND");
}
