import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import {
  isBlockedIpAddress,
  isPdfOrReportUrl,
  resolveAndValidateRemoteUrl,
  setRemoteDnsLookupForTests,
  validateListingUrl,
  validateRedirectTarget,
} from "./url-safety";

describe("validateListingUrl", () => {
  it("accepts public https retailer urls", () => {
    const result = validateListingUrl(
      "https://www.jamesallen.com/loose-diamonds/round/123",
    );
    assert.equal(result.ok, true);
  });

  it("rejects http even for public hosts", () => {
    const result = validateListingUrl("http://www.jamesallen.com/diamond");
    assert.equal(result.ok, false);
  });

  it("rejects localhost and loopback, including case and trailing-dot forms", () => {
    assert.equal(validateListingUrl("https://localhost/diamond").ok, false);
    assert.equal(validateListingUrl("https://LOCALHOST/diamond").ok, false);
    assert.equal(validateListingUrl("https://localhost./diamond").ok, false);
    assert.equal(validateListingUrl("https://LocalHost./diamond").ok, false);
    assert.equal(validateListingUrl("https://127.0.0.1/diamond").ok, false);
    assert.equal(validateListingUrl("https://127.0.0.1./diamond").ok, false);
    assert.equal(validateListingUrl("https://[::1]/diamond").ok, false);
  });

  it("normalizes hostname case for public retailer URLs", () => {
    const result = validateListingUrl(
      "https://WWW.JAMESALLEN.COM/loose-diamonds/round/123",
    );
    assert.equal(result.ok, true);
  });

  it("rejects RFC1918, link-local, and metadata addresses", () => {
    assert.equal(validateListingUrl("https://192.168.1.10/diamond").ok, false);
    assert.equal(validateListingUrl("https://10.0.0.8/report.pdf").ok, false);
    assert.equal(validateListingUrl("https://172.16.4.4/report.pdf").ok, false);
    assert.equal(validateListingUrl("https://169.254.169.254/latest").ok, false);
    assert.equal(validateListingUrl("https://169.254.1.1/report").ok, false);
  });

  it("rejects non-http protocols", () => {
    assert.equal(validateListingUrl("file:///tmp/report.pdf").ok, false);
    assert.equal(validateListingUrl("data:text/html,hello").ok, false);
  });

  it("rejects empty input", () => {
    assert.equal(validateListingUrl("   ").ok, false);
  });
});

describe("isPdfOrReportUrl", () => {
  it("detects pdf and certificate urls", () => {
    assert.equal(
      isPdfOrReportUrl("https://cdn.example.com/reports/123.pdf"),
      true,
    );
    assert.equal(
      isPdfOrReportUrl("https://cdn.example.com/certificate/123"),
      true,
    );
    assert.equal(isPdfOrReportUrl("https://cdn.example.com/image.jpg"), false);
  });
});

describe("blocked destination IPs", () => {
  it("rejects loopback, private, link-local, unique-local, and metadata literals", () => {
    assert.equal(isBlockedIpAddress("127.0.0.1"), true);
    assert.equal(isBlockedIpAddress("::1"), true);
    assert.equal(isBlockedIpAddress("10.1.2.3"), true);
    assert.equal(isBlockedIpAddress("192.168.0.1"), true);
    assert.equal(isBlockedIpAddress("169.254.169.254"), true);
    assert.equal(isBlockedIpAddress("fe80::1"), true);
    assert.equal(isBlockedIpAddress("fc00::1"), true);
    assert.equal(isBlockedIpAddress("fd12:3456:789a::1"), true);
    assert.equal(isBlockedIpAddress("8.8.8.8"), false);
    assert.equal(isBlockedIpAddress("2001:4860:4860::8888"), false);
  });

  it("rejects IPv4-mapped IPv6 loopback and RFC1918 forms", () => {
    assert.equal(isBlockedIpAddress("::ffff:127.0.0.1"), true);
    assert.equal(isBlockedIpAddress("::ffff:10.0.0.1"), true);
    assert.equal(isBlockedIpAddress("::ffff:192.168.1.1"), true);
    assert.equal(isBlockedIpAddress("::ffff:172.16.4.4"), true);
    assert.equal(isBlockedIpAddress("::ffff:7f00:1"), true);
    assert.equal(isBlockedIpAddress("::ffff:a00:1"), true);
    assert.equal(isBlockedIpAddress("::ffff:c0a8:1"), true);
    assert.equal(isBlockedIpAddress("::ffff:8.8.8.8"), false);
  });
});

describe("redirect target re-validation", () => {
  it("rejects protocol downgrade and private hop", () => {
    assert.equal(
      validateRedirectTarget(
        "http://cdn.example.com/report.pdf",
        "https://www.example.com/listing",
      ).ok,
      false,
    );
    assert.equal(
      validateRedirectTarget(
        "https://127.0.0.1/report.pdf",
        "https://example.com/a",
      ).ok,
      false,
    );
  });

  it("allows a public https hop", () => {
    const result = validateRedirectTarget(
      "https://cdn.example.com/report.pdf",
      "https://www.example.com/listing",
    );
    assert.equal(result.ok, true);
  });
});

