"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Lock, Loader2, CheckCircle } from "lucide-react";

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();

      // Re-authenticate with current password first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Could not identify user session.");

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: current,
      });
      if (signInError) {
        setError("Current password is incorrect.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) throw updateError;

      setSuccess(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Password update failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-text-muted mb-1.5">Current password</label>
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red"
        />
      </div>
      <div>
        <label className="block text-xs text-text-muted mb-1.5">New password</label>
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red"
        />
      </div>
      <div>
        <label className="block text-xs text-text-muted mb-1.5">Confirm new password</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red"
        />
      </div>

      {error && (
        <p className="text-red-400 text-xs bg-red-950/30 border border-red-800/40 rounded px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-green-400 text-xs flex items-center gap-1.5">
          <CheckCircle size={13} /> Password updated successfully.
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-heading uppercase tracking-wider bg-brand-red text-white hover:bg-brand-red/80 transition-colors rounded disabled:opacity-60"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />}
        Update Password
      </button>
    </form>
  );
}
