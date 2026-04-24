/**
 * Google Analytics 4 Data Utility
 * 
 * Fetches real-time analytics data from GA4 API.
 * Requires GA4_PROPERTY_ID environment variable.
 * 
 * Setup instructions:
 * 1. Create service account: https://console.cloud.google.com/iam-admin/serviceaccounts
 * 2. Download JSON key file
 * 3. Add to .env.local:
 *    - GA4_PROPERTY_ID=your-numeric-id
 *    - GA4_SERVICE_ACCOUNT_EMAIL=...@....iam.gserviceaccount.com
 *    - GA4_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
 * 4. Grant service account "Viewer" role in GA4 property
 */

/**
 * Mock analytics data for development/demo purposes
 * Replace with real GA4 API calls when credentials are configured
 */
export async function getAnalyticsData() {
  // Check if GA4 is properly configured
  const hasConfig = !!(
    process.env.GA4_PROPERTY_ID &&
    process.env.GA4_SERVICE_ACCOUNT_EMAIL &&
    process.env.GA4_PRIVATE_KEY
  );

  if (!hasConfig) {
    return null;
  }

  try {
    // Placeholder for future GA4 API integration
    // When credentials are available, this would call the real API:
    // const response = await fetch('https://analyticsdata.googleapis.com/v1beta/properties/{propertyId}:runReport', ...)
    
    return null;
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
