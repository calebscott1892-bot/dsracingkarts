"use client";

import { useState } from "react";
import { Star, Pencil, Trash2, Eye, EyeOff, Plus, X, Save, Loader2, Facebook, Globe } from "lucide-react";

const PLATFORMS = ["Google", "Facebook", "Direct", "Other"];

interface Review {
  id: string;
  author_name: string;
  text: string;
  platform: string;
  rating: number;
  review_date: string | null;
  is_visible: boolean;
  sort_order: number;
}

const emptyForm = (): Omit<Review, "id"> => ({
  author_name: "",
  text: "",
  platform: "Google",
  rating: 5,
  review_date: "",
  is_visible: true,
  sort_order: 0,
});

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === "Facebook") return <Facebook size={13} className="text-blue-400" />;
  return <Globe size={13} className="text-text-muted" />;
}

function StarRating({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={16}
          className={`${n <= value ? "text-yellow-400 fill-yellow-400" : "text-surface-500"} ${onChange ? "cursor-pointer" : ""}`}
          onClick={() => onChange?.(n)}
        />
      ))}
    </div>
  );
}

interface Props { initialReviews: Review[] }

export function ReviewsManager({ initialReviews }: Props) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [editing, setEditing] = useState<string | null>(null);     // review id being edited
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  function setField<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openEdit(review: Review) {
    setEditing(review.id);
    setForm({
      author_name: review.author_name,
      text: review.text,
      platform: review.platform,
      rating: review.rating,
      review_date: review.review_date ?? "",
      is_visible: review.is_visible,
      sort_order: review.sort_order,
    });
    setShowAdd(false);
    setErrorMsg("");
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setShowAdd(true);
    setErrorMsg("");
  }

  function cancelForm() {
    setEditing(null);
    setShowAdd(false);
    setForm(emptyForm());
    setErrorMsg("");
  }

  async function saveForm() {
    if (!form.author_name.trim()) { setErrorMsg("Author name is required."); return; }
    if (!form.text.trim()) { setErrorMsg("Review text is required."); return; }

    setSaving(true);
    setErrorMsg("");
    try {
      if (editing) {
        // Update
        const res = await fetch(`/api/admin/reviews/${editing}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            review_date: form.review_date || null,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Save failed");
        const updated: Review = await res.json();
        setReviews((prev) => prev.map((r) => (r.id === editing ? updated : r)));
        setEditing(null);
      } else {
        // Create
        const res = await fetch("/api/admin/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            review_date: form.review_date || null,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Create failed");
        const created: Review = await res.json();
        setReviews((prev) => [...prev, created]);
        setShowAdd(false);
      }
      setForm(emptyForm());
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "An error occurred.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleVisible(review: Review) {
    try {
      const res = await fetch(`/api/admin/reviews/${review.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_visible: !review.is_visible }),
      });
      if (!res.ok) throw new Error("Toggle failed");
      const updated: Review = await res.json();
      setReviews((prev) => prev.map((r) => (r.id === review.id ? updated : r)));
    } catch {
      setErrorMsg("Failed to update visibility.");
    }
  }

  async function deleteReview(id: string) {
    if (!confirm("Delete this review? This cannot be undone.")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setReviews((prev) => prev.filter((r) => r.id !== id));
      if (editing === id) cancelForm();
    } catch {
      setErrorMsg("Failed to delete review.");
    } finally {
      setDeleting(null);
    }
  }

  const formPanel = (
    <div className="card p-6 mb-6 border border-brand-red/30">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-heading text-lg uppercase tracking-wider">
          {editing ? "Edit Review" : "Add Review"}
        </h2>
        <button onClick={cancelForm} className="text-text-muted hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>

      {errorMsg && (
        <p className="text-red-400 text-sm mb-4 bg-red-950/30 border border-red-800/40 rounded px-3 py-2">
          {errorMsg}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Author Name *</label>
          <input
            className="input-dark w-full"
            value={form.author_name}
            onChange={(e) => setField("author_name", e.target.value)}
            placeholder="e.g. John Smith"
          />
        </div>

        <div>
          <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Platform *</label>
          <select
            className="input-dark w-full"
            value={form.platform}
            onChange={(e) => setField("platform", e.target.value)}
          >
            {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Rating *</label>
          <div className="flex items-center gap-3 mt-2">
            <StarRating value={form.rating} onChange={(n) => setField("rating", n)} />
            <span className="text-sm text-text-secondary">{form.rating}/5</span>
          </div>
        </div>

        <div>
          <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Date (optional)</label>
          <input
            type="date"
            className="input-dark w-full"
            value={form.review_date ?? ""}
            onChange={(e) => setField("review_date", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Sort Order</label>
          <input
            type="number"
            className="input-dark w-full"
            value={form.sort_order}
            onChange={(e) => setField("sort_order", parseInt(e.target.value) || 0)}
            min={0}
          />
          <p className="text-xs text-text-muted mt-1">Lower = shown first in carousel</p>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <label className="text-sm text-text-secondary">Visible on site</label>
          <button
            type="button"
            onClick={() => setField("is_visible", !form.is_visible)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_visible ? "bg-brand-red" : "bg-surface-500"}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${form.is_visible ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Review Text *</label>
          <textarea
            className="input-dark w-full"
            rows={4}
            value={form.text}
            onChange={(e) => setField("text", e.target.value)}
            placeholder="The review content..."
          />
        </div>
      </div>

      <div className="flex gap-3 mt-5">
        <button
          onClick={saveForm}
          disabled={saving}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? "Saving…" : "Save Review"}
        </button>
        <button onClick={cancelForm} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-3xl uppercase tracking-wider">Reviews</h1>
          <p className="text-text-muted text-sm mt-1">{reviews.length} total · {reviews.filter((r) => r.is_visible).length} visible</p>
        </div>
        {!showAdd && !editing && (
          <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} /> Add Review
          </button>
        )}
      </div>

      {errorMsg && !showAdd && !editing && (
        <p className="text-red-400 text-sm mb-4 bg-red-950/30 border border-red-800/40 rounded px-3 py-2">
          {errorMsg}
        </p>
      )}

      {(showAdd || editing) && formPanel}

      <div className="space-y-3">
        {reviews.length === 0 && (
          <div className="card p-8 text-center text-text-muted">No reviews yet. Add the first one above.</div>
        )}
        {reviews.map((review) => (
          <div
            key={review.id}
            className={`card p-5 flex gap-4 items-start transition-opacity ${!review.is_visible ? "opacity-50" : ""}`}
          >
            {/* Sort order badge */}
            <span className="shrink-0 w-7 h-7 rounded bg-surface-600 text-text-muted text-xs flex items-center justify-center font-mono">
              {review.sort_order}
            </span>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-heading text-sm text-white">{review.author_name}</span>
                <div className="flex items-center gap-1 text-xs text-text-muted">
                  <PlatformIcon platform={review.platform} />
                  {review.platform}
                </div>
                <StarRating value={review.rating} />
                {review.review_date && (
                  <span className="text-xs text-text-muted">{new Date(review.review_date).toLocaleDateString("en-AU")}</span>
                )}
              </div>
              <p className="text-sm text-text-secondary line-clamp-2">{review.text}</p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                title={review.is_visible ? "Hide from site" : "Show on site"}
                onClick={() => toggleVisible(review)}
                className="p-2 rounded text-text-muted hover:text-white hover:bg-surface-600 transition-colors"
              >
                {review.is_visible ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              <button
                title="Edit"
                onClick={() => openEdit(review)}
                className="p-2 rounded text-text-muted hover:text-white hover:bg-surface-600 transition-colors"
              >
                <Pencil size={15} />
              </button>
              <button
                title="Delete"
                onClick={() => deleteReview(review.id)}
                disabled={deleting === review.id}
                className="p-2 rounded text-text-muted hover:text-red-400 hover:bg-red-950/30 transition-colors"
              >
                {deleting === review.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
