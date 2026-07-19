import Header from "../shared-components/Header";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-hg-ivory text-hg-ink">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header />
      </div>

      <section className="mx-auto max-w-[760px] px-6 py-20 md:px-10 md:py-28">
        
        <div className="mb-10 text-[11px] uppercase tracking-[0.28em] text-[#8a8178]">
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

        </div>
      </section>
    </div>
  );
}