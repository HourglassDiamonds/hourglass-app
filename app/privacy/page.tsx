import Header from "../shared-components/Header";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-hg-ivory text-hg-ink">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header />
      </div>

      <section className="mx-auto max-w-[760px] px-6 py-20 md:px-10 md:py-28">
        <div className="mb-10 text-[11px] uppercase tracking-[0.28em] text-[#6d655e]">
          Privacy
        </div>

        <h1 className="mb-6 text-[32px] leading-[1.2] text-[#1f1d1a] md:text-[38px]">
          Your information is handled with care.
        </h1>

        <div className="space-y-10 text-[15px] leading-[1.7] text-[#4e463f]">
          <p>
            We keep things simple. Information shared through this site is used
            to respond thoughtfully, create the experiences you request, and
            improve how Hourglass Diamonds serves clients. We do not sell, rent,
            or distribute personal information.
          </p>

          <div className="space-y-4">
            <h2 className="text-[18px] font-medium leading-[1.35] text-[#1f1d1a]">
              Consultation information
            </h2>
            <p>
              When you reach out through Concierge or a similar consultation
              form, you may share your name, email, phone number, and project
              details. We use HubSpot as our CRM to process those submissions so
              we can follow up and provide client service. Retention follows
              ordinary business and CRM needs. You may request access to, or
              deletion of, consultation information by contacting us using the
              details below. We do not promise automatic deletion from HubSpot
              without a request we can process.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-[18px] font-medium leading-[1.35] text-[#1f1d1a]">
              See It On Your Hand
            </h2>
            <p>
              See It On Your Hand lets you upload a photo of your hand so we can
              create the visualization you request. Photos are stored privately
              with Supabase. Capture sessions expire after 30 minutes. Photos are
              deleted when they are used for the visualization, when you cancel,
              or when the session expires. A daily cleanup provides an additional
              backstop so unclaimed photos are removed within about 24 hours.
              Temporary signed access may be used so the visualization can be
              retrieved for a limited time. Please avoid showing financial cards,
              government IDs, or other sensitive personal information in the
              photo.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-[18px] font-medium leading-[1.35] text-[#1f1d1a]">
              Analyze Sparkle
            </h2>
            <p>
              Analyze Sparkle (Diamond Intelligence) lets you upload a grading
              report as a PDF or image, or provide a supported report or listing
              URL. The system may extract text and grading details through
              automated processing. Submission files and associated extracted
              data become eligible for automatic deletion after 30 days.
              Analyze Sparkle is informational guidance and does not replace the
              grading laboratory’s official report.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-[18px] font-medium leading-[1.35] text-[#1f1d1a]">
              Analytics
            </h2>
            <p>
              We use Google Analytics to understand how the site is used. This
              may include basic device and browser information, usage patterns,
              referral information, and interaction data. Google acts as a
              processor for this analytics data. Where configured, IP addresses
              are anonymized before analytics processing. Analytics events do
              not include your name, email, phone number, or the notes you write
              in consultation forms. A small first-party session record may
              retain campaign parameters (such as UTM values), the first landing
              path, referring site hostname, and where you last chose to begin a
              conversation—so we can respond with useful context. That session
              record is not used as a mailing list.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-[18px] font-medium leading-[1.35] text-[#1f1d1a]">
              Video
            </h2>
            <p>
              On Conversation pages, Mux may process video playback and related
              technical usage data so stories and films can play reliably.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-[18px] font-medium leading-[1.35] text-[#1f1d1a]">
              Service providers
            </h2>
            <p>
              Depending on how you use the site, information may be processed by
              service providers that help us operate, including HubSpot
              (consultation CRM), Supabase (private storage for features such as
              See It On Your Hand and Analyze Sparkle), Google Analytics, Mux
              (Conversation video), and Vercel (hosting and delivery of this
              site).
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-[18px] font-medium leading-[1.35] text-[#1f1d1a]">
              Your rights and how to reach us
            </h2>
            <p>
              You may contact us to ask about access, correction, or deletion of
              personal information, or with any privacy question. Email{" "}
              <a
                href="mailto:justin@hourglassdiamonds.com"
                className="underline decoration-[#c4b8a8] underline-offset-4 transition-colors hover:text-[#1f1d1a]"
              >
                justin@hourglassdiamonds.com
              </a>
              .
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-[18px] font-medium leading-[1.35] text-[#1f1d1a]">
              Children
            </h2>
            <p>
              This site is not directed to children under 13. It is intended for
              people researching jewelry or engaging Hourglass Diamonds
              services.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
