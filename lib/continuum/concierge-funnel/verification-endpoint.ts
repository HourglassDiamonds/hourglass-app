const PRIVATE_HEADERS = {
  "cache-control": "private, no-store",
  "x-content-type-options": "nosniff",
} as const;

export function createControlledAcceptanceVerificationHandler(deps: {
  enabled(): boolean;
  authorize(request: Request): Promise<boolean>;
  verify(): Promise<object>;
}) {
  return async function GET(request: Request): Promise<Response> {
    if (!deps.enabled()) {
      return Response.json({ ok: false, error: "not-found" }, { status: 404, headers: PRIVATE_HEADERS });
    }
    if (request.headers.get("sec-fetch-site") !== "same-origin") {
      return Response.json({ ok: false, error: "invalid-origin" }, { status: 403, headers: PRIVATE_HEADERS });
    }
    if (!(await deps.authorize(request))) {
      return Response.json({ ok: false, error: "unauthorized" }, { status: 401, headers: PRIVATE_HEADERS });
    }
    try {
      return Response.json(await deps.verify(), { status: 200, headers: PRIVATE_HEADERS });
    } catch {
      return Response.json(
        { ok: false, error: "verification-unavailable" },
        { status: 503, headers: PRIVATE_HEADERS },
      );
    }
  };
}
