import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo/site-metadata";
import Header from "../shared-components/Header";

export const metadata: Metadata = pageMetadata({
  title: "Privacy",
  description:
    "How Hourglass Diamonds handles information shared through this site, including consultation details, visualization tools, analytics, and authorized Google account data used by Continuum.",
  path: "/privacy",
});

const LEGAL_LINK =
  "underline decoration-[#c4b8a8] underline-offset-4 transition-colors hover:text-[#1f1d1a]";

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
            improve how Hourglass Diamonds serves clients. We do not sell or
            rent your personal information. We share information with service
            providers only as needed to operate the services described below.
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
              automated processing, including optical character recognition.
              What we keep for that work can include the original file, the
              source filename, listing or report URLs you provide, extracted
              text, and related interpretation metadata. Those files and
              records are stored privately with Supabase and become eligible
              for automatic deletion after 30 days. A daily cleanup removes
              expired storage objects and the matching archive rows. Analyze
              Sparkle is informational guidance and does not replace the
              grading laboratory’s official report. Hourglass does not use
              your uploaded reports or photos to train a public AI model.
            </p>
            <p>
              When an optional remote OCR processor is configured, report
              images may be sent to that processor solely to extract text.
              We do not control that processor’s own logs, and we do not
              claim a deletion time there.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-[18px] font-medium leading-[1.35] text-[#1f1d1a]">
              Analytics
            </h2>
            <p>
              We use Google Analytics to understand how the public site is
              used, only after you choose to allow it. If you decline, analytics
              stays off. Your choice is remembered in this browser. You can
              change it later from Analytics in the site footer. Allowing
              analytics may include basic device and browser information, usage
              patterns, referral information, and interaction data. Google acts
              as a processor for this analytics data. Where configured, IP
              addresses are anonymized before analytics processing. Analytics
              events do not include your name, email, phone number, or the
              notes you write in consultation forms. A small first-party
              session record may retain campaign parameters (such as UTM
              values), the first landing path, referring site hostname, and
              where you last chose to begin a conversation—so we can respond
              with useful context. That session record is not used as a mailing
              list and is separate from Google Analytics. If you later decline
              analytics, this site stops sending new analytics events. Cookies
              already set by Google may remain until you clear them in your
              browser.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-[18px] font-medium leading-[1.35] text-[#1f1d1a]">
              Email This View
            </h2>
            <p>
              If you use Email This View in Diamond Studio, you share the email
              address the message should reach and, if you provide it, a first
              name, together with the configuration you asked us to send. We
              generate a temporary image of that view so it can be attached to
              the message. That image is created for delivery and is not kept
              as a permanent file on our systems after the send attempt
              finishes, whether it succeeds or fails. The email is sent through
              Resend. We keep a record of the send — including the email
              address, the name if provided, and the configuration — so we can
              recognize a later Concierge conversation from the same person by
              exact email match. That record is not marketing consent and does
              not create a sales inquiry.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-[18px] font-medium leading-[1.35] text-[#1f1d1a]">
              Video
            </h2>
            <p>
              The House film is delivered through Cloudinary so it can play on
              this site. Conversation films currently play through YouTube after
              you choose to start them. YouTube may collect viewing data
              according to Google’s policies once playback begins.
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
              See It On Your Hand and Analyze Sparkle, and Email This View send
              records), Google Analytics, Resend (email delivery), Cloudinary
              (The House film), YouTube (Conversation playback after you start
              a film), and Vercel (hosting and delivery of this site). An
              optional remote OCR processor may receive Analyze Sparkle report
              images when that path is enabled.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-[18px] font-medium leading-[1.35] text-[#1f1d1a]">
              Google Account and Gmail Data
            </h2>
            <p>
              Continuum is Hourglass Diamonds&apos; private business operating
              system. If an authorized Hourglass user connects a Google account
              to Continuum, Hourglass may access Gmail using Google&apos;s
              read-only Gmail permission. That access is used to organize
              relevant business communication history, correlate communications
              with existing client and project records, and support private
              business workflow and reconstruction functions requested by the
              authorized account holder. A brief public description of Continuum
              is available on the{" "}
              <Link href="/continuum" className={LEGAL_LINK}>
                Continuum
              </Link>{" "}
              page.
            </p>
            <p>
              Continuum does not use this permission to send, modify, or delete
              Gmail messages.
            </p>
            <p>
              Mailbox-wide indexing is intentionally limited primarily to
              protected message metadata rather than storing the entire mailbox
              body corpus. When an authorized workflow requires examination of a
              specific communication or project thread, message content may be
              accessed on demand for that private business purpose.
            </p>
            <p>
              Gmail and Google data is not sold. It is not used for advertising.
              OAuth credentials and tokens are handled as protected server-side
              credentials and are not exposed publicly.
            </p>
            <p>
              The account connection can be disconnected by the authorized user.
              Disconnecting stops future Gmail access. Already-created legitimate
              business records are not silently destroyed merely because the
              connection is disconnected.
            </p>
            <p>
              Hourglass Diamonds&apos; use and transfer of information received
              from Google APIs will adhere to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                className={LEGAL_LINK}
              >
                Google API Services User Data Policy
              </a>
              {", "}
              including the Limited Use requirements.
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
                className={LEGAL_LINK}
              >
                justin@hourglassdiamonds.com
              </a>
              . Consultation records live in HubSpot. Analyze Sparkle uploads
              and extracted text live in Supabase until the 30-day cleanup, or
              sooner if we can process a deletion request. See It On Your Hand
              photos are already session-limited. Email This View images are
              not kept as files; send records can be removed on request.
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