describe("resolveAndValidateRemoteUrl DNS checks", () => {
  afterEach(() => {
    setRemoteDnsLookupForTests(null);
  });

  it("allows a hostname that resolves to public IPv4 only", async () => {
    setRemoteDnsLookupForTests(async () => [{ address: "8.8.8.8", family: 4 }]);
    const result = await resolveAndValidateRemoteUrl(
      "https://www.jamesallen.com/loose-diamonds/round/123",
    );
    assert.equal(result.ok, true);
  });

  it("allows a hostname that resolves to public IPv6 only", async () => {
    setRemoteDnsLookupForTests(async () => [
      { address: "2001:4860:4860::8888", family: 6 },
    ]);
    const result = await resolveAndValidateRemoteUrl(
      "https://www.jamesallen.com/loose-diamonds/round/123",
    );
    assert.equal(result.ok, true);
  });

  it("rejects when any resolved address is RFC1918, even if the first is public", async () => {
    setRemoteDnsLookupForTests(async () => [
      { address: "8.8.8.8", family: 4 },
      { address: "10.0.0.8", family: 4 },
    ]);
    const result = await resolveAndValidateRemoteUrl(
      "https://mixed.example/report.pdf",
    );
    assert.equal(result.ok, false);
  });

  it("rejects when any resolved address is loopback, even if the first is public", async () => {
    setRemoteDnsLookupForTests(async () => [
      { address: "1.1.1.1", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);
    const result = await resolveAndValidateRemoteUrl(
      "https://mixed.example/report.pdf",
    );
    assert.equal(result.ok, false);
  });

  it("rejects mixed public A plus private AAAA", async () => {
    setRemoteDnsLookupForTests(async () => [
      { address: "8.8.8.8", family: 4 },
      { address: "fd12:3456:789a::1", family: 6 },
    ]);
    const result = await resolveAndValidateRemoteUrl(
      "https://mixed.example/report.pdf",
    );
    assert.equal(result.ok, false);
  });

  it("rejects IPv4-mapped IPv6 loopback and RFC1918 among resolved records", async () => {
    setRemoteDnsLookupForTests(async () => [
      { address: "8.8.8.8", family: 4 },
      { address: "::ffff:127.0.0.1", family: 6 },
    ]);
    assert.equal(
      (await resolveAndValidateRemoteUrl("https://mapped.example/a")).ok,
      false,
    );

    setRemoteDnsLookupForTests(async () => [
      { address: "8.8.8.8", family: 4 },
      { address: "::ffff:10.0.0.1", family: 6 },
    ]);
    assert.equal(
      (await resolveAndValidateRemoteUrl("https://mapped.example/b")).ok,
      false,
    );
  });

  it("rejects IPv6 loopback, link-local, and unique-local among resolved records", async () => {
    setRemoteDnsLookupForTests(async () => [
      { address: "2001:4860:4860::8888", family: 6 },
      { address: "::1", family: 6 },
    ]);
    assert.equal(
      (await resolveAndValidateRemoteUrl("https://v6.example/loopback")).ok,
      false,
    );

    setRemoteDnsLookupForTests(async () => [
      { address: "2001:4860:4860::8888", family: 6 },
      { address: "fe80::1", family: 6 },
    ]);
    assert.equal(
      (await resolveAndValidateRemoteUrl("https://v6.example/linklocal")).ok,
      false,
    );

    setRemoteDnsLookupForTests(async () => [
      { address: "2001:4860:4860::8888", family: 6 },
      { address: "fc00::1", family: 6 },
    ]);
    assert.equal(
      (await resolveAndValidateRemoteUrl("https://v6.example/uniquelocal")).ok,
      false,
    );
  });

  it("looks up the case-normalized hostname", async () => {
    let lookedUp = "";
    setRemoteDnsLookupForTests(async (hostname) => {
      lookedUp = hostname;
      return [{ address: "8.8.8.8", family: 4 }];
    });
    const result = await resolveAndValidateRemoteUrl(
      "https://WWW.JAMESALLEN.COM/loose-diamonds/round/123",
    );
    assert.equal(result.ok, true);
    assert.equal(lookedUp, "www.jamesallen.com");
  });

  it("strips trailing dots before DNS lookup", async () => {
    let lookedUp = "";
    setRemoteDnsLookupForTests(async (hostname) => {
      lookedUp = hostname;
      return [{ address: "8.8.8.8", family: 4 }];
    });
    const result = await resolveAndValidateRemoteUrl(
      "https://www.jamesallen.com./loose-diamonds/round/123",
    );
    assert.equal(result.ok, true);
    assert.equal(lookedUp, "www.jamesallen.com");
  });

  it("still rejects literal blocked IPs without DNS", async () => {
    let dnsCalls = 0;
    setRemoteDnsLookupForTests(async () => {
      dnsCalls += 1;
      return [{ address: "8.8.8.8", family: 4 }];
    });
    assert.equal(
      (await resolveAndValidateRemoteUrl("https://127.0.0.1/report.pdf")).ok,
      false,
    );
    assert.equal(
      (await resolveAndValidateRemoteUrl("https://[::ffff:10.0.0.1]/x")).ok,
      false,
    );
    assert.equal(dnsCalls, 0);
  });
});
