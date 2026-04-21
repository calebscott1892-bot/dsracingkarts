import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Pencil, Flag } from "lucide-react";

export default async function AdminTeamPage() {
  const supabase = await createClient();
  const { data: teams } = await supabase
    .from("team_profiles")
    .select("*")
    .order("sort_order")
    .order("team_name");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-3xl uppercase tracking-wider">Team Profiles</h1>
        <Link href="/admin/team/new" className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Add Team
        </Link>
      </div>

      <div className="card overflow-hidden">
        {teams && teams.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-surface-700">
              <tr>
                <th className="px-4 py-3 text-left text-text-muted font-medium w-16">#</th>
                <th className="px-4 py-3 text-left text-text-muted font-medium">Team</th>
                <th className="px-4 py-3 text-left text-text-muted font-medium">Kart No.</th>
                <th className="px-4 py-3 text-left text-text-muted font-medium">Status</th>
                <th className="px-4 py-3 text-left text-text-muted font-medium w-24">Order</th>
                <th className="px-4 py-3 text-right text-text-muted font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700">
              {teams.map((team) => (
                <tr key={team.id} className="hover:bg-surface-700/50 transition-colors">
                  <td className="px-4 py-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: team.accent_color + "20", color: team.accent_color }}
                    >
                      {team.kart_number}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {team.logo_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={team.logo_url} alt={team.team_name} className="w-8 h-8 rounded object-cover" />
                      )}
                      <div>
                        <p className="text-white font-medium">{team.team_name}</p>
                        {team.tagline && <p className="text-text-muted text-xs">{team.tagline}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">#{team.kart_number}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        team.is_active
                          ? "bg-green-500/10 text-green-400"
                          : "bg-surface-600 text-text-muted"
                      }`}
                    >
                      {team.is_active ? "Visible" : "Hidden"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{team.sort_order}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/team/${team.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-surface-700 hover:bg-surface-600 text-text-secondary hover:text-white transition-colors"
                    >
                      <Pencil size={12} /> Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center">
            <Flag size={32} className="mx-auto mb-3 text-text-muted" />
            <p className="text-text-muted mb-4">No team profiles yet.</p>
            <Link href="/admin/team/new" className="btn-primary text-sm">
              Add Your First Team
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
