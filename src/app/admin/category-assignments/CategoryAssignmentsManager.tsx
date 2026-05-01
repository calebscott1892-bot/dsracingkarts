"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ShieldCheck, Check, X, Play, RefreshCw, Undo2, Download, RotateCcw, Target, Search } from "lucide-react";

type Suggestion = {
  id: string;
  product_id: string;
  product_square_token: string | null;
  product_name: string;
  suggested_category_id: string | null;
  suggested_category_name: string;
  suggested_parent_name: string | null;
  confidence: number;
  confidence_band: "high" | "medium" | "low" | "no_match";
  rationale: string;
  status: "pending" | "approved" | "rejected" | "applied" | "skipped" | "reverted";
  created_at: string;
};

type CategoryOption = {
  id: string;
  name: string;
  parent_name: string | null;
  full_label: string;
};

type Props = {
  latestRun: {
    id: string;
    mode: string;
    source: string;
    notes: string;
    created_at: string;
  } | null;
  uncategorizedCount: number;
  summary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    applied: number;
    skipped: number;
    reverted: number;
    high: number;
    medium: number;
    low: number;
    no_match: number;
  };
  suggestions: Suggestion[];
  allCategories: CategoryOption[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function confidenceBand(confidence: number) {
  if (confidence >= 0.55) return "High";
  if (confidence >= 0.35) return "Medium";
  return "Low";
}

export function CategoryAssignmentsManager({
  latestRun,
  uncategorizedCount,
  summary,
  suggestions,
  allCategories,
}: Props) {
  const router = useRouter();
  const [isGenerating, startGenerating] = useTransition();
  const [actingId, setActingId] = useState<string | null>(null);
  const [isBulkActing, startBulkAction] = useTransition();
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected" | "applied">("all");
  const [confidenceFilter, setConfidenceFilter] = useState<"all" | "high" | "medium" | "low" | "no_match">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pickerFor, setPickerFor] = useState<Suggestion | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerSubmitting, setPickerSubmitting] = useState(false);

  const filteredPickerCategories = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return allCategories.slice(0, 50);
    return allCategories
      .filter((category) => category.full_label.toLowerCase().includes(q))
      .slice(0, 50);
  }, [pickerQuery, allCategories]);

  function openPicker(suggestion: Suggestion) {
    setPickerFor(suggestion);
    setPickerQuery("");
  }

  function closePicker() {
    setPickerFor(null);
    setPickerQuery("");
    setPickerSubmitting(false);
  }

  async function pickCategory(categoryId: string) {
    if (!pickerFor) return;
    setPickerSubmitting(true);
    try {
      const response = await fetch(`/api/admin/category-assignments/${pickerFor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reassign", category_id: categoryId }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        alert(payload?.error || "Reassign failed.");
        return;
      }
      closePicker();
      router.refresh();
    } finally {
      setPickerSubmitting(false);
    }
  }

  const visibleSuggestions = useMemo(() => {
    return suggestions.filter((suggestion) => {
      const statusOkay = statusFilter === "all" ? true : suggestion.status === statusFilter;
      const confidenceOkay =
        confidenceFilter === "all" ? true : suggestion.confidence_band === confidenceFilter;
      return statusOkay && confidenceOkay;
    });
  }, [statusFilter, confidenceFilter, suggestions]);

  const selectableSuggestions = useMemo(
    () => visibleSuggestions.filter((suggestion) => ["pending", "approved", "rejected"].includes(suggestion.status)),
    [visibleSuggestions]
  );

  function generateSuggestions() {
    startGenerating(async () => {
      const response = await fetch("/api/admin/category-assignments", {
        method: "POST",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        alert(payload?.error || "Failed to generate category suggestions.");
        return;
      }

      router.refresh();
    });
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  }

  function selectVisible() {
    setSelectedIds(selectableSuggestions.map((suggestion) => suggestion.id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  function runBulkAction(action: "approve" | "reject") {
    if (selectedIds.length === 0) return;

    startBulkAction(async () => {
      const response = await fetch("/api/admin/category-assignments/bulk", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, ids: selectedIds }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        alert(payload?.error || "Bulk action failed.");
        return;
      }

      setSelectedIds([]);
      router.refresh();
    });
  }

  async function runAction(id: string, action: "approve" | "reject" | "repend" | "apply" | "revert") {
    setActingId(id);
    try {
      const response = await fetch(`/api/admin/category-assignments/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        alert(payload?.error || "Action failed.");
        return;
      }

      // For apply / revert, the API also pushes the change to Square. If
      // that step failed (network, Square 4xx, missing IDs) the local row
      // has already changed but Square is still out of sync — surface the
      // warning so the user can retry.
      if (action === "apply" || action === "revert") {
        const payload = await response.json().catch(() => null);
        if (payload?.squareWarning) {
          alert(`Saved locally, but Square was not updated: ${payload.squareWarning}`);
        }
      }

      router.refresh();
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-heading text-3xl uppercase tracking-wider">Category Assignments</h1>
          <p className="text-text-muted mt-2 max-w-3xl text-sm leading-relaxed">
            This tool only helps with products that currently have no category assignments. It is
            built to avoid touching anything the client has already categorised manually.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href="/api/admin/category-assignments/export"
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Download size={16} /> Export CSV
          </a>
          <button
            onClick={generateSuggestions}
            disabled={isGenerating}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            {isGenerating ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {isGenerating ? "Generating..." : "Generate Suggestions"}
          </button>
        </div>
      </div>

      <div className="border border-green-500/30 bg-green-500/10 px-4 py-4 flex gap-3">
        <ShieldCheck size={18} className="text-green-400 shrink-0 mt-0.5" />
        <div className="text-sm text-white/80 leading-relaxed">
          <p className="font-medium text-white mb-1">Safety guard is active.</p>
          <p>
            Suggestions do not auto-apply. They stay pending until someone explicitly approves and
            applies them one by one. Even then, the database will refuse to apply if the product
            has been categorised manually in the meantime.
          </p>
          <p className="mt-2">
            <span className="text-white">Apply now also pushes to Square</span> — the same change
            is written back to the Square catalog so it sticks across future syncs. Revert removes
            it from Square as well.
          </p>
        </div>
      </div>

      {latestRun && latestRun.notes && !latestRun.notes.includes("Completed") && (
        <div className="border border-amber-500/40 bg-amber-500/10 px-4 py-4 flex gap-3">
          <RefreshCw size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-white/80 leading-relaxed">
            <p className="font-medium text-white mb-1">Last run looks incomplete.</p>
            <p>
              The previous suggestion run finished without writing its &ldquo;Completed&rdquo;
              marker, which usually means it timed out partway through the catalog. Click
              <span className="text-white"> Generate Suggestions </span> again to start a fresh
              full pass — the runtime cap has been raised so it should complete this time.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="card p-4">
          <p className="text-text-muted text-xs uppercase tracking-[0.2em] mb-2">
            Uncategorised Now
          </p>
          <p className="font-heading text-3xl text-white">{uncategorizedCount}</p>
          <p className="text-text-muted text-xs mt-2 leading-relaxed">
            Count comes from the website database: active products with zero category assignments
            after the latest Square sync. It is not read live from Square.
          </p>
        </div>
        <div className="card p-4">
          <p className="text-text-muted text-xs uppercase tracking-[0.2em] mb-2">Latest Run</p>
          <p className="font-heading text-lg text-white">{latestRun ? formatDate(latestRun.created_at) : "None yet"}</p>
          {latestRun?.notes && <p className="text-text-muted text-xs mt-2 leading-relaxed">{latestRun.notes}</p>}
        </div>
        <div className="card p-4">
          <p className="text-text-muted text-xs uppercase tracking-[0.2em] mb-2">Reviewable</p>
          <p className="font-heading text-3xl text-white">{summary.high + summary.medium}</p>
          <p className="text-text-muted text-xs mt-2">
            {summary.high} high confidence / {summary.medium} medium confidence
          </p>
        </div>
        <div className="card p-4">
          <p className="text-text-muted text-xs uppercase tracking-[0.2em] mb-2">Approved / Applied</p>
          <p className="font-heading text-3xl text-white">{summary.approved + summary.applied}</p>
          <p className="text-text-muted text-xs mt-2">
            {summary.approved} approved waiting / {summary.applied} applied
          </p>
        </div>
      </div>

      <div className="card p-4 flex flex-wrap gap-2">
        {[
          { key: "all", label: "All Reviewable" },
          { key: "pending", label: `Pending (${summary.pending})` },
          { key: "approved", label: `Approved (${summary.approved})` },
          { key: "rejected", label: `Rejected (${summary.rejected})` },
          { key: "applied", label: `Applied (${summary.applied})` },
        ].map((filter) => (
          <button
            key={filter.key}
            onClick={() => setStatusFilter(filter.key as "all" | "pending" | "approved" | "rejected" | "applied")}
            className={`px-3 py-2 rounded text-xs uppercase tracking-wider transition-colors ${
              statusFilter === filter.key
                ? "bg-brand-red text-white"
                : "bg-surface-700 text-text-secondary hover:bg-surface-600"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="card p-4 flex flex-wrap gap-2">
        {[
          { key: "all", label: "All Confidence" },
          { key: "high", label: `High (${summary.high})` },
          { key: "medium", label: `Medium (${summary.medium})` },
          { key: "low", label: `Low (${summary.low})` },
          { key: "no_match", label: `No Match (${summary.no_match})` },
        ].map((filter) => (
          <button
            key={filter.key}
            onClick={() =>
              setConfidenceFilter(filter.key as "all" | "high" | "medium" | "low" | "no_match")
            }
            className={`px-3 py-2 rounded text-xs uppercase tracking-wider transition-colors ${
              confidenceFilter === filter.key
                ? "bg-brand-red text-white"
                : "bg-surface-700 text-text-secondary hover:bg-surface-600"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="card p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-white/80">
          <p className="font-medium text-white">
            {selectedIds.length} suggestion{selectedIds.length === 1 ? "" : "s"} selected
          </p>
          <p className="text-text-muted text-xs mt-1">
            Bulk actions only approve or reject. Apply and revert stay individual for safety.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={selectVisible}
            disabled={selectableSuggestions.length === 0}
            className="px-3 py-2 rounded text-xs uppercase tracking-wider bg-surface-700 text-text-secondary hover:bg-surface-600 transition-colors disabled:opacity-50"
          >
            Select Visible
          </button>
          <button
            onClick={clearSelection}
            disabled={selectedIds.length === 0}
            className="px-3 py-2 rounded text-xs uppercase tracking-wider bg-surface-700 text-text-secondary hover:bg-surface-600 transition-colors disabled:opacity-50"
          >
            Clear
          </button>
          <button
            onClick={() => runBulkAction("approve")}
            disabled={selectedIds.length === 0 || isBulkActing}
            className="btn-secondary text-xs px-3 py-2 flex items-center gap-1 disabled:opacity-50"
          >
            <Check size={14} /> Bulk Approve
          </button>
          <button
            onClick={() => runBulkAction("reject")}
            disabled={selectedIds.length === 0 || isBulkActing}
            className="px-3 py-2 rounded text-xs uppercase tracking-wider bg-surface-700 text-text-secondary hover:bg-surface-600 transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            <X size={14} /> Bulk Reject
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-600 flex items-center justify-between">
          <div>
            <h2 className="font-heading text-xl uppercase tracking-wider">Suggestions</h2>
            <p className="text-text-muted text-xs mt-1">
              You can now review high, medium, low, and no-match items. No-match rows are included
              so every uncategorised product can appear somewhere in the workflow.
            </p>
          </div>
          <p className="text-text-muted text-xs">{visibleSuggestions.length} visible</p>
        </div>

        {visibleSuggestions.length === 0 ? (
          <p className="text-text-muted text-center py-10">No suggestions to review yet.</p>
        ) : (
          <div className="divide-y divide-surface-600/50">
            {visibleSuggestions.map((suggestion) => {
              const isBusy = actingId === suggestion.id;
              const band = confidenceBand(Number(suggestion.confidence));
              return (
                <div key={suggestion.id} className="p-4 md:p-5 space-y-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(suggestion.id)}
                        disabled={!["pending", "approved", "rejected"].includes(suggestion.status)}
                        onChange={() => toggleSelected(suggestion.id)}
                        className="mt-1 h-4 w-4 rounded border-surface-500 bg-surface-800 text-brand-red focus:ring-brand-red/50 disabled:opacity-40"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-white">{suggestion.product_name}</p>
                        <p className="text-text-muted text-xs mt-1">
                          Suggested category:{" "}
                          <span className="text-white">
                            {suggestion.suggested_category_id && suggestion.suggested_parent_name
                              ? `${suggestion.suggested_parent_name} / ${suggestion.suggested_category_name}`
                              : suggestion.suggested_category_name}
                          </span>
                        </p>
                        <p className="text-text-muted text-xs mt-1">
                          Confidence: {suggestion.confidence_band === "no_match" ? "No Match" : band}{" "}
                          ({Math.round(Number(suggestion.confidence) * 100)}%)
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded text-[11px] uppercase tracking-wider ${
                          suggestion.status === "approved"
                            ? "bg-green-900/30 text-green-400"
                            : suggestion.status === "applied"
                              ? "bg-blue-900/30 text-blue-300"
                              : suggestion.status === "reverted"
                                ? "bg-purple-900/30 text-purple-300"
                              : suggestion.status === "rejected"
                                ? "bg-surface-600 text-text-muted"
                                : "bg-yellow-900/30 text-yellow-300"
                        }`}
                      >
                        {suggestion.status}
                      </span>

                      {suggestion.status === "pending" && (
                        <>
                          <button
                            onClick={() => runAction(suggestion.id, "approve")}
                            disabled={isBusy || !suggestion.suggested_category_id}
                            className="btn-secondary text-xs px-3 py-2 flex items-center gap-1"
                          >
                            <Check size={14} /> Approve
                          </button>
                          <button
                            onClick={() => openPicker(suggestion)}
                            disabled={isBusy}
                            title="Pick a different category for this product"
                            className="px-3 py-2 rounded text-xs uppercase tracking-wider bg-surface-700 text-text-secondary hover:bg-surface-600 transition-colors flex items-center gap-1"
                          >
                            <Target size={14} /> Pick Category
                          </button>
                          <button
                            onClick={() => runAction(suggestion.id, "reject")}
                            disabled={isBusy}
                            className="px-3 py-2 rounded text-xs uppercase tracking-wider bg-surface-700 text-text-secondary hover:bg-surface-600 transition-colors flex items-center gap-1"
                          >
                            <X size={14} /> Reject
                          </button>
                        </>
                      )}

                      {suggestion.status === "approved" && (
                        <>
                          <button
                            onClick={() => runAction(suggestion.id, "apply")}
                            disabled={isBusy || !suggestion.suggested_category_id}
                            className="btn-primary text-xs px-3 py-2 flex items-center gap-1"
                          >
                            <Play size={14} /> Apply
                          </button>
                          <button
                            onClick={() => openPicker(suggestion)}
                            disabled={isBusy}
                            title="Pick a different category before applying"
                            className="px-3 py-2 rounded text-xs uppercase tracking-wider bg-surface-700 text-text-secondary hover:bg-surface-600 transition-colors flex items-center gap-1"
                          >
                            <Target size={14} /> Pick Category
                          </button>
                          <button
                            onClick={() => runAction(suggestion.id, "reject")}
                            disabled={isBusy}
                            title="Change your mind — mark this as rejected instead"
                            className="px-3 py-2 rounded text-xs uppercase tracking-wider bg-surface-700 text-text-secondary hover:bg-surface-600 transition-colors flex items-center gap-1"
                          >
                            <X size={14} /> Reject
                          </button>
                          <button
                            onClick={() => runAction(suggestion.id, "repend")}
                            disabled={isBusy}
                            title="Move this back to pending for another look"
                            className="px-3 py-2 rounded text-xs uppercase tracking-wider bg-surface-700 text-text-secondary hover:bg-surface-600 transition-colors flex items-center gap-1"
                          >
                            <RotateCcw size={14} /> Re-pend
                          </button>
                        </>
                      )}

                      {suggestion.status === "rejected" && (
                        <>
                          <button
                            onClick={() => runAction(suggestion.id, "approve")}
                            disabled={isBusy || !suggestion.suggested_category_id}
                            title="Change your mind — approve this after all"
                            className="btn-secondary text-xs px-3 py-2 flex items-center gap-1"
                          >
                            <Check size={14} /> Approve
                          </button>
                          <button
                            onClick={() => openPicker(suggestion)}
                            disabled={isBusy}
                            title="Pick a different category"
                            className="px-3 py-2 rounded text-xs uppercase tracking-wider bg-surface-700 text-text-secondary hover:bg-surface-600 transition-colors flex items-center gap-1"
                          >
                            <Target size={14} /> Pick Category
                          </button>
                          <button
                            onClick={() => runAction(suggestion.id, "repend")}
                            disabled={isBusy}
                            title="Move this back to pending"
                            className="px-3 py-2 rounded text-xs uppercase tracking-wider bg-surface-700 text-text-secondary hover:bg-surface-600 transition-colors flex items-center gap-1"
                          >
                            <RotateCcw size={14} /> Re-pend
                          </button>
                        </>
                      )}

                      {suggestion.status === "applied" && (
                        <button
                          onClick={() => runAction(suggestion.id, "revert")}
                          disabled={isBusy}
                          className="px-3 py-2 rounded text-xs uppercase tracking-wider bg-surface-700 text-text-secondary hover:bg-surface-600 transition-colors flex items-center gap-1"
                        >
                          <Undo2 size={14} /> Revert
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-white/70 leading-relaxed">{suggestion.rationale}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {pickerFor && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={closePicker}
        >
          <div
            className="bg-surface-800 border border-surface-600 max-w-2xl w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-surface-600 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-heading text-lg uppercase tracking-wider text-white">
                  Pick a category
                </h3>
                <p className="text-text-muted text-xs mt-1 truncate">
                  For: <span className="text-white">{pickerFor.product_name}</span>
                </p>
                {pickerFor.suggested_category_name && (
                  <p className="text-text-muted text-xs mt-1">
                    Currently suggested:{" "}
                    <span className="text-white">
                      {pickerFor.suggested_parent_name
                        ? `${pickerFor.suggested_parent_name} / ${pickerFor.suggested_category_name}`
                        : pickerFor.suggested_category_name}
                    </span>
                  </p>
                )}
              </div>
              <button
                onClick={closePicker}
                className="text-text-muted hover:text-white transition-colors shrink-0"
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-surface-600 relative">
              <Search size={14} className="absolute left-7 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="Search categories…"
                autoFocus
                className="w-full bg-surface-700 border border-surface-600 rounded pl-9 pr-4 py-2 text-sm text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-red/50"
              />
            </div>

            <div className="overflow-y-auto flex-1">
              {filteredPickerCategories.length === 0 ? (
                <p className="text-text-muted text-center py-8 text-sm">
                  No categories match &ldquo;{pickerQuery}&rdquo;.
                </p>
              ) : (
                <ul className="divide-y divide-surface-600/50">
                  {filteredPickerCategories.map((category) => (
                    <li key={category.id}>
                      <button
                        onClick={() => pickCategory(category.id)}
                        disabled={pickerSubmitting}
                        className="w-full text-left px-5 py-3 hover:bg-surface-700/60 transition-colors disabled:opacity-50 flex items-center justify-between gap-3"
                      >
                        <span className="min-w-0">
                          {category.parent_name && (
                            <span className="text-text-muted text-xs">
                              {category.parent_name} /{" "}
                            </span>
                          )}
                          <span className="text-white">{category.name}</span>
                        </span>
                        <Check
                          size={14}
                          className={`shrink-0 ${
                            category.id === pickerFor.suggested_category_id
                              ? "text-brand-red"
                              : "text-text-muted opacity-0"
                          }`}
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="px-5 py-3 border-t border-surface-600 text-text-muted text-xs">
              Picking a category marks this suggestion as approved with the new category.
              Click <span className="text-white">Apply</span> on the row afterwards to push it
              live (website + Square).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
