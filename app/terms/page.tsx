import Header from "../shared-components/Header";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-hg-ivory text-hg-ink">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header />
      </div>

      <section className="mx-auto max-w-[760px] px-6 py-20 md:px-10 md:py-28">
        
        <div className="mb-10 text-[11px] uppercase tracking-[0.28em] text-[#6d655e]">
          Terms
        </div>

        <h1 className="mb-6 text-[32px] leading-[1.2] text-[#1f1d1a] md:text-[38px]">
          Clear expectations, handled simply.
        </h1>

        <div className="space-y-6 text-[15px] leading-[1.7] text-[#4e463f]">
          
          <p>
            This site is intended to provide guidance and a starting point for
            private design conversations. Information is presented thoughtfully,
            but final decisions are always made through direct consultation.
          </p>

          <p>
            Each piece is custom or carefully sourced. Timelines, pricing, and
            availability are discussed individually and may vary depending on
            the specifics of each project.
          </p>

          <p>
            By using this site, you understand that all designs, imagery, and
            written content are the property of Hourglass Diamonds and may not
            be reused without permission.
          </p>

          <p>
            We aim to keep everything clear and straightforward. If anything
            feels unclear, the best approach is simply to ask.
          </p>

          <div className="space-y-4 border-t border-[#d4c9bb] pt-6">
            <h2 className="text-[18px] font-medium leading-[1.35] text-[#1f1d1a]">
              Ledger data providers
            </h2>
            <p>
              The Hourglass Ledger uses public economic and energy data from
              government and public-data APIs. This product uses the Bureau of
              Economic Analysis (BEA) Data API but is not endorsed or certified
              by BEA. This product uses the FRED® API but is not endorsed or
              certified by the Federal Reserve Bank of St. Louis. EIA data is
              identified as originating from the U.S. Energy Information
              Administration, without implying endorsement.
            </p>
            <p>
              By using the Ledger, you agree to be bound by the {" "}
              <a
                href="https://fred.stlouisfed.org/docs/api/terms_of_use.html"
                className="underline decoration-[#c4b8a8] underline-offset-4"
              >
                FRED® API Terms of Use
              </a>
              . Data series may also be subject to the rights and restrictions
              of their originating providers. Hourglass preserves provider and
              source references with each Ledger publication.
            </p>
          </div>

        </div>
      </section>
    </div>
  );
}
