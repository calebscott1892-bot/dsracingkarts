import { AnnouncementForm } from "@/components/admin/AnnouncementForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function NewAnnouncementPage() {
  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin/announcements"
          className="flex items-center gap-1 text-text-muted hover:text-white text-sm transition-colors"
        >
          <ChevronLeft size={16} /> Announcements
        </Link>
        <h1 className="font-heading text-3xl uppercase tracking-wider">New Announcement</h1>
      </div>
      <AnnouncementForm isNew />
    </div>
  );
}
