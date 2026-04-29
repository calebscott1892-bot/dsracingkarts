import { BarChart2, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { getAnalyticsData, getStubAnalyticsData } from "@/lib/analytics";
import { AnalyticsDashboard } from "./AnalyticsDashboard";

export const metadata: Metadata = {
  title: "Analytics | DSR Admin",
};

const GA_PROPERTY = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "G-VKQDZ8KQ8J";
const GA_PROPERTY_ID = process.env.GA4_PROPERTY_ID ?? null;
export default async function AnalyticsPage() {
  const realData = await getAnalyticsData();
  const isConnected = !!realData;
  const hasPropertyId = isConnected;
  const hasServiceAccount = !!(process.env.GA4_SERVICE_ACCOUNT_EMAIL && process.env.GA4_PRIVATE_KEY);
  const hasOAuth = !!(
    process.env.GA4_OAUTH_CLIENT_ID &&
    process.env.GA4_OAUTH_CLIENT_SECRET &&
    process.env.GA4_OAUTH_REFRESH_TOKEN
  );
  const data = realData ?? getStubAnalyticsData();
  const analyticsHref = GA_PROPERTY_ID
    ? `https://analytics.google.com/analytics/web/#/p${GA_PROPERTY_ID}/reports/intelligenthome`
    : "https://analytics.google.com/analytics/web/";

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-heading text-3xl uppercase tracking-wider">Analytics</h1>
        <a
          href={analyticsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <ExternalLink size={16} />
          Open Google Analytics
        </a>
      </div>

      <div className={`mb-8 p-4 border rounded ${hasPropertyId ? "border-green-500/30 bg-green-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
        <div className="flex items-start gap-3">
          <BarChart2 size={18} className={hasPropertyId ? "text-green-400 shrink-0 mt-0.5" : "text-amber-400 shrink-0 mt-0.5"} />
          <div>
            <p className="font-heading text-sm uppercase tracking-wider mb-1">
              {isConnected ? "Google Analytics Connected" : "Google Analytics Needs Connection"}
            </p>
            <p className="text-text-muted text-sm">
              {hasPropertyId
                ? `GA4 measurement ID ${GA_PROPERTY} is active. Displaying live admin metrics below.`
                : `Showing sample metrics until GA4_PROPERTY_ID and either service-account or OAuth analytics credentials are configured.`}
            </p>
            {!hasPropertyId && (
              <>
                <p className="text-text-muted text-xs mt-2">
                  📍 Find your numeric Property ID: GA4 → Admin (gear) → Property Settings → Property ID
                </p>
                <p className="text-text-muted text-xs mt-1">
                  Missing now: {!GA_PROPERTY_ID ? "GA4_PROPERTY_ID " : ""}{!hasServiceAccount && !hasOAuth ? "analytics credentials" : ""}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <AnalyticsDashboard data={data} />

      <div className="card p-6 border border-surface-600/30 mt-10">
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
            Restart the app after adding the environment variables.
          </li>
          <li>
            Add one of these authentication methods so the admin panel can read GA4 directly:
            <pre className="mt-2 bg-surface-800 border border-surface-600 p-3 text-xs overflow-x-auto text-white/70 rounded ml-6">
{`# Create Google Cloud service account
# Grant it Viewer access to your GA4 property
# Then add these secrets:
GA4_SERVICE_ACCOUNT_EMAIL=...@....iam.gserviceaccount.com
GA4_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n..."

# OR use a normal Google account OAuth refresh token:
GA4_OAUTH_CLIENT_ID=...
GA4_OAUTH_CLIENT_SECRET=...
GA4_OAUTH_REFRESH_TOKEN=...`}
            </pre>
          </li>
        </ol>
        <p className="text-text-muted text-xs">
          The cards above switch from sample data to live GA4 data as soon as these variables are available.
        </p>
      </div>
    </div>
  );
}
