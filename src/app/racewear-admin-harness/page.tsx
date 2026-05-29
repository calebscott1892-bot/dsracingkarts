"use client";

import { useEffect } from "react";
import { RacewearManager } from "../admin/racewear/RacewearManager";

declare global {
  interface Window {
    __racewearRequests?: unknown[];
  }
}

const sampleEntries = [
  {
    id: "pm-front",
    group_label: "Polaris Marine",
    image_url: "/images/history/racewear2.webp",
    alt_text: "PM front",
    sort_order: 0,
    created_at: "2026-05-18T00:00:00.000Z",
    is_active: true,
    is_featured: true,
  },
  {
    id: "pm-back",
    group_label: "Polaris Marine",
    image_url: "/images/history/racewear6.webp",
    alt_text: "PM back",
    sort_order: 1,
    created_at: "2026-05-18T01:00:00.000Z",
    is_active: true,
    is_featured: true,
  },
  {
    id: "ncr-front",
    group_label: "NCR",
    image_url: "/images/history/racewear3.webp",
    alt_text: "NCR front",
    sort_order: 2,
    created_at: "2026-05-18T02:00:00.000Z",
    is_active: true,
    is_featured: true,
  },
  {
    id: "stratco-front",
    group_label: "Stratco",
    image_url: "/images/history/racewear4.webp",
    alt_text: "Stratco front",
    sort_order: 3,
    created_at: "2026-05-18T03:00:00.000Z",
    is_active: true,
    is_featured: true,
  },
];

export default function RacewearAdminHarnessPage() {
  useEffect(() => {
    window.__racewearRequests = [];
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("/api/admin/racewear")) {
        if (init?.body && typeof init.body === "string") {
          window.__racewearRequests?.push(JSON.parse(init.body));
        }
        if (init?.method === "POST") {
          return Response.json(
            {
              entries: [
                {
                  id: `new-${Date.now()}`,
                  group_label: "Polaris Marine",
                  image_url: "/images/history/racewear5.jpg",
                  alt_text: "Uploaded test photo",
                  sort_order: 4,
                  created_at: "2026-05-18T04:00:00.000Z",
                  is_active: true,
                  is_featured: true,
                },
              ],
            },
            { status: 201 }
          );
        }
        return Response.json({ success: true });
      }
      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <main className="min-h-screen bg-surface-900 p-8 text-white">
      <RacewearManager initialEntries={sampleEntries} />
    </main>
  );
}
