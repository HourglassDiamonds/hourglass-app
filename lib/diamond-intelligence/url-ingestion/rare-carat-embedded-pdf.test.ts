import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractEmbeddedHttpsPdfUrl,
  isRareCaratCdnPngWrapper,
  resolveRareCaratReportFetchUrl,
} from "./rare-carat-embedded-pdf";

const CLOUDFRONT_WRAPPER =
  "https://cldnr.rarecarat.com/rarecarat/image/fetch/f_png,w_2001/https://dnyvsyhu34v1w.cloudfront.net/pdf/LG772665975.pdf";

const MEDIA_CERT_WRAPPER =
  "https://cldnr.rarecarat.com/rarecarat/image/fetch/f_png,w_2001/https://media.rarecarat.com/certificate/nfKX7hpitZUwcZlfpiFn0XpTjZCxvoRPpJUyRuWOU.pdf";

const CLOUDFRONT_PDF =
  "https://dnyvsyhu34v1w.cloudfront.net/pdf/LG772665975.pdf";

const MEDIA_CERT_PDF =
  "https://media.rarecarat.com/certificate/nfKX7hpitZUwcZlfpiFn0XpTjZCxvoRPpJUyRuWOU.pdf";

describe("isRareCaratCdnPngWrapper", () => {
  it("detects Rare Carat CDN PNG wrappers", () => {
    assert.equal(isRareCaratCdnPngWrapper(CLOUDFRONT_WRAPPER), true);
    assert.equal(isRareCaratCdnPngWrapper(MEDIA_CERT_WRAPPER), true);
  });

  it("rejects non-wrapper URLs", () => {
    assert.equal(isRareCaratCdnPngWrapper(CLOUDFRONT_PDF), false);
    assert.equal(
      isRareCaratCdnPngWrapper(
        "https://cdn.jamesallen.com/reports/123.pdf",
      ),
      false,
    );
    assert.equal(isRareCaratCdnPngWrapper("not-a-url"), false);
  });
});

describe("extractEmbeddedHttpsPdfUrl", () => {
  it("unwraps cloudfront.net/pdf embedded PDF (153914979 pattern)", () => {
    assert.equal(extractEmbeddedHttpsPdfUrl(CLOUDFRONT_WRAPPER), CLOUDFRONT_PDF);
  });

  it("unwraps media.rarecarat.com/certificate embedded PDF (147275937 pattern)", () => {
    assert.equal(extractEmbeddedHttpsPdfUrl(MEDIA_CERT_WRAPPER), MEDIA_CERT_PDF);
  });

  it("does not unwrap non-PDF embedded targets", () => {
    const htmlWrapper =
      "https://cldnr.rarecarat.com/rarecarat/image/fetch/f_png,w_2001/https://www.igi.org/verify.html";
    assert.equal(extractEmbeddedHttpsPdfUrl(htmlWrapper), null);
  });

  it("does not unwrap http embedded PDF URLs", () => {
    const httpWrapper =
      "https://cldnr.rarecarat.com/rarecarat/image/fetch/f_png,w_2001/http://media.rarecarat.com/certificate/test.pdf";
    assert.equal(extractEmbeddedHttpsPdfUrl(httpWrapper), null);
  });

  it("returns null for malformed wrapper URLs without embedded PDF", () => {
    assert.equal(
      extractEmbeddedHttpsPdfUrl(
        "https://cldnr.rarecarat.com/rarecarat/image/fetch/f_png,w_2001/",
      ),
      null,
    );
    assert.equal(
      extractEmbeddedHttpsPdfUrl("https://cldnr.rarecarat.com/rarecarat/image/"),
      null,
    );
  });
});

describe("resolveRareCaratReportFetchUrl", () => {
  it("unwraps for rare-carat vendor", () => {
    const result = resolveRareCaratReportFetchUrl(
      "rare-carat",
      CLOUDFRONT_WRAPPER,
    );
    assert.equal(result.unwrapped, true);
    assert.equal(result.fetchUrl, CLOUDFRONT_PDF);
  });

  it("does not unwrap for non-rare-carat vendors", () => {
    const jamesAllenLike =
      "https://cldnr.rarecarat.com/rarecarat/image/fetch/f_png,w_2001/https://dnyvsyhu34v1w.cloudfront.net/pdf/LG772665975.pdf";
    const result = resolveRareCaratReportFetchUrl(
      "james-allen",
      jamesAllenLike,
    );
    assert.equal(result.unwrapped, false);
    assert.equal(result.fetchUrl, jamesAllenLike);
  });

  it("falls back to wrapper when embedded URL fails safety checks", () => {
    const privateEmbedded =
      "https://cldnr.rarecarat.com/rarecarat/image/fetch/f_png,w_2001/https://127.0.0.1/report.pdf";
    const result = resolveRareCaratReportFetchUrl(
      "rare-carat",
      privateEmbedded,
    );
    assert.equal(result.unwrapped, false);
    assert.equal(result.fetchUrl, privateEmbedded);
  });

  it("falls back to wrapper for malformed URLs", () => {
    const malformed =
      "https://cldnr.rarecarat.com/rarecarat/image/fetch/f_png,w_2001/not-a-pdf";
    const result = resolveRareCaratReportFetchUrl("rare-carat", malformed);
    assert.equal(result.unwrapped, false);
    assert.equal(result.fetchUrl, malformed);
  });
});

describe("listing report URL fixtures", () => {
  it("153914979 unwraps to cloudfront PDF", () => {
    const wrapper =
      "https://cldnr.rarecarat.com/rarecarat/image/fetch/f_png,w_2001/https://dnyvsyhu34v1w.cloudfront.net/pdf/LG772665975.pdf";
    const resolved = resolveRareCaratReportFetchUrl("rare-carat", wrapper);
    assert.equal(resolved.unwrapped, true);
    assert.match(resolved.fetchUrl, /cloudfront\.net\/pdf\/LG772665975\.pdf$/);
  });

  it("147275937 unwraps to media.rarecarat.com certificate PDF", () => {
    const wrapper =
      "https://cldnr.rarecarat.com/rarecarat/image/fetch/f_png,w_2001/https://media.rarecarat.com/certificate/nfKX7hpitZUwcZlfpiFn0XpTjZCxvoRPpJUyRuWOU.pdf";
    const resolved = resolveRareCaratReportFetchUrl("rare-carat", wrapper);
    assert.equal(resolved.unwrapped, true);
    assert.match(
      resolved.fetchUrl,
      /media\.rarecarat\.com\/certificate\/nfKX7hpitZUwcZlfpiFn0XpTjZCxvoRPpJUyRuWOU\.pdf$/,
    );
  });
});
