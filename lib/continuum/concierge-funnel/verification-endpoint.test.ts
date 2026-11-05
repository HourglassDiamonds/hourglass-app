import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createControlledAcceptanceVerificationHandler } from "./verification-endpoint";

function request(site = "same-origin") {
  return new Request(
    "https://preview.example.test/executive-dashboard/concierge/preview-acceptance-control/verify",
    { headers: { "sec-fetch-site": site } },
  );
}

describe("controlled acceptance verification endpoint", () => {
  it("fails closed when disabled, cross-origin or unauthenticated", async () => {
    let verified = 0;
    const verify = async () => {
      verified += 1;
      return { ok: true };
    };
    const disabled = createControlledAcceptanceVerificationHandler({
      enabled: () => false,
      authorize: async () => true,
      verify,
    });
    assert.equal((await disabled(request())).status, 404);

    const protectedHandler = createControlledAcceptanceVerificationHandler({
      enabled: () => true,
      authorize: async () => false,
      verify,
    });
    assert.equal((await protectedHandler(request("cross-site"))).status, 403);
    assert.equal((await protectedHandler(request())).status, 401);
    assert.equal(verified, 0);
  });

  it("returns private no-store verification only after authorization", async () => {
    const handler = createControlledAcceptanceVerificationHandler({
      enabled: () => true,
      authorize: async () => true,
      verify: async () => ({ ok: true, counts: { intakes: 1 } }),
    });
    const result = await handler(request());
    assert.equal(result.status, 200);
    assert.equal(result.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await result.json(), { ok: true, counts: { intakes: 1 } });
  });
});
