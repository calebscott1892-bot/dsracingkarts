"use client";

import { useState, FormEvent } from "react";

type FormStatus = "idle" | "submitting" | "success" | "error";

interface ContactFormProps {
  defaultSubject?: string;
  defaultMessage?: string;
}

export default function ContactForm({ defaultSubject, defaultMessage }: ContactFormProps = {}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(defaultSubject || "Parts Enquiry");
  const [message, setMessage] = useState(defaultMessage || "");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong.");
      }

      setStatus("success");
      setName("");
      setEmail("");
      setSubject("Parts Enquiry");
      setMessage("");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to send message.");
    }
  }

  const fieldClass =
    "w-full px-4 py-3 bg-surface-700 border border-surface-500 text-sm text-white placeholder:text-white/20 " +
    "focus:border-racing-red focus:ring-1 focus:ring-racing-red/30 outline-none transition-colors";
  const labelClass =
    "block text-xs font-heading uppercase tracking-wider text-white/40 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="contact-name" className={labelClass}>Name</label>
        <input
          id="contact-name"
          type="text"
          required
          maxLength={200}
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={fieldClass}
          placeholder="Your name"
        />
      </div>
      <div>
        <label htmlFor="contact-email" className={labelClass}>Email</label>
        <input
          id="contact-email"
          type="email"
          required
          maxLength={320}
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={fieldClass}
          placeholder="your@email.com"
        />
      </div>
      <div>
        <label htmlFor="contact-subject" className={labelClass}>Subject</label>
        <select
          id="contact-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={fieldClass}
        >
          <option>Parts Enquiry</option>
          <option>Servicing Booking</option>
          <option>Race Preparation</option>
          <option>Engine Tuning</option>
          <option>Chassis Setup</option>
          <option>4 Stroke Endurance</option>
          <option>Driver Coaching</option>
          <option>Custom Racewear</option>
          <option>General Enquiry</option>
        </select>
      </div>
      <div>
        <label htmlFor="contact-message" className={labelClass}>Message</label>
        <textarea
          id="contact-message"
          rows={5}
          required
          maxLength={5000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={`${fieldClass} resize-none`}
          placeholder="How can we help?"
        />
      </div>

      {/* Chequered divider */}
      <div className="h-[4px] opacity-20"
        style={{
          background: "repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%) 0 0 / 4px 4px",
        }}
      />

      <div aria-live="polite">
        {status === "success" && (
          <div className="border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
            Message sent successfully! We&apos;ll get back to you soon.
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="block mt-2 text-xs text-green-400/70 underline underline-offset-2 hover:text-green-300 transition-colors"
            >
              Send another message
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="border border-racing-red/30 bg-racing-red/10 px-4 py-3 text-sm text-racing-red">
            {errorMsg}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "submitting" ? "Sending..." : "Send Message"}
      </button>
    </form>
  );
}
