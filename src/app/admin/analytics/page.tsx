import { ExternalLink, BarChart2, Users, Clock, Globe, MousePointerClick } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics | DSR Admin",
};

const GA_PROPERTY = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "G-VKQDZ8KQ8J";
// GA4 property ID (numeric) — different from measurement ID.
// Find it in: GA4 → Admin → Property Settings → Property ID.
const GA_PROPERTY_ID = process.env.GA4_PROPERTY_ID ?? null;

const GA_REPORTS_URL = `https://analytics.google.com/analytics/web/#/p${GA_PROPERTY_ID ?? "XXXXXXXXX"}/reports/intelligenthome`;
const GA_REALTIME_URL = `https://analytics.google.com/analytics/web/#/realtime`;

export default function AnalyticsPage() {
  const hasPropertyId = !!GA_PROPERTY_ID;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-heading text-3xl uppercase tracking-wider">Analytics</h1>
        <a
          href="https://analytics.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <ExternalLink size={14} />
          Open Google Analytics
        </a>
      </div>

      {/* GA4 Status banner */}
      <div className={`mb-8 p-4 border ${hasPropertyId ? "border-green-500/30 bg-green-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
        <div className="flex items-start gap-3">
          <BarChart2 size={18} className={hasPropertyId ? "text-green-400 shrink-0 mt-0.5" : "text-amber-400 shrink-0 mt-0.5"} />
          <div>
            <p className="font-heading text-sm uppercase tracking-wider mb-1">
              {hasPropertyId ? "Google Analytics Connected" : "Partial Setup — Action Needed"}
            </p>
            <p className="text-text-muted text-sm">
              {hasPropertyId
                ? `GA4 measurement ID ${GA_PROPERTY} is active. Use the quick links below to view your data.`
                : `GA4 tracking (${GA_PROPERTY}) is active on the site. To see in-panel analytics, add your numeric GA4 Property ID as the environment variable GA4_PROPERTY_ID.`}
            </p>
            {!hasPropertyId && (
              <p className="text-text-muted text-xs mt-2">
                Find your Property ID in: Google Analytics → Admin (gear icon) → Property Settings → Property ID (a number like 123456789).
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        <QuickLinkCard
          icon={<Users size={20} className="text-blue-400" />}
          title="Audience Overview"
          description="Visitors, sessions, new vs returning users."
          href="https://analytics.google.com/analytics/web/#/reports/reportinghub"
        />
        <QuickLinkCard
          icon={<MousePointerClick size={20} className="text-purple-400" />}
          title="Top Pages"
          description="Which pages get the most traffic."
          href="https://analytics.google.com/analytics/web/#/reports/reportinghub"
        />
        <QuickLinkCard
          icon={<Globe size={20} className="text-green-400" />}
          title="Traffic Sources"
          description="Where your visitors come from — search, social, direct."
          href="https://analytics.google.com/analytics/web/#/reports/reportinghub"
        />
        <QuickLinkCard
          icon={<Clock size={20} className="text-amber-400" />}
          title="Engagement"
          description="Average session duration, bounce rate, time on site."
          href="https://analytics.google.com/analytics/web/#/reports/reportinghub"
        />
        <QuickLinkCard
          icon={<BarChart2 size={20} className="text-red-400" />}
          title="Real-Time"
          description="See who's on the site right now."
          href={GA_REALTIME_URL}
        />
        <QuickLinkCard
          icon={<ExternalLink size={20} className="text-text-muted" />}
          title="Full Dashboard"
          description="Open the complete Google Analytics dashboard."
          href="https://analytics.google.com"
        />
      </div>

      {/* Setup guide for deeper integration */}
      <div className="card p-6">
        <h2 className="font-heading text-lg uppercase tracking-wider mb-4">Enable In-Panel Analytics</h2>
        <p className="text-text-muted text-sm mb-4">
          To display live visitor data directly in this panel (no need to open Google Analytics separately),
          a Google service account with read access to your GA4 property is required. Here&apos;s how to set it up:
        </p>
        <ol className="space-y-3 text-sm text-text-muted list-decimal list-inside">
          <li>
            Go to{" "}
            <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-brand-red hover:underline">
              Google Cloud Console
            </a>{" "}
            → create a service account → download the JSON key.
          </li>
          <li>
            In{" "}
            <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="text-brand-red hover:underline">
              Google Analytics
            </a>{" "}
            → Admin → Property Access Management → add the service account email as a Viewer.
          </li>
          <li>
            Add these to your <code className="text-white/70 bg-surface-700 px-1 py-0.5 rounded text-xs">.env.local</code> (and Vercel env vars):
            <pre className="mt-2 bg-surface-800 border border-surface-600 p-3 text-xs overflow-x-auto text-white/70 rounded">
{`GA4_PROPERTY_ID=123456789
GOOGLE_SA_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"`}
            </pre>
          </li>
          <li>
            Once set, this page will automatically display live metrics: page views, sessions,
            top pages, referrers, and session duration — all without leaving the admin panel.
          </li>
        </ol>
      </div>
    </div>
  );
}

function QuickLinkCard({
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="card p-5 flex items-start gap-4 hover:border-brand-red/40 transition-colors group"
    >
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div>
        <p className="font-heading text-sm uppercase tracking-wider text-white mb-1 group-hover:text-brand-red transition-colors">
          {title}
        </p>
        <p className="text-text-muted text-xs leading-relaxed">{description}</p>
      </div>
      <ExternalLink size={12} className="ml-auto shrink-0 text-text-muted/40 group-hover:text-brand-red/60 transition-colors mt-1" />
    </a>
  );
}
