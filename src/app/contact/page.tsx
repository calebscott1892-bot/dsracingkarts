import { Metadata } from "next";
import Image from "next/image";
import { MapPin, Mail, Clock, AlertTriangle } from "lucide-react";
import ContactForm from "@/components/ContactForm";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Contact Us | DS Racing Karts",
  description: "Get in touch with DS Racing Karts, Sydney's go kart specialists. Parts, servicing, and race support.",
};

interface Props {
  searchParams: Promise<{
    subject?: string;
    message?: string;
  }>;
}

export default async function ContactPage({ searchParams }: Props) {
  const params = await searchParams;
  const defaultSubject = params.subject?.slice(0, 200);
  const defaultMessage = params.message?.slice(0, 2000);

  return (
    <>
      {/* Hero */}
      <section className="relative bg-racing-black carbon-fiber py-20 md:py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="h-[1px] w-8 bg-racing-red" />
            <span className="font-heading text-xs tracking-[0.4em] text-racing-red uppercase">Get In Touch</span>
            <span className="h-[1px] w-8 bg-racing-red" />
          </div>
          <h1 className="font-heading text-4xl md:text-6xl uppercase tracking-[0.1em] text-white mb-4">
            Contact <span className="text-racing-red">Us</span>
          </h1>
          <p className="text-white/60 max-w-lg mx-auto">
            Have a question about parts, servicing, or race preparation? We&apos;d love to hear from you.
          </p>
        </div>
      </section>

      <div className="chequered-stripe" />

      {/* Appointment Only Banner */}
      <section className="bg-racing-red/10 border-y border-racing-red/30">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-center gap-3">
          <AlertTriangle size={18} className="text-racing-red shrink-0" />
          <p className="text-white/90 text-sm text-center">
            <span className="font-heading uppercase tracking-wider text-racing-red">By appointment only</span>
            {" — "}Our workshop is located on a private property. Please contact us to arrange a visit before coming.
          </p>
        </div>
      </section>

      <section className="bg-racing-black py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div>
              <h2 className="font-heading text-2xl uppercase tracking-[0.1em] text-white mb-6">
                DS Racing <span className="text-racing-red">Karts</span>
              </h2>

              <div className="space-y-5 mb-8">
                <div className="flex items-start gap-4">
                  <MapPin size={20} className="text-racing-red shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-heading text-sm uppercase tracking-[0.1em] text-white mb-1">Location</h3>
                    <p className="text-sm text-white/50">Long Reef Crescent, Woodbine, NSW</p>
                    <p className="text-xs text-racing-red/80 mt-1 italic">By appointment only — private property</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Mail size={20} className="text-racing-red shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-heading text-sm uppercase tracking-[0.1em] text-white mb-1">Email</h3>
                    <a href="mailto:info@dsracingkarts.com.au" className="text-sm text-white/50 hover:text-racing-red transition-colors">
                      info@dsracingkarts.com.au
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Clock size={20} className="text-racing-red shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-heading text-sm uppercase tracking-[0.1em] text-white mb-1">Hours</h3>
                    <p className="text-sm text-white/50">By appointment only</p>
                  </div>
                </div>
              </div>

              {/* Social */}
              <div className="mb-8">
                <h3 className="font-heading text-sm uppercase tracking-[0.1em] text-white mb-3">Follow Us</h3>
                <a
                  href="https://www.facebook.com/dsracingkarts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-racing-red hover:text-racing-red/80 transition-colors"
                >
                  Facebook — @dsracingkarts
                </a>
              </div>

              {/* Appointment Notice Card */}
              <div className="border border-racing-red/30 bg-racing-red/5 p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="text-racing-red shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-heading text-xs uppercase tracking-[0.15em] text-racing-red mb-2">Important — Appointment Only</h4>
                    <p className="text-white/50 text-xs leading-relaxed">
                      Our workshop operates from a private residential property. We are unable to
                      accommodate walk-ins or unscheduled visits. Please use the contact form or
                      email us to book an appointment before visiting.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form — Racing Branded */}
            <div className="relative bg-surface-800 border border-surface-600 overflow-hidden">
              {/* Chequered flag corners */}
              <div className="absolute top-0 left-0 w-20 h-20 opacity-[0.06]"
                style={{
                  background: "repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%) 0 0 / 10px 10px",
                }}
              />
              <div className="absolute top-0 right-0 w-20 h-20 opacity-[0.06]"
                style={{
                  background: "repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%) 0 0 / 10px 10px",
                }}
              />
              <div className="absolute bottom-0 left-0 w-20 h-20 opacity-[0.06]"
                style={{
                  background: "repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%) 0 0 / 10px 10px",
                }}
              />
              <div className="absolute bottom-0 right-0 w-20 h-20 opacity-[0.06]"
                style={{
                  background: "repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%) 0 0 / 10px 10px",
                }}
              />

              {/* Red top accent */}
              <div className="h-1 bg-racing-red" />

              <div className="relative p-6 md:p-8">
                {/* DSR Logo — centred */}
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="relative w-32 h-12 mb-3">
                    <Image
                      src="/images/history/Site Logo (2).png"
                      alt="DS Racing Karts"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <h3 className="font-heading text-lg uppercase tracking-[0.1em] text-white">
                    Send a <span className="text-racing-red">Message</span>
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-heading uppercase tracking-[0.3em] text-white/30">
                      &#9873; DSR Contact
                    </span>
                  </div>
                </div>

                {/* Chequered divider */}
                <div className="h-[6px] mb-6 opacity-30"
                  style={{
                    background: "repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%) 0 0 / 6px 6px",
                  }}
                />

                <ContactForm defaultSubject={defaultSubject} defaultMessage={defaultMessage} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
