import { createClient } from "@/lib/supabase/server";
import { CheckCircle2, Download, Mail, Send, Users } from "lucide-react";
import { NewsletterTable } from "./NewsletterTable";

interface Props {
  searchParams: Promise<{ page?: string; status?: string }>;
}

const PAGE_SIZE = 50;

async function getMailchimpSummary() {
  const apiKey = process.env.MAILCHIMP_API_KEY;
  const listId = process.env.MAILCHIMP_LIST_ID;

  if (!apiKey || !listId) {
    return { connected: false as const };
  }

  try {
    const dc = apiKey.split("-").pop();
    const headers = { Authorization: `apikey ${apiKey}` };

    const [listRes, campaignRes] = await Promise.all([
      fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${listId}`, {
        headers,
        cache: "no-store",
      }),
      fetch(`https://${dc}.api.mailchimp.com/3.0/campaigns?count=1&sort_field=send_time&sort_dir=DESC`, {
        headers,
        cache: "no-store",
      }),
    ]);

    if (!listRes.ok) {
      return { connected: false as const, error: `Mailchimp list lookup failed (${listRes.status})` };
    }

    const list = await listRes.json();
    const campaignData = campaignRes.ok ? await campaignRes.json() : null;
    const latestCampaign = campaignData?.campaigns?.[0] ?? null;

    return {
      connected: true as const,
      audienceName: list.name as string,
      audienceCount: Number(list.stats?.member_count ?? 0),
      campaignCount: Number(campaignData?.total_items ?? 0),
      latestCampaignTitle: latestCampaign?.settings?.title as string | undefined,
      latestCampaignSentAt: latestCampaign?.send_time as string | undefined,
    };
  } catch (error) {
    return {
      connected: false as const,
      error: error instanceof Error ? error.message : "Mailchimp request failed",
    };
  }
}

export default async function AdminNewsletterPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const mailchimp = await getMailchimpSummary();
  const page = parseInt(params.page || "1", 10);
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("newsletter_subscribers")
    .select("id, email, subscribed, source, created_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (params.status === "subscribed") query = query.eq("subscribed", true);
  if (params.status === "unsubscribed") query = query.eq("subscribed", false);

  query = query.range(offset, offset + PAGE_SIZE - 1);

  const { data: subscribers, count } = await query;
  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  // Stats
  const { count: subscribedCount } = await supabase
    .from("newsletter_subscribers")
    .select("*", { count: "exact", head: true })
    .eq("subscribed", true);

  const { count: totalSignupCount } = await supabase
    .from("newsletter_subscribers")
    .select("*", { count: "exact", head: true });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-3xl uppercase tracking-wider">Newsletter</h1>
        <a
          href="/api/admin/newsletter/export"
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Download size={16} /> Export CSV
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card p-6">
          <p className="text-text-muted text-sm">Website Subscribers</p>
          <p className="font-heading text-4xl text-green-400">{subscribedCount || 0}</p>
        </div>
        <div className="card p-6">
          <p className="text-text-muted text-sm">Website Signups</p>
          <p className="font-heading text-4xl text-blue-400">{totalSignupCount || 0}</p>
        </div>
      </div>

      <div className="grid gap-4 mb-6 lg:grid-cols-3">
        <div className={`card p-5 border ${mailchimp.connected ? "border-green-500/30 bg-green-500/5" : "border-brand-yellow/30 bg-brand-yellow/5"} lg:col-span-2`}>
          <div className="flex items-start gap-3">
            {mailchimp.connected ? (
              <CheckCircle2 size={18} className="text-green-400 mt-0.5 shrink-0" />
            ) : (
              <Users size={18} className="text-brand-yellow mt-0.5 shrink-0" />
            )}
            <div>
              <p className={`text-sm font-semibold mb-1 ${mailchimp.connected ? "text-green-400" : "text-brand-yellow"}`}>
                {mailchimp.connected ? "Mailchimp Connected" : "Mailchimp Status"}
              </p>
              <p className="text-sm text-text-secondary">
                {mailchimp.connected
                  ? `This admin table shows website-captured signups only. Your full sendable audience lives in Mailchimp under ${mailchimp.audienceName}.`
                  : "The website signup table is separate from your full Mailchimp audience. If Mailchimp is connected elsewhere, those contacts will not automatically appear in this local table unless they signed up through this site."}
              </p>
              {mailchimp.connected && (
                <p className="text-xs text-text-muted mt-2">
                  Use Mailchimp to send campaigns. This page is best treated as a website signup log plus quick export.
                </p>
              )}
              {!mailchimp.connected && mailchimp.error && (
                <p className="text-xs text-text-muted mt-2">Connection check: {mailchimp.error}</p>
              )}
            </div>
          </div>
        </div>

        <div className="card p-5">
          <p className="text-text-muted text-xs uppercase tracking-wider mb-3">Mailchimp Snapshot</p>
          {mailchimp.connected ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-muted flex items-center gap-2"><Users size={14} /> Audience</span>
                <span className="text-white font-medium">{mailchimp.audienceCount}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-muted flex items-center gap-2"><Send size={14} /> Campaigns</span>
                <span className="text-white font-medium">{mailchimp.campaignCount}</span>
              </div>
              <div className="pt-2 border-t border-surface-700">
                <p className="text-text-muted text-xs mb-1">Latest campaign</p>
                <p className="text-white text-sm">{mailchimp.latestCampaignTitle || "No campaign title found"}</p>
                <p className="text-text-muted text-xs mt-1">
                  {mailchimp.latestCampaignSentAt
                    ? new Date(mailchimp.latestCampaignSentAt).toLocaleString("en-AU")
                    : "No sent campaign found"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              No live Mailchimp summary available from this environment right now.
            </p>
          )}
        </div>
      </div>

      <div className="card p-5 mb-6 border border-surface-600/40">
        <div className="flex items-start gap-3">
          <Mail size={18} className="text-blue-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white mb-1">What this page actually manages</p>
            <p className="text-sm text-text-secondary">
              Emails listed here are newsletter signups captured through this website. They are not an inbox, and customers cannot send messages to these addresses through this screen.
              For broadcasts and campaign reporting, work in{" "}
              <a
                href="https://mailchimp.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                Mailchimp
              </a>.
            </p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { label: "All", value: "" },
          { label: "Subscribed", value: "subscribed" },
          { label: "Unsubscribed", value: "unsubscribed" },
        ].map((tab) => (
          <a
            key={tab.value}
            href={`/admin/newsletter${tab.value ? `?status=${tab.value}` : ""}`}
            className={`px-3 py-2 rounded text-xs uppercase tracking-wider transition-colors ${
              (params.status || "") === tab.value
                ? "bg-brand-red text-white"
                : "bg-surface-700 text-text-secondary hover:bg-surface-600"
            }`}
          >
            {tab.label}
          </a>
        ))}
      </div>

      {/* Table */}
      <NewsletterTable initialSubscribers={subscribers ?? []} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`/admin/newsletter?page=${p}${params.status ? `&status=${params.status}` : ""}`}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                p === page
                  ? "bg-brand-red text-white"
                  : "bg-surface-700 text-text-secondary hover:bg-surface-600"
              }`}
            >
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
