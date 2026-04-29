import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Terms and Conditions for DS Racing Karts. Read our terms of use, purchase conditions and policies.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return (
    <>
      <section className="relative bg-racing-black carbon-fiber py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h1 className="font-heading text-4xl md:text-5xl uppercase tracking-[0.1em] text-white mb-4">
            Terms &amp; <span className="text-racing-red">Conditions</span>
          </h1>
          <p className="text-white/50 text-sm">Last updated: April 2026</p>
        </div>
      </section>

      <div className="chequered-stripe" />

      <section className="max-w-3xl mx-auto px-4 py-12 md:py-16">
        <div className="prose-invert space-y-8 text-white/70 text-sm leading-relaxed">

          <div>
            <h2 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-3">1. General</h2>
            <p>
              These Terms and Conditions govern your use of the DS Racing Karts website and the purchase
              of products and services from us. By accessing our website or placing an order, you agree
              to be bound by these terms. DS Racing Karts is operated from New South Wales, Australia.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-3">2. Products &amp; Pricing</h2>
            <ul className="list-disc list-inside space-y-1 text-white/60">
              <li>All prices are listed in Australian Dollars (AUD) and include GST where applicable.</li>
              <li>We reserve the right to change prices at any time without prior notice.</li>
              <li>Product images are for illustration purposes and may vary slightly from the actual product.</li>
              <li>We make every effort to ensure product descriptions are accurate; however, errors may occur.
                We reserve the right to correct any errors and update information without notice.</li>
              <li>Stock availability is subject to change. If an item becomes unavailable after your order is placed,
                we will notify you and offer a refund or alternative.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-3">3. Orders &amp; Payment</h2>
            <ul className="list-disc list-inside space-y-1 text-white/60">
              <li>All orders are subject to acceptance and availability.</li>
              <li>Payment is processed securely via Square at the time of purchase.</li>
              <li>We accept major credit and debit cards.</li>
              <li>An order confirmation email will be sent once payment is successfully processed.</li>
              <li>We reserve the right to cancel or refuse any order at our discretion.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-3">4. Shipping &amp; Delivery</h2>
            <ul className="list-disc list-inside space-y-1 text-white/60">
              <li>We ship Australia-wide. Shipping costs are calculated based on the size, weight, and destination
                of the order and will be confirmed at checkout or via invoice.</li>
              <li>Shipping methods range from small express envelopes to courier services depending on the order.</li>
              <li>Estimated delivery times are provided as a guide only and are not guaranteed.</li>
              <li>DS Racing Karts is not liable for delays caused by couriers, Australia Post, or events
                outside our control.</li>
              <li>Risk of loss or damage passes to the buyer once the goods are dispatched.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-3">5. Returns &amp; Refunds</h2>
            <ul className="list-disc list-inside space-y-1 text-white/60">
              <li>Returns are accepted within 14 days of delivery for unused, unopened items in original packaging.</li>
              <li>The buyer is responsible for return shipping costs unless the item is faulty or incorrect.</li>
              <li>Refunds will be processed to the original payment method within 5–10 business days of receiving
                the returned item.</li>
              <li>Custom-made or personalised items (e.g. custom racewear) are not eligible for return unless faulty.</li>
              <li>Australian Consumer Law rights are not affected by these terms. If a product has a major fault,
                you are entitled to a replacement or refund.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-3">6. Workshop &amp; Services</h2>
            <ul className="list-disc list-inside space-y-1 text-white/60">
              <li>All workshop visits are <strong className="text-white/80">by appointment only</strong>.
                Our workshop is located on private property — no walk-ins.</li>
              <li>Service quotes are estimates only and may change once the kart has been inspected.</li>
              <li>DS Racing Karts is not liable for damage to karts or equipment beyond our reasonable control
                during servicing.</li>
              <li>Karts left for service must be collected within 14 days of completion notification, or
                storage fees may apply.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-3">7. Intellectual Property</h2>
            <p>
              All content on this website — including text, images, logos, graphics, and designs — is the
              property of DS Racing Karts or its licensors and is protected by Australian copyright law.
              You may not reproduce, distribute, or use any content without our written permission.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-3">8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, DS Racing Karts shall not be liable for any indirect,
              incidental, special, or consequential damages arising out of or in connection with the use of
              our website or the purchase of our products and services. Our total liability will not exceed
              the amount paid by you for the relevant product or service.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-3">9. Governing Law</h2>
            <p>
              These terms are governed by and construed in accordance with the laws of New South Wales,
              Australia. Any disputes arising from these terms shall be subject to the exclusive jurisdiction
              of the courts of New South Wales.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-3">10. Contact</h2>
            <p>
              For questions regarding these terms, please contact us:
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
