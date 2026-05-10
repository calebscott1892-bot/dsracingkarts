import { createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Pencil, Flag, ImageIcon, EyeOff } from "lucide-react";
import { normalizeTeamLogoUrl } from "@/lib/teamLogos";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminTeamPage() {
  const supabase = createServiceClient();
  const { data: teams } = await supabase
    .from("team_profiles")
    .select("*")
    .order("sort_order")
    .order("team_name");
  const teamRows = teams ?? [];
  const visibleCount = teamRows.filter((team) => team.is_active).length;
  const missingLogoCount = teamRows.filter((team) => !normalizeTeamLogoUrl(team.logo_url, team.team_name)).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-3xl uppercase tracking-wider">Team Profiles</h1>
        <Link href="/admin/team/new" className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Add Team
        </Link>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-text-muted">Total Profiles</p>
          <p className="mt-1 font-heading text-2xl text-white">{teamRows.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-text-muted">Visible On Site</p>
          <p className="mt-1 font-heading text-2xl text-green-400">{visibleCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-text-muted">Missing Images</p>
          <p className="mt-1 font-heading text-2xl text-white">{missingLogoCount}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        {teamRows.length > 0 ? (
          <>
          <div className="divide-y divide-surface-700 md:hidden">
            {teamRows.map((team) => {
              const logoUrl = normalizeTeamLogoUrl(team.logo_url, team.team_name);

              return (
                <Link
                  key={team.id}
                  href={`/admin/team/${team.id}`}
                  className="block p-4 transition-colors hover:bg-surface-700/50"
                  aria-label={`Edit ${team.team_name}`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{ background: `${team.accent_color || "#ef4444"}20`, color: team.accent_color || "#ef4444" }}
                    >
                      {team.kart_number ? `#${team.kart_number}` : "TBA"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-white">{team.team_name}</p>
                          {team.tagline && <p className="mt-0.5 truncate text-xs text-text-muted">{team.tagline}</p>}
                        </div>
                        <span className="shrink-0 rounded bg-surface-700 px-2 py-1 text-xs text-text-secondary">
                          Edit
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium ${
                            logoUrl
                              ? "bg-blue-500/10 text-blue-300"
                              : "bg-amber-500/10 text-amber-300"
                          }`}
                        >
                          {logoUrl ? <ImageIcon size={12} /> : <EyeOff size={12} />}
                          {logoUrl ? "Image set" : "Missing image"}
                        </span>
                        <span
                          className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                            team.is_active
                              ? "bg-green-500/10 text-green-400"
                              : "bg-surface-600 text-text-muted"
                          }`}
                        >
                          {team.is_active ? "Visible" : "Hidden"}
                        </span>
                        <span className="text-xs text-text-muted">Order {team.sort_order}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <table className="hidden w-full text-sm md:table">
            <thead className="bg-surface-700">
              <tr>
                <th className="px-4 py-3 text-left text-text-muted font-medium w-16">#</th>
                <th className="px-4 py-3 text-left text-text-muted font-medium">Team</th>
                <th className="px-4 py-3 text-left text-text-muted font-medium">Kart No.</th>
                <th className="px-4 py-3 text-left text-text-muted font-medium">Image</th>
                <th className="px-4 py-3 text-left text-text-muted font-medium">Status</th>
                <th className="px-4 py-3 text-left text-text-muted font-medium w-24">Order</th>
                <th className="px-4 py-3 text-right text-text-muted font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700">
              {teamRows.map((team) => {
                const logoUrl = normalizeTeamLogoUrl(team.logo_url, team.team_name);
                const editHref = `/admin/team/${team.id}`;

                return (
                  <tr key={team.id} className="hover:bg-surface-700/50 transition-colors">
                    <td className="p-0">
                      <Link href={editHref} className="block px-4 py-3" aria-label={`Edit ${team.team_name}`}>
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ background: `${team.accent_color || "#ef4444"}20`, color: team.accent_color || "#ef4444" }}
                        >
                          {team.kart_number || "TBA"}
                        </div>
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link href={editHref} className="block px-4 py-3">
                        <div className="flex items-center gap-3">
                          {logoUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={logoUrl} alt={team.team_name} className="w-8 h-8 rounded object-cover" />
                          )}
                          <div>
                            <p className="text-white font-medium transition-colors hover:text-brand-red">
                              {team.team_name}
                            </p>
                            {team.tagline && <p className="text-text-muted text-xs">{team.tagline}</p>}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link href={editHref} className="block px-4 py-3 text-text-secondary">
                        {team.kart_number ? `#${team.kart_number}` : "TBA"}
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link href={editHref} className="block px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${
                            logoUrl
                              ? "bg-blue-500/10 text-blue-300"
                              : "bg-amber-500/10 text-amber-300"
                          }`}
                        >
                          {logoUrl ? <ImageIcon size={12} /> : <EyeOff size={12} />}
                          {logoUrl ? "Set" : "Missing"}
                        </span>
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link href={editHref} className="block px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            team.is_active
                              ? "bg-green-500/10 text-green-400"
                              : "bg-surface-600 text-text-muted"
                          }`}
                        >
                          {team.is_active ? "Visible" : "Hidden"}
                        </span>
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link href={editHref} className="block px-4 py-3 text-text-secondary">
                        {team.sort_order}
                      </Link>
                    </td>
                    <td className="p-0 text-right">
                      <Link href={editHref} className="block px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-surface-700 hover:bg-surface-600 text-text-secondary hover:text-white transition-colors">
                          <Pencil size={12} /> Edit
                        </span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </>
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
