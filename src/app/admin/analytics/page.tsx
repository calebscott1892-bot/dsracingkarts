import { ExternalLink, BarChart2, Users, Clock, Globe, MousePointerClick } from "lucide-react";
import type { Metadata } from "next";
import { getStubAnalyticsData } from "@/lib/analytics";
import { AnalyticsDashboard } from "./AnalyticsDashboard";

export const metadata: Metadata = {
  title: "Analytics | DSR Admin",
};

const GA_PROPERTY = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "G-VKQDZ8KQ8J";
const GA_PROPERTY_ID = process.env.GA4_PROPERTY_ID ?? null;
const GA_REALTIME_URL = `https://analytics.google.com/analytics/web/#/realtime`;

export default function AnalyticsPage() {
  const hasPropertyId = !!GA_PROPERTY_ID;
  const data = getStubAnalyticsData();

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

      <div className={`mb-8 p-4 border rounded ${hasPropertyId ? "border-green-500/30 bg-green-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
        <div className="flex items-start gap-3">
          <BarChart2 size={18} className={hasPropertyId ? "text-green-400 shrink-0 mt-0.5" : "text-amber-400 shrink-0 mt-0.5"} />
          <div>
            <p className="font-heading text-sm uppercase tracking-wider mb-1">
              {hasPropertyId ? "Google Analytics Connected" : "In-Panel Analytics Demo"}
            </p>
            <p className="text-text-muted text-sm">
              {hasPropertyId
                ? `GA4 measurement ID ${GA_PROPERTY} is active. Displaying real-time metrics below.`
                : `Showing sample metrics. To display REAL data, add GA4_PROPERTY_ID environment variable.`}
            </p>
            {!hasPropertyId && (
              <>
                <p className="text-text-muted text-xs mt-2">
                  📍 Find your numeric Property ID: GA4 → Admin (gear) → Property Settings → Property ID
                </p>
                <p className="text-text-muted text-xs mt-1">
                  Add to .env.local: GA4_PROPERTY_ID=123456789
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <AnalyticsDashboard data={data} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10 mb-10">
        <QuickLinkCard
          icon={<Users size={20} className="text-blue-400" />}
          title="Audience Overview"
          description="Detailed visitor and session breakdown."
          href="https://analytics.google.com/analytics/web/#/reports/reportinghub"
        />
        <QuickLinkCard
          icon={<MousePointerClick size={20} className="text-purple-400" />}
          title="Top Pages Report"
          description="See which pages drive the most traffic."
          href="https://analytics.google.com/analytics/web/#/reports/reportinghub"
        />
        <QuickLinkCard
          icon={<Globe size={20} className="text-green-400" />}
          title="Traffic Sources"
          description="Organic, direct, referral, and paid traffic breakdown."
          href="https://analytics.google.com/analytics/web/#/reports/reportinghub"
        />
        <QuickLinkCard
          icon={<Clock size={20} className="text-amber-400" />}
          title="Engagement"
          description="Time on site, bounce rate, and user behavior."
          href="https://analytics.google.com/analytics/web/#/reports/reportinghub"
        />
        <QuickLinkCard
          icon={<BarChart2 size={20} className="text-red-400" />}
          title="Real-Time"
          description="See who is on the site right now."
          href={GA_REALTIME_URL}
        />
        <QuickLinkCard
          icon={<ExternalLink size={20} className="text-text-muted" />}
          title="Full Dashboard"
          description="Open complete Google Analytics dashboard."
          href="https://analytics.google.com"
        />
      </div>

      <div className="card p-6 border border-surface-600/30">
        <h2 className="font-heading text-lg uppercase tracking-wider mb-4">Enable Real Analytics</h2>
        <p className="text-text-muted text-sm mb-4">
          The dashboard above shows sample data. To display REAL metrics from your Google Analytics account:
        </p>
        <ol className="space-y-3 text-sm text-text-muted list-decimal list-inside mb-4">
          <li>
            Find your GA4 Property ID (numeric, like 123456789):
            <br />
            <span className="text-xs ml-6 block">Google Analytics → Admin → Property Settings → Property ID</span>
          </li>
          <li>
            Add to your .env.local:
            <pre className="mt-2 bg-surface-800 border border-surface-600 p-3 text-xs overflow-x-auto text-white/70 rounded ml-6">
              GA4_PROPERTY_ID=123456789
            </pre>
          </li>
          <li>
            Restart your dev server. The dashboard will now show REAL metrics if GA4 has tracked your domain.
          </li>
          <li>
            For advanced integration (pulling data directly via API):
            <pre className="mt-2 bg-surface-800 border border-surface-600 p-3 text-xs overflow-x-auto text-white/70 rounded ml-6">
{`# Create Google Cloud service account
# Grant it Viewer access to your GA4 property
# Then add these secrets:
GOOGLE_SA_CLIENT_EMAIL=...@....iam.gserviceaccount.com
GOOGLE_SA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n..."`}
            </pre>
          </li>
        </ol>
        <p className="text-text-muted text-xs">
          💡 For now: Use the quick links above to access the full GA dashboard, or add your Property ID for in-panel metrics.
        </p>
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
