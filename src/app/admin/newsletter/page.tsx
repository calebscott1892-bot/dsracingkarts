import { createClient } from "@/lib/supabase/server";
import { Download, Users } from "lucide-react";
import { NewsletterTable } from "./NewsletterTable";

interface Props {
  searchParams: Promise<{ page?: string; status?: string }>;
}

const PAGE_SIZE = 50;

export default async function AdminNewsletterPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
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
          <p className="text-text-muted text-sm">Total Subscribers</p>
          <p className="font-heading text-4xl text-green-400">{subscribedCount || 0}</p>
        </div>
        <div className="card p-6">
          <p className="text-text-muted text-sm">Total Signups</p>
          <p className="font-heading text-4xl text-blue-400">{count || 0}</p>
        </div>
      </div>

      {/* Mailchimp notice */}
      <div className="card p-5 mb-6 border border-brand-yellow/30 bg-brand-yellow/5">
        <div className="flex items-start gap-3">
          <Users size={18} className="text-brand-yellow mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-brand-yellow mb-1">Sending Emails</p>
            <p className="text-sm text-text-secondary">
              Subscribers are automatically synced to Mailchimp when your API key is configured.
              Log into{" "}
              <a
                href="https://mailchimp.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-yellow hover:underline"
              >
                Mailchimp
              </a>{" "}
              to compose and send campaigns to your list.
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
