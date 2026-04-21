import { createClient } from "@/lib/supabase/server";
import { Mail, Key, Globe } from "lucide-react";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("name, role")
    .eq("id", user!.id)
    .single();

  return (
    <div className="max-w-2xl">
      <h1 className="font-heading text-3xl uppercase tracking-wider mb-6">Settings</h1>

      {/* Account info */}
      <div className="card p-6 mb-6">
        <h2 className="font-heading text-sm uppercase tracking-wider text-text-muted mb-4">Account</h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-surface-700">
            <span className="text-text-muted">Email</span>
            <span className="text-white">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-surface-700">
            <span className="text-text-muted">Role</span>
            <span className="text-white capitalize">{profile?.role?.replace("_", " ")}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-text-muted">Name</span>
            <span className="text-white">{profile?.name || "—"}</span>
          </div>
        </div>
      </div>

      {/* Integrations */}
      <div className="card p-6 mb-6">
        <h2 className="font-heading text-sm uppercase tracking-wider text-text-muted mb-4">Integrations</h2>
        <div className="space-y-4 text-sm">

          <div className="flex items-start gap-3 p-4 bg-surface-700/50 rounded">
            <Globe size={18} className="text-brand-red mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-white mb-1">Square</p>
              <p className="text-text-muted text-xs">
                Square is your source of truth for products, pricing, inventory, and payments.
                Manage all of that directly in your Square dashboard — changes sync to this site automatically via webhook.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-surface-700/50 rounded">
            <Mail size={18} className="text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-white mb-1">Mailchimp</p>
              <p className="text-text-muted text-xs">
                Newsletter subscribers are stored here and can be exported to CSV at any time.
                To send campaigns, log into{" "}
                <a href="https://mailchimp.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                  Mailchimp
                </a>{" "}
                and import the CSV, or ask your developer to configure the Mailchimp API key for automatic syncing.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-surface-700/50 rounded">
            <Key size={18} className="text-yellow-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-white mb-1">Environment Variables</p>
              <p className="text-text-muted text-xs">
                API keys and secrets (Square, Supabase, Sentry, Mailchimp) are managed in the
                server environment. Contact your developer to update any keys.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Change password note */}
      <div className="card p-6">
        <h2 className="font-heading text-sm uppercase tracking-wider text-text-muted mb-2">Password</h2>
        <p className="text-sm text-text-muted">
          To change your password, go to your{" "}
          <a
            href="https://supabase.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-red hover:underline"
          >
            Supabase dashboard
          </a>{" "}
          → Authentication → Users, or ask your developer.
        </p>
      </div>
    </div>
  );
}
