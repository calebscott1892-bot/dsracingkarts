import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | DS Racing Karts",
  description: "Privacy Policy for DS Racing Karts. How we collect, use and protect your personal information.",
};

export default function PrivacyPage() {
  return (
    <>
      <section className="relative bg-racing-black carbon-fiber py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h1 className="font-heading text-4xl md:text-5xl uppercase tracking-[0.1em] text-white mb-4">
            Privacy <span className="text-racing-red">Policy</span>
          </h1>
          <p className="text-white/50 text-sm">Last updated: April 2026</p>
        </div>
      </section>

      <div className="chequered-stripe" />

      <section className="max-w-3xl mx-auto px-4 py-12 md:py-16">
        <div className="prose-invert space-y-8 text-white/70 text-sm leading-relaxed">

          <div>
            <h2 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-3">1. Overview</h2>
            <p>
              DS Racing Karts (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is committed to protecting
              your personal information. This Privacy Policy explains how we collect, use, disclose and safeguard
              your information when you visit our website or engage with our services. We operate in accordance
              with the Australian Privacy Principles (APPs) under the <em>Privacy Act 1988</em> (Cth).
            </p>
          </div>

          <div>
            <h2 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-3">2. Information We Collect</h2>
            <p>We may collect the following types of personal information:</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-white/60">
              <li>Name, email address, and phone number (when you submit a contact form or place an order)</li>
              <li>Shipping address (for order fulfilment)</li>
              <li>Payment information (processed securely via Square — we do not store card details)</li>
              <li>Website usage data via cookies and analytics tools (e.g. Google Analytics)</li>
              <li>Any information you voluntarily provide via email, phone, or social media</li>
            </ul>
          </div>

          <div>
            <h2 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-3">3. How We Use Your Information</h2>
            <p>Personal information collected is used to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-white/60">
              <li>Process and fulfil your orders</li>
              <li>Respond to enquiries and provide customer support</li>
              <li>Send order confirmations and shipping updates</li>
              <li>Improve our website, products and services</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="mt-2">
              We will not send you marketing communications unless you have opted in (e.g. newsletter signup).
              You may unsubscribe at any time.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-3">4. Third-Party Services</h2>
            <p>We use the following third-party services that may process your data:</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-white/60">
              <li><strong className="text-white/80">Square</strong> — payment processing</li>
              <li><strong className="text-white/80">Google Analytics</strong> — website usage analytics</li>
              <li><strong className="text-white/80">Facebook</strong> — social media interaction</li>
            </ul>
            <p className="mt-2">
              These services have their own privacy policies. We encourage you to review them.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-3">5. Data Security</h2>
            <p>
              We take reasonable steps to protect your personal information from misuse, interference, loss,
              unauthorised access, modification and disclosure. Payment information is handled entirely by
              Square&apos;s PCI-DSS compliant infrastructure — we never see or store your full card details.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-3">6. Cookies</h2>
            <p>
              Our website uses cookies and similar technologies to enhance your browsing experience and
              collect analytics data. You can control cookie preferences through your browser settings.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-3">7. Your Rights</h2>
            <p>
              Under the Australian Privacy Principles, you have the right to request access to, correction of,
              or deletion of your personal information. To exercise these rights, please contact us at{" "}
              <a href="mailto:dsracing@bigpond.com" className="text-racing-red hover:underline">
                dsracing@bigpond.com
              </a>.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-3">8. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Any changes will be posted on this page
              with an updated revision date. Continued use of our website after changes constitutes acceptance
              of the revised policy.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-3">9. Contact</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us:
            </p>
            <ul className="list-none space-y-1 mt-2 text-white/60">
              <li>Email: <a href="mailto:dsracing@bigpond.com" className="text-racing-red hover:underline">dsracing@bigpond.com</a></li>
              <li>Location: Long Reef Crescent, Woodbine, NSW, Australia</li>
              <li>Facebook: <a href="https://www.facebook.com/dsracingkarts" target="_blank" rel="noopener noreferrer" className="text-racing-red hover:underline">@dsracingkarts</a></li>
            </ul>
          </div>

        </div>
      </section>
    </>
  );
}
