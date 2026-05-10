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

          <div className="hidden overflow-x-auto text-sm md:block">
            <div className="grid min-w-[920px] grid-cols-[72px_minmax(220px,1fr)_120px_120px_120px_96px_120px] bg-surface-700 text-text-muted">
              <div className="px-4 py-3 font-medium">#</div>
              <div className="px-4 py-3 font-medium">Team</div>
              <div className="px-4 py-3 font-medium">Kart No.</div>
              <div className="px-4 py-3 font-medium">Image</div>
              <div className="px-4 py-3 font-medium">Status</div>
              <div className="px-4 py-3 font-medium">Order</div>
              <div className="px-4 py-3 text-right font-medium">Actions</div>
            </div>

            <div className="divide-y divide-surface-700">
              {teamRows.map((team) => {
                const logoUrl = normalizeTeamLogoUrl(team.logo_url, team.team_name);
                const editHref = `/admin/team/${team.id}`;

                return (
                  <Link
                    key={team.id}
                    href={editHref}
                    className="grid min-w-[920px] grid-cols-[72px_minmax(220px,1fr)_120px_120px_120px_96px_120px] items-center transition-colors hover:bg-surface-700/50 focus-visible:bg-surface-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/50"
                    aria-label={`Edit ${team.team_name}`}
                  >
                    <div className="px-4 py-3">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                        style={{ background: `${team.accent_color || "#ef4444"}20`, color: team.accent_color || "#ef4444" }}
                      >
                        {team.kart_number || "TBA"}
                      </div>
                    </div>
                    <div className="min-w-0 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {logoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={logoUrl} alt={team.team_name} className="h-8 w-8 shrink-0 rounded object-cover" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-white transition-colors hover:text-brand-red">
                            {team.team_name}
                          </p>
                          {team.tagline && <p className="truncate text-xs text-text-muted">{team.tagline}</p>}
                        </div>
                      </div>
                    </div>
                    <div className="px-4 py-3 text-text-secondary">
                      {team.kart_number ? `#${team.kart_number}` : "TBA"}
                    </div>
                    <div className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium ${
                          logoUrl
                            ? "bg-blue-500/10 text-blue-300"
                            : "bg-amber-500/10 text-amber-300"
                        }`}
                      >
                        {logoUrl ? <ImageIcon size={12} /> : <EyeOff size={12} />}
                        {logoUrl ? "Set" : "Missing"}
                      </span>
                    </div>
                    <div className="px-4 py-3">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                          team.is_active
                            ? "bg-green-500/10 text-green-400"
                            : "bg-surface-600 text-text-muted"
                        }`}
                      >
                        {team.is_active ? "Visible" : "Hidden"}
                      </span>
                    </div>
                    <div className="px-4 py-3 text-text-secondary">{team.sort_order}</div>
                    <div className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1.5 rounded bg-surface-700 px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-600 hover:text-white">
                        <Pencil size={12} /> Edit
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
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
