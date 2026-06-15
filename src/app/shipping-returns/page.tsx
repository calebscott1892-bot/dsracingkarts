import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shipping & Returns",
  description:
    "Shipping and returns policy for DS Racing Karts. Australia-wide delivery, dispatch times, return eligibility and refund timeframes.",
  alternates: {
    canonical: "/shipping-returns",
  },
};

export default function ShippingReturnsPage() {
  return (
    <>
      <section className="relative bg-racing-black carbon-fiber py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h1 className="font-heading text-4xl md:text-5xl uppercase tracking-[0.1em] text-white mb-4">
            Shipping &amp; <span className="text-racing-red">Returns</span>
          </h1>
          <p className="text-white/50 text-sm">Last updated: June 2026</p>
        </div>
      </section>

      <div className="chequered-stripe" />

      <section className="max-w-3xl mx-auto px-4 py-12 md:py-16">
        <div className="prose-invert space-y-8 text-white/70 text-sm leading-relaxed">

          <div>
            <h2 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-3">Shipping Policy</h2>
            <ul className="list-disc list-inside space-y-1 text-white/60">
              <li>We ship Australia-wide from our workshop in Woodbine, NSW.</li>
              <li>In-stock orders are dispatched within 1&ndash;2 business days of payment. Items sourced from
                our suppliers are usually dispatched within 5 business days.</li>
              <li>Shipping costs are calculated based on the size, weight and destination of your order and
                are confirmed at checkout or via invoice.</li>
              <li>Delivery methods range from express envelopes through Australia Post to courier services
                for larger items such as chassis and engines.</li>
              <li>Typical delivery times once dispatched: 2&ndash;5 business days for metro areas,
                4&ndash;8 business days for regional areas.</li>
              <li>Estimated delivery times are a guide only. DS Racing Karts is not liable for delays caused
                by couriers, Australia Post, or events outside our control.</li>
              <li>You will receive an order confirmation by email, and tracking details where available.</li>
              <li>Local pickup from Woodbine, NSW is available by appointment.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-3">Returns Policy</h2>
            <ul className="list-disc list-inside space-y-1 text-white/60">
              <li>Returns are accepted within 14 days of delivery for unused, unopened items in their
                original packaging.</li>
              <li>To start a return, contact us at{" "}
                <a href="mailto:dsracing@bigpond.com" className="text-racing-red hover:underline">dsracing@bigpond.com</a>{" "}
                with your order number and the reason for the return.</li>
              <li>The buyer is responsible for return shipping costs unless the item is faulty or was
                supplied incorrectly &mdash; in that case, return shipping is at our cost.</li>
              <li>Custom-made or personalised items (e.g. custom racewear) are not eligible for return
                unless faulty.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-3">Refunds</h2>
            <ul className="list-disc list-inside space-y-1 text-white/60">
              <li>Once your return is received and inspected, refunds are processed to the original payment
                method within 5&ndash;10 business days.</li>
              <li>If an item becomes unavailable after your order is placed, we will notify you and offer a
                full refund or an alternative.</li>
              <li>Nothing in this policy limits your rights under Australian Consumer Law. If a product has
                a major fault, you are entitled to a replacement or refund.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-3">Contact</h2>
            <p>Questions about shipping or returns? Get in touch:</p>
            <ul className="list-none space-y-1 mt-2 text-white/60">
              <li>Email: <a href="mailto:dsracing@bigpond.com" className="text-racing-red hover:underline">dsracing@bigpond.com</a></li>
              <li>Phone: <a href="tel:+61492454854" className="text-racing-red hover:underline">0492 454 854</a></li>
              <li>Location: Long Reef Crescent, Woodbine, NSW, Australia</li>
            </ul>
          </div>

        </div>
      </section>
    </>
  );
}
