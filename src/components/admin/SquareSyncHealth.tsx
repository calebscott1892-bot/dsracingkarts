"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, CheckCircle2, AlertTriangle, Activity } from "lucide-react";

type Status = {
  env: {
    accessTokenPresent: boolean;
    locationIdPresent: boolean;
    webhookSecretPresent: boolean;
    serviceRolePresent: boolean;
    siteUrl: string | null;
    environment: string;
  };
  square: { ok: boolean; locationName?: string | null; error?: string };
  db: {
    products: number;
    activeProducts: number;
    variations: number;
    lastWebhookAt: string | null;
    lastWebhookType: string | null;
    lastResyncAt: string | null;
    lastResyncSummary: string | null;
  };
};

type SyncPhase = "categories" | "items" | "archive";
type SyncTotals = {
  scanned: number;
  synced: number;
  failed: number;
  categoriesSynced: number;
};

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function SquareSyncHealth() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [resyncing, setResyncing] = useState(false);
  const [resyncResult, setResyncResult] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/square-status", { cache: "no-store" });
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch {
      // The panel will keep the previous state if status refresh fails.
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleResync() {
    if (
      !confirm(
        "Pull the full Square catalog into the site now? This may take several minutes for a large catalog. Keep this tab open until it finishes."
      )
    ) {
      return;
    }

    setResyncing(true);
    setResyncResult(null);

    try {
      let phase: SyncPhase = "categories";
      let cursor: string | null = null;
      let totals: SyncTotals = {
        scanned: 0,
        synced: 0,
        failed: 0,
        categoriesSynced: 0,
      };

      for (let step = 0; step < 250; step++) {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 55_000);
        const res: Response = await fetch("/api/admin/square-resync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chunked: true, phase, cursor, totals }),
          signal: controller.signal,
        }).finally(() => window.clearTimeout(timeout));
        const contentType = res.headers.get("content-type") || "";
        const data = contentType.includes("application/json")
          ? await res.json()
          : { error: (await res.text()).slice(0, 180) || `Server returned ${res.status}` };

        if (!res.ok) {
          setResyncResult(data.error || "Resync failed");
          return;
        }

        totals = data.totals || {
          scanned: totals.scanned + (data.scanned || 0),
          synced: totals.synced + (data.synced || 0),
          failed: totals.failed + (data.failed || 0),
          categoriesSynced: totals.categoriesSynced + (data.categoriesSynced || 0),
        };

        setResyncResult(
          `Syncing ${
            phase === "categories" ? "categories" : phase === "archive" ? "cleanup" : "products"
          }... ` +
            `${totals.synced}/${totals.scanned} synced, ${totals.categoriesSynced} categories` +
            `${totals.failed ? `, ${totals.failed} failed` : ""}`
        );

        if (data.done) {
          setResyncResult(
            `Synced ${totals.synced}/${totals.scanned}, ${totals.categoriesSynced} categories` +
              `${totals.failed ? `, ${totals.failed} failed` : ""}`
          );
          refresh();
          return;
        }

        phase = data.nextPhase || phase;
        cursor = data.cursor || null;
      }

      setResyncResult("Resync paused after too many batches. Click Resync Now again to continue.");
    } catch (err: any) {
      setResyncResult(
        err?.name === "AbortError"
          ? "This sync batch took too long and was stopped. Refresh and try Resync Now again."
          : err?.message || "Network error during resync"
      );
    } finally {
      setResyncing(false);
    }
  }

  const envOk =
    !!status &&
    status.env.accessTokenPresent &&
    status.env.locationIdPresent &&
    status.env.webhookSecretPresent &&
    status.env.serviceRolePresent;
  const squareOk = status?.square.ok ?? false;
  const overallOk = envOk && squareOk;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-text-muted" />
          <h2 className="font-heading text-xl uppercase tracking-wider">Square Sync</h2>
          {!loading && status && (
            <span
              className={`inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${
                overallOk
                  ? "bg-green-900/30 text-green-400"
                  : "bg-yellow-900/30 text-yellow-400"
              }`}
            >
              {overallOk ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
              {overallOk ? "Healthy" : "Check"}
            </span>
          )}
        </div>
        <button
          onClick={handleResync}
          disabled={resyncing || !envOk}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 rounded text-xs text-text-secondary hover:text-white transition-colors disabled:opacity-50"
          title={!envOk ? "Square environment isn't fully configured" : ""}
        >
          <RefreshCw size={12} className={resyncing ? "animate-spin" : ""} />
          {resyncing ? "Resyncing..." : "Resync Now"}
        </button>
      </div>

      {loading || !status ? (
        <p className="text-text-muted text-sm">Loading status...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Row
            label="Square API"
            ok={status.square.ok}
            value={
              status.square.ok
                ? `Connected - ${status.square.locationName ?? "location"}`
                : status.square.error || "Disconnected"
            }
          />
          <Row
            label="Webhook secret"
            ok={status.env.webhookSecretPresent}
            value={status.env.webhookSecretPresent ? "Configured" : "Missing"}
          />
          <Row
            label="Service role key"
            ok={status.env.serviceRolePresent}
            value={status.env.serviceRolePresent ? "Configured" : "Missing"}
          />
          <Row label="Environment" ok={true} neutral value={status.env.environment.toUpperCase()} />
          <Row
            label="Last webhook"
            ok={!!status.db.lastWebhookAt}
            neutral={!status.db.lastWebhookAt}
            value={
              status.db.lastWebhookAt
                ? `${timeAgo(status.db.lastWebhookAt)}${status.db.lastWebhookType ? ` - ${status.db.lastWebhookType}` : ""}`
                : "No events received yet"
            }
          />
          <Row
            label="Last full resync"
            ok={!!status.db.lastResyncAt}
            neutral={!status.db.lastResyncAt}
            value={
              status.db.lastResyncAt
                ? `${timeAgo(status.db.lastResyncAt)}${status.db.lastResyncSummary ? ` - ${status.db.lastResyncSummary}` : ""}`
                : "Never run"
            }
          />
          <Row
            label="Local products"
            ok={true}
            neutral
            value={`${status.db.activeProducts} active - ${status.db.products} total - ${status.db.variations} variations`}
          />
        </div>
      )}

      {resyncResult && (
        <p className="mt-4 text-xs font-mono text-text-secondary">{resyncResult}</p>
      )}

      {!status?.env.webhookSecretPresent && (
        <p className="mt-4 text-[11px] text-yellow-400 leading-relaxed">
          To enable real-time sync, set <code>SQUARE_WEBHOOK_SIGNATURE_KEY</code> on Vercel
          and register the webhook URL{" "}
          <code>{status?.env.siteUrl || "https://dsracingkarts.com.au"}/api/webhooks/square</code>{" "}
          in the Square Developer portal.
        </p>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  ok,
  neutral,
}: {
  label: string;
  value: string;
  ok: boolean;
  neutral?: boolean;
}) {
  const colour = neutral ? "text-text-secondary" : ok ? "text-green-400" : "text-yellow-400";
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-surface-700/50">
      <span className="text-text-muted uppercase tracking-wider text-[10px]">{label}</span>
      <span className={`text-right text-xs font-mono truncate max-w-[60%] ${colour}`} title={value}>
        {value}
      </span>
    </div>
  );
}
