import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { TeamProfileForm } from "@/components/admin/TeamProfileForm";
import { TeamResultsPanel } from "@/components/admin/TeamResultsPanel";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditTeamPage({ params }: Props) {
  const { id } = await params;
  const supabase = createServiceClient();

  const [{ data: team }, { data: results }] = await Promise.all([
    supabase.from("team_profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("team_results").select("*").eq("team_profile_id", id).order("event_date", { ascending: false }),
  ]);

  if (!team) notFound();

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin/team"
          className="flex items-center gap-1 text-text-muted hover:text-white text-sm transition-colors"
        >
          <ChevronLeft size={16} /> Team Profiles
        </Link>
        <h1 className="font-heading text-3xl uppercase tracking-wider">{team.team_name}</h1>
      </div>
      <TeamProfileForm team={team} />
      <TeamResultsPanel teamId={id} initialResults={results ?? []} />
    </div>
  );
}
