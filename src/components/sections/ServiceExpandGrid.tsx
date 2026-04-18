"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X, Wrench, Gauge, Settings, Zap, Shield, Users, Shirt } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

const iconMap: Record<string, LucideIcon> = {
  Wrench, Gauge, Settings, Zap, Shield, Users, Shirt,
};

interface ServiceDetail {
  iconName: string;
  title: string;
  description: string;
  details: string[];
  includes?: string[];
}

/** Map service titles to appropriate contact form subjects */
const subjectMap: Record<string, string> = {
  "Kart Servicing": "Servicing Booking",
  "Engine Tuning": "Engine Tuning",
  "Chassis Setup": "Chassis Setup",
  "Engine Servicing": "Engine Servicing",
  "Race Preparation": "Race Preparation",
  "Driver Coaching": "Driver Coaching",
  "Custom Racewear": "Custom Racewear",
};

function getEnquiryUrl(service: ServiceDetail): string {
  const subject = subjectMap[service.title] || "General Enquiry";
  const message = `Hi, I'm interested in your ${service.title} service. Could you please provide more details?`;
  const params = new URLSearchParams({ subject, message });
  return `/contact?${params.toString()}`;
}

function ServiceExpandCard({ service, index }: { service: ServiceDetail; index: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [isOpen]);

  const Icon = iconMap[service.iconName] || Wrench;

  return (
    <div
      className={`
        group border transition-all duration-300 overflow-hidden
        ${isOpen
          ? "border-[#e60012]/40 shadow-[0_0_30px_rgba(230,0,18,0.08)] bg-[#141414]"
          : "border-[#2a2a2a] bg-[#141414] hover:border-[#e60012]/30 hover:shadow-[0_0_20px_rgba(230,0,18,0.06)]"
        }
      `}
    >
      {/* ── Collapsed View (always visible) ── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left p-6 flex items-start gap-4 cursor-pointer"
      >
        <div className={`
          flex-shrink-0 w-12 h-12 flex items-center justify-center border transition-all duration-300
          ${isOpen
            ? "bg-[#e60012] border-[#e60012] text-white"
            : "bg-[#1a1a1a] border-[#2a2a2a] text-[#e60012] group-hover:border-[#e60012]/30"
          }
        `}>
          <Icon size={22} strokeWidth={1.5} />
        </div>

        <div className="flex-1 min-w-0">
          <h3
            className={`text-base uppercase tracking-[0.1em] mb-1 transition-colors duration-300 text-white`}
            style={{ fontFamily: "var(--font-heading), system-ui, sans-serif" }}
          >
            {service.title}
          </h3>
          <p className={`text-sm leading-relaxed transition-colors duration-300 ${
            isOpen ? "text-white/60" : "text-white/50"
          }`}>
            {service.description}
          </p>
        </div>

        <div className={`
          flex-shrink-0 w-10 h-10 flex items-center justify-center transition-all duration-300
          ${isOpen ? "rotate-180 text-[#e60012]" : "text-white/40 group-hover:text-[#e60012]"}
        `}>
          <ChevronDown size={20} strokeWidth={2} />
        </div>
      </button>

      {/* ── Expanded Detail View ── */}
      <div
        className="transition-all duration-400 ease-in-out"
        style={{
          maxHeight: isOpen ? `${contentHeight}px` : "0px",
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div ref={contentRef}>
          {/* Red accent line */}
          <div className="mx-6 h-[1px] bg-gradient-to-r from-[#e60012] via-[#e60012]/40 to-transparent" />

          <div className="p-6 pt-5">
            {/* Detail paragraphs */}
            <div className="space-y-3 mb-5">
              {service.details.map((detail, i) => (
                <p key={i} className="text-sm text-white/70 leading-relaxed">
                  {detail}
                </p>
              ))}
            </div>

            {/* What's included */}
            {service.includes && service.includes.length > 0 && (
              <div>
                <h4
                  className="text-xs uppercase tracking-[0.25em] text-[#e60012] mb-3"
                  style={{ fontFamily: "var(--font-heading), system-ui, sans-serif" }}
                >
                  What&apos;s Included
                </h4>
                <div className="grid sm:grid-cols-2 gap-2">
                  {service.includes.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-white/60">
                      <span className="text-[#e60012] mt-1 flex-shrink-0">&#10003;</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Enquire Now CTA */}
            <Link
              href={getEnquiryUrl(service)}
              className="inline-flex items-center gap-2 mt-2 px-5 py-2.5 bg-[#e60012] text-white text-xs font-heading uppercase tracking-[0.15em] hover:bg-[#c5000f] transition-colors"
            >
              Enquire Now
              <ChevronDown size={14} className="-rotate-90" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ServiceExpandGrid({ services }: { services: ServiceDetail[] }) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {services.map((service, i) => (
        <ServiceExpandCard key={service.title} service={service} index={i} />
      ))}
    </div>
  );
}
