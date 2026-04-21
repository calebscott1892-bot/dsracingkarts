import { TeamProfileForm } from "@/components/admin/TeamProfileForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function NewTeamPage() {
  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin/team"
          className="flex items-center gap-1 text-text-muted hover:text-white text-sm transition-colors"
        >
          <ChevronLeft size={16} /> Team Profiles
        </Link>
        <h1 className="font-heading text-3xl uppercase tracking-wider">Add Team</h1>
      </div>
      <TeamProfileForm isNew />
    </div>
  );
}
