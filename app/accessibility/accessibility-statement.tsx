const STATEMENT_LINK =
  "underline decoration-[#c4b8a8] underline-offset-4 transition-colors hover:text-[#1f1d1a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#987648]";

export default function AccessibilityStatement() {
  return (
    <div className="min-h-screen bg-hg-ivory text-hg-ink">
      <section className="mx-auto max-w-[760px] px-6 py-20 md:px-10 md:py-28">
        <p className="mb-10 text-[11px] uppercase tracking-[0.28em] text-[#6d655e]">
          Accessibility
        </p>
        <h1 className="mb-6 text-[32px] leading-[1.2] text-[#1f1d1a] md:text-[38px]">
          Accessibility at Hourglass Diamonds
        </h1>
        <div className="space-y-6 text-[15px] leading-[1.7] text-[#4e463f]">
          <p>
            Hourglass Diamonds is committed to providing a thoughtful and
            accessible digital experience. We are working toward conformance
            with WCAG 2.1 and WCAG 2.2 Level AA where reasonably applicable,
            and we continue to improve the accessibility of our website and
            digital tools.
          </p>
          <p>
            If you encounter an accessibility barrier, please email{" "}
            <a
              className={STATEMENT_LINK}
              href="mailto:justin@hourglassdiamonds.com"
            >
              justin@hourglassdiamonds.com
            </a>
            . Please include the page or feature involved, what you were trying
            to do, and—if you are comfortable sharing it—the browser, device,
            or assistive technology you were using. We will review the issue
            and work toward an appropriate response.
          </p>
          <p>
            Some third-party content and services may have accessibility
            limitations outside our direct control. We still welcome reports
            about those experiences so we can evaluate available alternatives.
          </p>
        </div>
      </section>
    </div>
  );
}
