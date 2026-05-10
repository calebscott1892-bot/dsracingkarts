import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { AnnouncementForm } from "@/components/admin/AnnouncementForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditAnnouncementPage({ params }: Props) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: announcement } = await supabase
    .from("announcements")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!announcement) notFound();

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin/announcements"
          className="flex items-center gap-1 text-text-muted hover:text-white text-sm transition-colors"
        >
          <ChevronLeft size={16} /> Announcements
        </Link>
        <h1 className="font-heading text-3xl uppercase tracking-wider line-clamp-1">{announcement.title}</h1>
      </div>
      <AnnouncementForm announcement={announcement} />
    </div>
  );
}
