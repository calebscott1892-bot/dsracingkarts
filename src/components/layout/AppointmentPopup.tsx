"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

export function AppointmentAddress({ children, className }: { children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
      >
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Modal */}
          <div
            className="relative bg-surface-800 border border-surface-500 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Red accent */}
            <div className="h-1 bg-racing-red" />

            {/* Chequered strip */}
            <div
              className="h-[6px] opacity-20"
              style={{
                background: "repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%) 0 0 / 6px 6px",
              }}
            />

            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-racing-red/10 border border-racing-red/30 flex items-center justify-center">
                    <AlertTriangle size={20} className="text-racing-red" />
                  </div>
                  <h3 className="font-heading text-sm uppercase tracking-[0.15em] text-white">
                    Appointment <span className="text-racing-red">Only</span>
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-white/60 text-sm leading-relaxed mb-4">
                Our workshop is located on a private residential property and we are unable to
                accommodate walk-ins or unscheduled visits.
              </p>
              <p className="text-white/60 text-sm leading-relaxed mb-5">
                Please <strong className="text-white/80">contact us first</strong> to arrange an
                appointment before coming to our location.
              </p>

              <div className="flex items-center gap-2 text-white/30 text-xs mb-5">
                <span className="h-[1px] flex-1 bg-surface-500" />
                <span className="font-heading uppercase tracking-[0.3em]">DSR</span>
                <span className="h-[1px] flex-1 bg-surface-500" />
              </div>

              <div className="flex gap-3">
                <a
                  href="/contact"
                  className="flex-1 text-center bg-racing-red text-white font-heading text-xs uppercase tracking-[0.15em] px-4 py-2.5 hover:bg-racing-red/90 transition-colors"
                >
                  Contact Us
                </a>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 text-center border border-surface-500 text-white/60 font-heading text-xs uppercase tracking-[0.15em] px-4 py-2.5 hover:border-white/30 hover:text-white transition-colors"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
