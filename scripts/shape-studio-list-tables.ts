const url = `${process.env.SUPABASE_URL}/rest/v1/`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const res = await fetch(url, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
const text = await res.text();
const tables = [...text.matchAll(/\/shape[^"\s]*/gi)].map((m) => m[0]);
console.log("status", res.status);
console.log("shape paths", [...new Set(tables)]);
