import { createSign } from "crypto";

const GA_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DATA_API_BASE = "https://analyticsdata.googleapis.com/v1beta";

type AnalyticsData = ReturnType<typeof getStubAnalyticsData>;

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function getPrivateKey() {
  return process.env.GA4_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

async function getOAuthRefreshAccessToken() {
  const clientId = process.env.GA4_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GA4_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GA4_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GA refresh token request failed (${response.status}): ${text.slice(0, 160)}`);
  }

  const data = await response.json();
  return data.access_token as string;
}

async function getAccessToken() {
  const oauthAccessToken = await getOAuthRefreshAccessToken();
  if (oauthAccessToken) return oauthAccessToken;

  const clientEmail = process.env.GA4_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getPrivateKey();
  if (!clientEmail || !privateKey) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(
    JSON.stringify({
      iss: clientEmail,
      scope: GA_SCOPE,
      aud: TOKEN_URL,
      exp: now + 3600,
      iat: now,
    })
  );
  const unsignedJwt = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedJwt);
  const signature = signer.sign(privateKey);

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsignedJwt}.${base64Url(signature)}`,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GA token request failed (${response.status}): ${text.slice(0, 160)}`);
  }

  const data = await response.json();
  return data.access_token as string;
}

async function gaRequest<T>(path: string, body: Record<string, unknown>, accessToken: string): Promise<T> {
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) throw new Error("GA4_PROPERTY_ID is missing");

  const response = await fetch(`${DATA_API_BASE}/properties/${propertyId}:${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GA4 ${path} failed (${response.status}): ${text.slice(0, 160)}`);
  }

  return response.json();
}

function metric(row: any, index: number) {
  return Number(row?.metricValues?.[index]?.value ?? 0);
}

function dimension(row: any, index: number) {
  return String(row?.dimensionValues?.[index]?.value ?? "");
}

function secondsToDuration(seconds: number) {
  const rounded = Math.round(seconds);
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/**
 * Mock analytics data for development/demo purposes
 * Replace with real GA4 API calls when credentials are configured
 */
export async function getAnalyticsData() {
  const hasServiceAccountConfig = !!(
    process.env.GA4_PROPERTY_ID &&
    process.env.GA4_SERVICE_ACCOUNT_EMAIL &&
    process.env.GA4_PRIVATE_KEY
  );
  const hasOAuthConfig = !!(
    process.env.GA4_PROPERTY_ID &&
    process.env.GA4_OAUTH_CLIENT_ID &&
    process.env.GA4_OAUTH_CLIENT_SECRET &&
    process.env.GA4_OAUTH_REFRESH_TOKEN
  );
  const hasConfig = hasServiceAccountConfig || hasOAuthConfig;

  if (!hasConfig) {
    return null;
  }

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) return null;

    const [realtime, summary, topPages, trafficSources, conversionEvents] = await Promise.all([
      gaRequest<any>(
        "runRealtimeReport",
        { metrics: [{ name: "activeUsers" }] },
        accessToken
      ),
      gaRequest<any>(
        "runReport",
        {
          dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
          metrics: [
            { name: "activeUsers" },
            { name: "newUsers" },
            { name: "totalUsers" },
            { name: "sessions" },
            { name: "bounceRate" },
            { name: "averageSessionDuration" },
          ],
        },
        accessToken
      ),
      gaRequest<any>(
        "runReport",
        {
          dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
          dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
          metrics: [{ name: "activeUsers" }, { name: "sessions" }],
          orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
          limit: 5,
        },
        accessToken
      ),
      gaRequest<any>(
        "runReport",
        {
          dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
          dimensions: [{ name: "sessionDefaultChannelGroup" }],
          metrics: [{ name: "sessions" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: 5,
        },
        accessToken
      ),
      gaRequest<any>(
        "runReport",
        {
          dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
          dimensions: [{ name: "eventName" }],
          metrics: [{ name: "eventCount" }],
          dimensionFilter: {
            filter: {
              fieldName: "eventName",
              inListFilter: {
                values: ["page_view", "add_to_cart", "begin_checkout", "purchase"],
              },
            },
          },
        },
        accessToken
      ),
    ]);

    const summaryRow = summary.rows?.[0];
    const totalSessions = trafficSources.rows?.reduce(
      (sum: number, row: any) => sum + metric(row, 0),
      0
    ) || 0;
    const eventCounts = new Map(
      (conversionEvents.rows || []).map((row: any) => [dimension(row, 0), metric(row, 0)])
    );
    const pageViews = Number(eventCounts.get("page_view") || 0);
    const purchases = Number(eventCounts.get("purchase") || 0);

    return {
      audienceMetrics: {
        activeUsers: metric(realtime.rows?.[0], 0),
        newUsers: metric(summaryRow, 1),
        totalUsers: metric(summaryRow, 2),
        sessions: metric(summaryRow, 3),
        bounceRate: `${(metric(summaryRow, 4) * 100).toFixed(1)}%`,
        avgSessionDuration: secondsToDuration(metric(summaryRow, 5)),
      },
      topPages: (topPages.rows || []).map((row: any) => ({
        page: dimension(row, 0) || "/",
        pageTitle: dimension(row, 1) || dimension(row, 0) || "Untitled page",
        users: metric(row, 0),
        sessions: metric(row, 1),
      })),
      trafficSources: (trafficSources.rows || []).map((row: any) => {
        const count = metric(row, 0);
        return {
          source: dimension(row, 0) || "Unassigned",
          count,
          percentage: totalSessions > 0 ? Math.round((count / totalSessions) * 100) : 0,
        };
      }),
      conversionEvents: {
        pageViews,
        addToCart: Number(eventCounts.get("add_to_cart") || 0),
        checkout: Number(eventCounts.get("begin_checkout") || 0),
        purchase: purchases,
        conversionRate: pageViews > 0 ? `${((purchases / pageViews) * 100).toFixed(2)}%` : "0.00%",
      },
    } satisfies AnalyticsData;
  } catch (error) {
    console.error("GA4 API Error:", error);
    return null;
  }
}

/**
 * Get stub analytics data for UI testing/demo
 * Shows realistic sample data structure
 */
export function getStubAnalyticsData() {
  return {
    audienceMetrics: {
      activeUsers: 12,
      newUsers: 3,
      totalUsers: 284,
      sessions: 156,
      bounceRate: "42.3%",
      avgSessionDuration: "2:34",
    },
    topPages: [
      { page: "/shop", pageTitle: "Shop All Products", users: 94, sessions: 127 },
      { page: "/", pageTitle: "Home", users: 56, sessions: 89 },
      { page: "/product", pageTitle: "Product Details", users: 38, sessions: 62 },
      { page: "/about", pageTitle: "About Us", users: 22, sessions: 34 },
      { page: "/checkout", pageTitle: "Checkout", users: 18, sessions: 28 },
    ],
    trafficSources: [
      { source: "organic", count: 89, percentage: 57 },
      { source: "direct", count: 42, percentage: 27 },
      { source: "referral", count: 18, percentage: 12 },
      { source: "social", count: 7, percentage: 4 },
    ],
    conversionEvents: {
      pageViews: 2341,
      addToCart: 67,
      checkout: 28,
      purchase: 12,
      conversionRate: "0.51%",
    },
  };
}
