"use client";

import { useState } from "react";
import { Loader2, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

interface Subscriber {
  id: string;
  email: string;
  subscribed: boolean;
  source: string | null;
  created_at: string;
}

interface Props {
  initialSubscribers: Subscriber[];
}

export function NewsletterTable({ initialSubscribers }: Props) {
  const [subscribers, setSubscribers] = useState<Subscriber[]>(initialSubscribers);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function toggleSubscribed(sub: Subscriber) {
    setToggling(sub.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/newsletter/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscribed: !sub.subscribed }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Update failed");
      const updated: Subscriber = await res.json();
      setSubscribers((prev) => prev.map((s) => (s.id === updated.id ? { ...s, subscribed: updated.subscribed } : s)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setToggling(null);
    }
  }

  async function deleteSubscriber(id: string) {
    if (!confirm("Permanently delete this subscriber?")) return;
    setDeleting(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/newsletter/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setSubscribers((prev) => prev.filter((s) => s.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      {error && (
        <p className="text-red-400 text-sm mb-4 bg-red-950/30 border border-red-800/40 rounded px-3 py-2">{error}</p>
      )}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-700">
            <tr>
              <th className="px-4 py-3 text-left text-text-muted font-medium">Email</th>
              <th className="px-4 py-3 text-left text-text-muted font-medium">Status</th>
              <th className="px-4 py-3 text-left text-text-muted font-medium">Source</th>
              <th className="px-4 py-3 text-left text-text-muted font-medium">Date</th>
              <th className="px-4 py-3 text-right text-text-muted font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-700">
            {subscribers.length > 0 ? (
              subscribers.map((sub) => (
                <tr key={sub.id} className="hover:bg-surface-700/50 transition-colors">
                  <td className="px-4 py-3 text-white">{sub.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      sub.subscribed ? "bg-green-500/10 text-green-400" : "bg-surface-600 text-text-muted"
                    }`}>
                      {sub.subscribed ? "Subscribed" : "Unsubscribed"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary capitalize">{sub.source || "website"}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {new Date(sub.created_at).toLocaleDateString("en-AU")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleSubscribed(sub)}
                        disabled={toggling === sub.id}
                        title={sub.subscribed ? "Unsubscribe" : "Re-subscribe"}
                        className="p-1.5 rounded text-text-muted hover:text-white hover:bg-surface-600 transition-colors"
                      >
                        {toggling === sub.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : sub.subscribed
                            ? <ToggleRight size={14} className="text-green-400" />
                            : <ToggleLeft size={14} />
                        }
                      </button>
                      <button
                        onClick={() => deleteSubscriber(sub.id)}
                        disabled={deleting === sub.id}
                        title="Delete permanently"
                        className="p-1.5 rounded text-text-muted hover:text-red-400 hover:bg-red-950/30 transition-colors"
                      >
                        {deleting === sub.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Trash2 size={14} />
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-text-muted">
                  No subscribers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
