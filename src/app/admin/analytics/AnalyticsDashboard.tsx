"use client";

import { TrendingUp, BarChart3, Users, Activity, Target, Calendar } from "lucide-react";

interface MetricsData {
  audienceMetrics: {
    activeUsers: number;
    newUsers: number;
    totalUsers: number;
    sessions: number;
    bounceRate: string;
    avgSessionDuration: string;
  };
  topPages: Array<{
    page: string;
    pageTitle: string;
    users: number;
    sessions: number;
  }>;
  trafficSources: Array<{
    source: string;
    count: number;
    percentage: number;
  }>;
  conversionEvents: {
    pageViews: number;
    addToCart: number;
    checkout: number;
    purchase: number;
    conversionRate: string;
  };
}

export function AnalyticsDashboard({ data }: { data: MetricsData }) {
  return (
    <>
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Active Users"
          value={data.audienceMetrics.activeUsers}
          subtext="Last 30 mins"
          icon={<Activity size={20} className="text-blue-400" />}
        />
        <MetricCard
          label="Sessions"
          value={data.audienceMetrics.sessions}
          subtext="Last 30 days"
          icon={<BarChart3 size={20} className="text-cyan-400" />}
        />
        <MetricCard
          label="New Users"
          value={data.audienceMetrics.newUsers}
          subtext="Last 30 days"
          icon={<Users size={20} className="text-emerald-400" />}
        />
        <MetricCard
          label="Total Users"
          value={data.audienceMetrics.totalUsers}
          subtext="Last 30 days"
          icon={<Users size={20} className="text-green-400" />}
        />
        <MetricCard
          label="Bounce Rate"
          value={data.audienceMetrics.bounceRate}
          subtext="Last 7 days"
          icon={<Target size={20} className="text-purple-400" />}
        />
        <MetricCard
          label="Avg Session"
          value={data.audienceMetrics.avgSessionDuration}
          subtext="Last 7 days"
          icon={<Calendar size={20} className="text-amber-400" />}
        />
      </div>

      {/* Top Pages */}
      <div className="card p-6 mb-8">
        <h2 className="font-heading text-lg uppercase tracking-wider mb-4 flex items-center gap-2">
          <BarChart3 size={18} className="text-blue-400" />
          Top Pages
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-muted text-left border-b border-surface-600">
                <th className="pb-3 px-0">Page</th>
                <th className="pb-3 px-0 text-right">Users</th>
                <th className="pb-3 px-0 text-right">Sessions</th>
              </tr>
            </thead>
            <tbody>
              {data.topPages.map((page, idx) => (
                <tr key={idx} className="border-b border-surface-600/50 hover:bg-surface-700/30 transition-colors">
                  <td className="py-3 px-0">
                    <div className="text-white font-medium">{page.pageTitle}</div>
                    <div className="text-text-muted text-xs">{page.page}</div>
                  </td>
                  <td className="py-3 px-0 text-right text-white font-medium">{page.users}</td>
                  <td className="py-3 px-0 text-right text-text-muted">{page.sessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Traffic Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card p-6">
          <h2 className="font-heading text-lg uppercase tracking-wider mb-4">Traffic Sources</h2>
          <div className="space-y-4">
            {data.trafficSources.map((source, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-text-secondary capitalize text-sm font-medium">{source.source}</span>
                  <span className="text-white font-mono text-sm">{source.count}</span>
                </div>
                <div className="w-full h-2 bg-surface-700 rounded overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-red to-amber-500 transition-all"
                    style={{ width: `${source.percentage}%` }}
                  />
                </div>
                <div className="text-text-muted text-xs mt-1">{source.percentage}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* Conversion Funnel */}
        <div className="card p-6">
          <h2 className="font-heading text-lg uppercase tracking-wider mb-4">Conversion Funnel</h2>
          <div className="space-y-4">
            <FunnelStep
              label="Page Views"
              value={data.conversionEvents.pageViews}
              percentage={100}
              color="from-blue-500 to-blue-600"
            />
            <FunnelStep
              label="Add to Cart"
              value={data.conversionEvents.addToCart}
              percentage={data.conversionEvents.pageViews > 0 ? (data.conversionEvents.addToCart / data.conversionEvents.pageViews) * 100 : 0}
              color="from-purple-500 to-purple-600"
            />
            <FunnelStep
              label="Checkout"
              value={data.conversionEvents.checkout}
              percentage={data.conversionEvents.pageViews > 0 ? (data.conversionEvents.checkout / data.conversionEvents.pageViews) * 100 : 0}
              color="from-amber-500 to-amber-600"
            />
            <FunnelStep
              label="Purchase"
              value={data.conversionEvents.purchase}
              percentage={data.conversionEvents.pageViews > 0 ? (data.conversionEvents.purchase / data.conversionEvents.pageViews) * 100 : 0}
              color="from-green-500 to-green-600"
            />
            <div className="mt-6 pt-4 border-t border-surface-600">
              <p className="text-text-muted text-sm mb-2">Conversion Rate</p>
              <p className="text-white text-2xl font-heading">{data.conversionEvents.conversionRate}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function MetricCard({
  label,
  value,
  subtext,
  icon,
  trend,
}: {
  label: string;
  value: string | number;
  subtext: string;
  icon: React.ReactNode;
  trend?: string;
}) {
  return (
    <div className="card p-5 flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div className="shrink-0">{icon}</div>
        {trend && <div className="text-green-400 text-xs font-medium flex items-center gap-1"><TrendingUp size={12} />{trend}</div>}
      </div>
      <p className="text-text-muted text-xs uppercase tracking-wider mb-2">{label}</p>
      <p className="text-white text-2xl font-heading mb-1">{value}</p>
      <p className="text-text-muted text-xs">{subtext}</p>
    </div>
  );
}

function FunnelStep({
  label,
  value,
  percentage,
  color,
}: {
  label: string;
  value: number;
  percentage: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-text-secondary text-sm font-medium">{label}</span>
        <span className="text-white font-mono text-sm">{value}</span>
      </div>
      <div className="w-full h-3 bg-surface-700 rounded overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${color} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-text-muted text-xs mt-1">{percentage.toFixed(1)}%</div>
    </div>
  );
}
