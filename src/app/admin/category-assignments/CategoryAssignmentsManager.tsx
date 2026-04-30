"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ShieldCheck, Check, X, Play, RefreshCw, Undo2 } from "lucide-react";

type Suggestion = {
  id: string;
  product_id: string;
  product_square_token: string | null;
  product_name: string;
  suggested_category_id: string;
  suggested_category_name: string;
  suggested_parent_name: string | null;
  confidence: number;
  rationale: string;
  status: "pending" | "approved" | "rejected" | "applied" | "skipped" | "reverted";
  created_at: string;
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
    high: number;
    medium: number;
    low: number;
  };
  suggestions: Suggestion[];
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
}: Props) {
  const router = useRouter();
  const [isGenerating, startGenerating] = useTransition();
  const [actingId, setActingId] = useState<string | null>(null);
  const [isBulkActing, startBulkAction] = useTransition();
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "applied">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const visibleSuggestions = useMemo(() => {
    if (statusFilter === "all") return suggestions;
    return suggestions.filter((suggestion) => suggestion.status === statusFilter);
  }, [statusFilter, suggestions]);

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

  async function runAction(id: string, action: "approve" | "reject" | "apply" | "revert") {
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

        <button
          onClick={generateSuggestions}
          disabled={isGenerating}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          {isGenerating ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {isGenerating ? "Generating..." : "Generate Suggestions"}
        </button>
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
        </div>
      </div>

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
          { key: "pending", label: "Pending" },
          { key: "approved", label: "Approved" },
          { key: "applied", label: "Applied" },
        ].map((filter) => (
          <button
            key={filter.key}
            onClick={() => setStatusFilter(filter.key as "all" | "pending" | "approved" | "applied")}
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
              Showing high and medium confidence suggestions only. Low-confidence items remain for
              manual review.
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
                            {suggestion.suggested_parent_name
                              ? `${suggestion.suggested_parent_name} / ${suggestion.suggested_category_name}`
                              : suggestion.suggested_category_name}
                          </span>
                        </p>
                        <p className="text-text-muted text-xs mt-1">
                          Confidence: {band} ({Math.round(Number(suggestion.confidence) * 100)}%)
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
                            disabled={isBusy}
                            className="btn-secondary text-xs px-3 py-2 flex items-center gap-1"
                          >
                            <Check size={14} /> Approve
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
                        <button
                          onClick={() => runAction(suggestion.id, "apply")}
                          disabled={isBusy}
                          className="btn-primary text-xs px-3 py-2 flex items-center gap-1"
                        >
                          <Play size={14} /> Apply
                        </button>
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
    </div>
  );
}
