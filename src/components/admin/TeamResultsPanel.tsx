"use client";

import { useState } from "react";
import { Plus, Trash2, Save, Loader2, Flag, ChevronDown, ChevronUp, X } from "lucide-react";

interface Result {
  id: string;
  team_profile_id: string;
  event_date: string;
  event_name: string;
  track: string;
  class: string;
  position: number | null;
  best_lap_time: string;
  top_speed_kmh: number | null;
  notes: string;
  created_at: string;
}

const emptyForm = (teamId: string) => ({
  team_profile_id: teamId,
  event_date: new Date().toISOString().slice(0, 10),
  event_name: "",
  track: "",
  class: "",
  position: "" as string | number,
  best_lap_time: "",
  top_speed_kmh: "" as string | number,
  notes: "",
});

interface Props {
  teamId: string;
  initialResults: Result[];
}

export function TeamResultsPanel({ teamId, initialResults }: Props) {
  const [results, setResults] = useState<Result[]>(initialResults);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm(teamId));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [expanded, setExpanded] = useState(true);

  function setField<K extends keyof ReturnType<typeof emptyForm>>(key: K, value: ReturnType<typeof emptyForm>[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.event_date) { setErrorMsg("Event date required."); return; }
    setSaving(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/admin/team-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          position: form.position === "" ? null : Number(form.position),
          top_speed_kmh: form.top_speed_kmh === "" ? null : Number(form.top_speed_kmh),
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Save failed"); }
      const { result } = await res.json();
      setResults((prev) => [result, ...prev].sort((a, b) => b.event_date.localeCompare(a.event_date)));
      setShowAdd(false);
      setForm(emptyForm(teamId));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this result?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/team-results?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setResults((prev) => prev.filter((r) => r.id !== id));
    } catch {
      alert("Failed to delete result");
    } finally {
      setDeleting(null);
    }
  }

  function ordinal(n: number) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  return (
    <div className="card overflow-hidden mt-8">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 bg-surface-700 hover:bg-surface-600 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Flag size={16} className="text-brand-red" />
          <span className="font-heading text-sm uppercase tracking-wider">Race Results ({results.length})</span>
        </div>
        {expanded ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
      </button>

      {expanded && (
        <div className="p-6">
          {/* Add button */}
          <div className="flex justify-between items-center mb-4">
            <p className="text-xs text-text-muted">Results appear on the team profile card on the Sponsors page.</p>
            {!showAdd && (
              <button onClick={() => { setShowAdd(true); setErrorMsg(""); }} className="btn-secondary flex items-center gap-1.5 text-xs">
                <Plus size={13} /> Add Result
              </button>
            )}
          </div>

          {/* Add form */}
          {showAdd && (
            <form onSubmit={handleAdd} className="border border-surface-600 bg-surface-800/50 p-4 mb-5 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-white uppercase tracking-wider">New Result</p>
                <button type="button" onClick={() => setShowAdd(false)} className="text-text-muted hover:text-white"><X size={14} /></button>
              </div>
              {errorMsg && <p className="text-red-400 text-xs bg-red-950/30 border border-red-800/40 px-2 py-1.5">{errorMsg}</p>}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Date *</label>
                  <input type="date" required className="input-dark w-full text-sm" value={String(form.event_date)} onChange={(e) => setField("event_date", e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Event Name</label>
                  <input className="input-dark w-full text-sm" placeholder="e.g. Easter Cup" value={form.event_name} onChange={(e) => setField("event_name", e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Track</label>
                  <input className="input-dark w-full text-sm" placeholder="e.g. Eastern Creek" value={form.track} onChange={(e) => setField("track", e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Class</label>
                  <input className="input-dark w-full text-sm" placeholder="e.g. KA3 Senior" value={form.class} onChange={(e) => setField("class", e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Position (P#)</label>
                  <input type="number" min={1} className="input-dark w-full text-sm" placeholder="e.g. 3" value={form.position} onChange={(e) => setField("position", e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Best Lap</label>
                  <input className="input-dark w-full text-sm" placeholder="e.g. 1:02.451" value={form.best_lap_time} onChange={(e) => setField("best_lap_time", e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Top Speed (km/h)</label>
                  <input type="number" step="0.1" min={0} className="input-dark w-full text-sm" placeholder="e.g. 108.5" value={form.top_speed_kmh} onChange={(e) => setField("top_speed_kmh", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Notes</label>
                  <input className="input-dark w-full text-sm" placeholder="Optional notes" value={form.notes} onChange={(e) => setField("notes", e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={saving} className="btn-primary flex items-center gap-1.5 text-xs">
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  {saving ? "Saving…" : "Save Result"}
                </button>
                <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary text-xs">Cancel</button>
              </div>
            </form>
          )}

          {/* Results list */}
          {results.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-4">No results yet. Add the team&apos;s first race result above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-surface-600">
                    <th className="text-left py-2 pr-3 text-text-muted font-medium">Date</th>
                    <th className="text-left py-2 pr-3 text-text-muted font-medium">Event</th>
                    <th className="text-left py-2 pr-3 text-text-muted font-medium">Track</th>
                    <th className="text-left py-2 pr-3 text-text-muted font-medium">Class</th>
                    <th className="text-left py-2 pr-3 text-text-muted font-medium">Pos.</th>
                    <th className="text-left py-2 pr-3 text-text-muted font-medium">Best Lap</th>
                    <th className="text-left py-2 pr-3 text-text-muted font-medium">km/h</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700/50">
                  {results.map((r) => (
                    <tr key={r.id} className="hover:bg-surface-700/30 transition-colors">
                      <td className="py-2 pr-3 text-text-secondary whitespace-nowrap">{r.event_date}</td>
                      <td className="py-2 pr-3 text-white">{r.event_name || "—"}</td>
                      <td className="py-2 pr-3 text-text-secondary">{r.track || "—"}</td>
                      <td className="py-2 pr-3 text-text-secondary">{r.class || "—"}</td>
                      <td className="py-2 pr-3">
                        {r.position != null ? (
                          <span className={`font-bold ${r.position === 1 ? "text-yellow-400" : r.position <= 3 ? "text-white" : "text-text-secondary"}`}>
                            {ordinal(r.position)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-text-secondary font-mono">{r.best_lap_time || "—"}</td>
                      <td className="py-2 pr-3 text-text-secondary">{r.top_speed_kmh != null ? r.top_speed_kmh : "—"}</td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => handleDelete(r.id)}
                          disabled={deleting === r.id}
                          className="text-text-muted hover:text-red-400 transition-colors"
                        >
                          {deleting === r.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
