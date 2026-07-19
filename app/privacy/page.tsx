import Header from "../shared-components/Header";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-hg-ivory text-hg-ink">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header />
      </div>

      <section className="mx-auto max-w-[760px] px-6 py-20 md:px-10 md:py-28">
        <div className="mb-10 text-[11px] uppercase tracking-[0.28em] text-[#8a8178]">
          Privacy
        </div>

        <h1 className="mb-6 text-[32px] leading-[1.2] text-[#1f1d1a] md:text-[38px]">
          Your information is handled with care.
        </h1>

        <div className="space-y-6 text-[15px] leading-[1.7] text-[#4e463f]">
          <p>
            We keep things simple. Information shared through this site is used
            only to respond thoughtfully and guide the design process.
          </p>

          <p>
            We do not sell, rent, or distribute personal information. Details
            you provide through the Concierge form remain private and are used
            solely to understand your project and communicate clearly.
          </p>

          <p>
            Inspiration and reference images are not collected through the
            Concierge form. When images are shared later in a private
            conversation, they are handled with care and are never used
            publicly without permission.
          </p>

          <p>
            Basic analytics may be used to understand how the site is used.
            Analytics events do not include your name, email, phone number, or
            the notes you write. A small first-party session record may retain
            campaign parameters (such as UTM values), the first landing path,
            referring site hostname, and where you last chose to begin a
            conversation—so we can respond with useful context. That session
            record is not used as a mailing list.
          </p>

          <p>
            If you have any questions about how information is handled, you’re
            welcome to reach out directly.
          </p>
        </div>
      </section>
    </div>
  );
}
