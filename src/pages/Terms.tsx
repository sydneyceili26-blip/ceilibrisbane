import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const Terms = () => {
  useEffect(() => { document.title = "Terms & Conditions - Céilí Brisbane"; }, []);
  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <SiteHeader />
      <main className="container flex-1 py-10">
        <div className="mx-auto max-w-3xl">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <h1 className="mt-4 font-display text-3xl font-bold md:text-4xl">Terms & Conditions</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: 28 May 2026</p>

          <div className="prose prose-sm mt-8 max-w-none text-foreground">
            <h2>1. Introduction</h2>
            <p>
              These Terms & Conditions ("Terms") govern your access to and use of Céilí Brisbane
              (the "Platform"), operated from New South Wales, Australia. By creating an account,
              posting a listing, contacting another user, or otherwise using the Platform, you
              agree to be bound by these Terms. If you do not agree, you must not use the Platform.
            </p>

            <h2>2. Nature of the service</h2>
            <p>
              The Platform is an online marketplace and connection service that allows users to
              post and view listings for accommodation, vehicles, jobs, items for sale, services,
              events, sports and wellness activities, and similar categories.
            </p>
            <p>
              Céilí Brisbane is <strong>only a venue</strong> that connects users with one another.
              We are not a party to any agreement, transaction, tenancy, employment relationship,
              sale, hire, or other arrangement entered into between users or with any third party,
              and we do not act as an agent, broker, employer, landlord, escrow, or insurer.
            </p>

            <h2>3. No verification of listings or users</h2>
            <p>
              We do not screen, verify, endorse, vet, or perform background checks on users,
              listings, prices, qualifications, identities, ownership, licences, insurance,
              accreditations, immigration status, or any other information provided through the
              Platform. Listings are created and controlled solely by the users who post them.
            </p>

            <h2>4. User responsibilities</h2>
            <p>By using the Platform you agree that you will:</p>
            <ul>
              <li>be at least 18 years of age, or have the consent of a parent or guardian;</li>
              <li>provide accurate, current and lawful information in your account and listings;</li>
              <li>comply with all applicable Australian Commonwealth, State and Territory laws,
                including consumer law, residential tenancy law, employment and work-health-and-safety
                law, road and vehicle regulations, anti-discrimination law, and tax obligations;</li>
              <li>conduct your own due diligence before meeting, paying, engaging, hiring,
                renting from or otherwise transacting with any other user;</li>
              <li>not post content that is unlawful, misleading, deceptive, fraudulent, defamatory,
                harassing, hateful, infringing, sexually explicit, or that promotes scams, illegal
                goods, weapons, drugs, or unsafe practices;</li>
              <li>not impersonate any person, misrepresent your affiliation, or post on another
                person's behalf without their authority;</li>
              <li>not scrape, reverse engineer, overload, disrupt or attempt to gain unauthorised
                access to the Platform or its users; and</li>
              <li>be solely responsible for all activity that occurs under your account and for
                keeping your credentials secure.</li>
            </ul>

            <h2>5. Dealings between users - your own risk</h2>
            <p>
              You acknowledge and agree that you engage with listings, posters, respondents and
              any third parties introduced through the Platform <strong>entirely at your own risk</strong>.
              You are solely responsible for evaluating the suitability, safety, legality and
              quality of any accommodation, vehicle, job, item, service, event or activity, and
              for any arrangement you choose to enter into.
            </p>
            <p>
              We strongly recommend that you meet in safe public places, never transfer money for
              items, bonds or deposits you have not inspected in person, verify the identity and
              credentials of the other party, and obtain independent legal, financial, tax or
              professional advice where appropriate.
            </p>

            <h2>6. No warranty</h2>
            <p>
              The Platform is provided on an "as is" and "as available" basis. To the maximum
              extent permitted by law, we make no representations or warranties of any kind,
              express or implied, including (without limitation) as to the accuracy, currency,
              completeness, reliability, availability, fitness for purpose, merchantability, or
              non-infringement of any listing, content, or the Platform itself. We do not
              guarantee that the Platform will be uninterrupted, secure, or error-free.
            </p>
            <p>
              Nothing in these Terms excludes, restricts or modifies any consumer guarantee,
              right or remedy that cannot lawfully be excluded under the Australian Consumer Law
              or other applicable laws.
            </p>

            <h2>7. Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, Céilí Brisbane, its operators, owners,
              directors, employees, contractors, agents and affiliates (the "Released Parties")
              exclude all liability for any loss, damage, cost, expense, injury, illness, death,
              claim or demand of any kind - whether direct, indirect, incidental, special,
              consequential, punitive or exemplary, and whether arising in contract, tort
              (including negligence), under statute or otherwise - arising out of or in connection
              with:
            </p>
            <ul>
              <li>your access to or use of, or inability to use, the Platform;</li>
              <li>any listing, content, communication or information posted on or transmitted
                through the Platform;</li>
              <li>any interaction, dispute, transaction, tenancy, employment, sale, hire,
                meeting, event or other dealing with any other user or third party;</li>
              <li>any fraud, scam, theft, misrepresentation, property damage, personal injury,
                financial loss, lost profits, lost data, or business interruption; and</li>
              <li>any unauthorised access to or alteration of your account, content, or
                transmissions.</li>
            </ul>
            <p>
              Where liability cannot lawfully be excluded, our total aggregate liability to you
              for all claims arising out of or in connection with the Platform is limited, at our
              option, to the resupply of the relevant service or the cost of having the relevant
              service resupplied.
            </p>

            <h2>8. Indemnity</h2>
            <p>
              You agree to indemnify, defend and hold harmless the Released Parties from and
              against any and all claims, liabilities, damages, losses, judgments, fines, penalties,
              costs and expenses (including reasonable legal fees on a solicitor-client basis)
              arising out of or in any way connected with:
            </p>
            <ul>
              <li>your use of the Platform;</li>
              <li>any listing or content you post, send or otherwise make available;</li>
              <li>your breach of these Terms or any applicable law; or</li>
              <li>your interaction, transaction or dispute with any other user or third party.</li>
            </ul>

            <h2>9. Content moderation and account termination</h2>
            <p>
              <strong>Céilí Brisbane has zero tolerance for objectionable content or abusive users.</strong>{" "}
              Content that is harmful, offensive, sexually explicit, hateful, threatening, or
              otherwise objectionable will be removed and the responsible account will be suspended
              or permanently banned. We aim to act on all reports within 24 hours of receipt.
            </p>
            <p>
              We may, at our sole discretion and without notice, remove, edit, refuse or
              restrict any listing, message or account, and suspend or terminate access to the
              Platform, for any reason - including suspected breach of these Terms, suspected
              unlawful conduct, or complaints from other users or third parties.
            </p>
            <p>
              Users may report objectionable content using the <strong>Report</strong> button
              on any listing, and may block abusive users to immediately remove their content
              from view. Blocking a user notifies our moderation team for review.
            </p>

            <h2>10. Privacy</h2>
            <p>
              Our handling of personal information is described in our{" "}
              <Link to="/privacy">Privacy Policy</Link>, which forms part of these Terms.
            </p>

            <h2>11. Changes to these Terms</h2>
            <p>
              We may update these Terms from time to time. The "Last updated" date at the top of
              this page shows when the Terms were last changed. Your continued use of the Platform
              after a change takes effect constitutes acceptance of the updated Terms.
            </p>

            <h2>12. Governing law and jurisdiction</h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of New South
              Wales, Australia. You and we irrevocably submit to the exclusive jurisdiction of
              the courts of New South Wales and the courts competent to hear appeals from them
              in respect of any dispute arising out of or in connection with these Terms or the
              Platform.
            </p>

            <h2>13. Severability</h2>
            <p>
              If any provision of these Terms is held to be invalid or unenforceable, that
              provision will be severed to the minimum extent necessary and the remaining
              provisions will continue in full force and effect.
            </p>

            <h2>14. Contact</h2>
            <p>
              Questions about these Terms? <Link to="/community">Reach us through the community Q&amp;A</Link>.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Terms;
