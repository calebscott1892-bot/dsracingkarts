"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";

interface Props {
  orderId: string;
  initialNotes: string;
}

export function AdminNotesForm({ orderId, initialNotes }: Props) {
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_notes: notes }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-5">
      <h2 className="font-heading text-sm uppercase tracking-wider mb-3">Admin Notes</h2>
      <textarea
        rows={4}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={2000}
        placeholder="Internal notes — not visible to customer…"
        className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white placeholder:text-text-muted focus:outline-none focus:border-brand-red resize-none mb-1"
      />
      <p className={`text-xs mb-2 text-right ${notes.length > 1900 ? "text-yellow-400" : "text-text-muted"}`}>
        {notes.length}/2000
      </p>
      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-heading uppercase tracking-wider bg-brand-red text-white hover:bg-brand-red/80 transition-colors rounded disabled:opacity-60"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Save Notes
        </button>
        {saved && <span className="text-green-400 text-xs">Saved!</span>}
      </div>
    </div>
  );
}
