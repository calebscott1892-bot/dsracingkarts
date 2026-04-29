import { Metadata } from "next";
import { Gift } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { GiftCardClient } from "./GiftCardClient";
import Link from "next/link";

export const metadata: Metadata = {
  title: "E-Gift Card",
  description:
    "Give the gift of speed. DS Racing Karts e-gift cards are available in $50, $100, $200 and $500 — or any custom amount.",
  alternates: {
    canonical: "/gift-card",
  },
};

export default async function GiftCardPage() {
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select(`id, name, product_variations ( id, name, sku, price )`)
    .eq("slug", "ds-racing-karts-e-gift-card")
    .single();

  return (
    <>
      {/* Hero */}
      <section className="relative bg-racing-black carbon-fiber py-20 md:py-28">
        <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="h-[1px] w-8 bg-racing-red" />
            <span className="font-heading text-xs tracking-[0.4em] text-racing-red uppercase">For Racers</span>
            <span className="h-[1px] w-8 bg-racing-red" />
          </div>
          <div className="flex justify-center mb-6">
            <div className="p-4 border border-racing-red/30 bg-racing-red/10 rounded">
              <Gift size={40} className="text-racing-red" strokeWidth={1.5} />
            </div>
          </div>
          <h1 className="font-heading text-4xl md:text-6xl uppercase tracking-[0.1em] text-white mb-6">
            E-Gift <span className="text-racing-red">Card</span>
          </h1>
          <p className="text-text-secondary text-lg leading-relaxed max-w-xl mx-auto">
            Not sure what to get them? Let them choose. Our e-gift cards can be used on anything
            in the DS Racing Karts online store.
          </p>
        </div>
      </section>

      <div className="chequered-stripe" />

      {/* Content */}
      <section className="max-w-2xl mx-auto px-4 py-16 md:py-20">
        {product ? (
          <GiftCardClient
            variations={product.product_variations || []}
            productId={product.id}
            productName={product.name}
          />
        ) : (
          <div className="text-center space-y-4 py-12">
            <p className="text-text-muted">Gift cards are not yet available online.</p>
            <p className="text-text-secondary text-sm">
              <Link href="/contact" className="text-brand-red hover:underline">
                Contact us
              </Link>{" "}
              to arrange a gift card directly.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
