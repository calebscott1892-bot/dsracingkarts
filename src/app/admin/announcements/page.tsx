import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Pencil, Megaphone } from "lucide-react";

const TYPE_COLORS: Record<string, string> = {
  info: "bg-blue-500/10 text-blue-400",
  warning: "bg-yellow-500/10 text-yellow-400",
  event: "bg-purple-500/10 text-purple-400",
  promo: "bg-green-500/10 text-green-400",
};

export default async function AdminAnnouncementsPage() {
  const supabase = await createClient();
  const { data: announcements } = await supabase
    .from("announcements")
    .select("*")
    .order("sort_order")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-3xl uppercase tracking-wider">Announcements</h1>
        <Link href="/admin/announcements/new" className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> New Announcement
        </Link>
      </div>

      <p className="text-text-secondary text-sm mb-6">
        Active announcements display as a banner at the top of every page. Use dates to schedule ahead of time.
      </p>

      <div className="card overflow-hidden">
        {announcements && announcements.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-surface-700">
              <tr>
                <th className="px-4 py-3 text-left text-text-muted font-medium">Title</th>
                <th className="px-4 py-3 text-left text-text-muted font-medium">Type</th>
                <th className="px-4 py-3 text-left text-text-muted font-medium">Status</th>
                <th className="px-4 py-3 text-left text-text-muted font-medium">Schedule</th>
                <th className="px-4 py-3 text-right text-text-muted font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700">
              {announcements.map((a) => {
                const now = new Date();
                const starts = a.starts_at ? new Date(a.starts_at) : null;
                const ends = a.ends_at ? new Date(a.ends_at) : null;
                const isLive =
                  a.is_active &&
                  (!starts || starts <= now) &&
                  (!ends || ends >= now);

                return (
                  <tr key={a.id} className="hover:bg-surface-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{a.title}</p>
                      <p className="text-text-muted text-xs line-clamp-1">{a.body}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium capitalize ${TYPE_COLORS[a.type] || "bg-surface-600 text-text-muted"}`}
                      >
                        {a.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          isLive
                            ? "bg-green-500/10 text-green-400"
                            : "bg-surface-600 text-text-muted"
                        }`}
                      >
                        {isLive ? "Live" : a.is_active ? "Scheduled" : "Hidden"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-muted text-xs">
                      {starts ? starts.toLocaleDateString("en-AU") : "—"} →{" "}
                      {ends ? ends.toLocaleDateString("en-AU") : "ongoing"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/announcements/${a.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-surface-700 hover:bg-surface-600 text-text-secondary hover:text-white transition-colors"
                      >
                        <Pencil size={12} /> Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center">
            <Megaphone size={32} className="mx-auto mb-3 text-text-muted" />
            <p className="text-text-muted mb-4">No announcements yet.</p>
            <Link href="/admin/announcements/new" className="btn-primary text-sm">
              Create Your First Announcement
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
