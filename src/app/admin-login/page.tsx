"use client";

import { useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    searchParams.get("error") === "unauthorized"
      ? "You don't have permission to access that page."
      : ""
  );
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="bg-racing-black/80 border border-white/10 rounded-lg p-8 backdrop-blur-sm">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-3 mb-3">
          <span className="h-px w-6 bg-racing-red" />
          <span className="font-heading text-xs tracking-[0.4em] text-racing-red uppercase">Admin Portal</span>
          <span className="h-px w-6 bg-racing-red" />
        </div>
        <h1 className="font-heading text-2xl uppercase tracking-[0.1em] text-white">
          Sign <span className="text-racing-red">In</span>
        </h1>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <input
            type="email"
            required
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-racing-red/60 focus:bg-white/8 transition-colors"
          />
        </div>
        <div>
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-racing-red/60 focus:bg-white/8 transition-colors"
          />
        </div>

        {error && (
          <p className="text-racing-red text-sm text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-racing-red hover:bg-racing-red/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-heading uppercase tracking-[0.15em] py-3 rounded transition-colors mt-2"
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden bg-racing-black">
      {/* Background video */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-30"
      >
        <source src="/videos/Site Header.mp4" type="video/mp4" />
      </video>

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-racing-black/60 via-racing-black/70 to-racing-black/90" />

      {/* Red top accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-racing-red" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="/images/history/Site Logo (2).png"
            alt="DS Racing Karts"
            width={120}
            height={60}
            sizes="120px"
            className="object-contain"
          />
        </div>

        <Suspense fallback={
          <div className="bg-racing-black/80 border border-white/10 rounded-lg p-8 backdrop-blur-sm h-64 flex items-center justify-center">
            <span className="text-white/30 text-sm font-heading uppercase tracking-widest">Loading…</span>
          </div>
        }>
          <LoginForm />
        </Suspense>

        <p className="text-center text-white/20 text-xs mt-6 font-heading tracking-widest uppercase">
          DS Racing Karts
        </p>
      </div>
    </div>
  );
}
