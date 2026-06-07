export interface ChassisPageContent {
  id: number;
  hero_eyebrow: string;
  hero_title: string;
  hero_accent: string;
  hero_body: string;
  hero_cta_label: string;
  featured_eyebrow: string;
  featured_title: string;
  featured_body: string;
  featured_primary_cta_label: string;
  featured_secondary_cta_label: string;
  featured_image_url: string;
  featured_image_alt: string;
  featured_image_caption: string;
  active_listings_heading: string;
  listing_form_heading: string;
  listing_form_intro: string;
  updated_at?: string | null;
}

type ChassisPageContentInput = Partial<Record<keyof ChassisPageContent, unknown>>;

const FIELD_LIMITS: Record<Exclude<keyof ChassisPageContent, "id" | "updated_at">, number> = {
  hero_eyebrow: 80,
  hero_title: 120,
  hero_accent: 80,
  hero_body: 400,
  hero_cta_label: 80,
  featured_eyebrow: 80,
  featured_title: 160,
  featured_body: 600,
  featured_primary_cta_label: 80,
  featured_secondary_cta_label: 80,
  featured_image_url: 600,
  featured_image_alt: 200,
  featured_image_caption: 300,
  active_listings_heading: 120,
  listing_form_heading: 120,
  listing_form_intro: 500,
};

export const DEFAULT_CHASSIS_PAGE_CONTENT: ChassisPageContent = {
  id: 1,
  hero_eyebrow: "DS Racing Karts",
  hero_title: "DSR",
  hero_accent: "Predator",
  hero_body:
    "Australian-built. Enduro-proven. The chassis of choice for serious endurance karting competitors across NSW.",
  hero_cta_label: "Buy or Sell a Predator",
  featured_eyebrow: "Used Chassis",
  featured_title: "Used Chassis For Sale",
  featured_body:
    "Current used chassis photo. Contact DS Racing Karts for availability, inspection details, and what is included with the chassis.",
  featured_primary_cta_label: "Ask About This Chassis",
  featured_secondary_cta_label: "List Yours",
  featured_image_url: "/Chasis/image.png",
  featured_image_alt: "Used red kart chassis available through DS Racing Karts",
  featured_image_caption: "Used chassis available through DS Racing Karts.",
  active_listings_heading: "Active Listings",
  listing_form_heading: "List Your Chassis",
  listing_form_intro:
    "Looking to buy or sell a used DSR Predator? Fill in the form below. DS Racing Karts will review your submission and publish it to this board.",
};

export const CHASSIS_PAGE_CONTENT_FIELDS = Object.keys(FIELD_LIMITS) as Array<
  Exclude<keyof ChassisPageContent, "id" | "updated_at">
>;

function normalizeText(value: unknown, fallback: string, maxLength: number) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, maxLength);
}

export function mergeChassisPageContent(row?: ChassisPageContentInput | null): ChassisPageContent {
  const merged: ChassisPageContent = { ...DEFAULT_CHASSIS_PAGE_CONTENT };

  if (!row) return merged;

  for (const field of CHASSIS_PAGE_CONTENT_FIELDS) {
    merged[field] = normalizeText(row[field], DEFAULT_CHASSIS_PAGE_CONTENT[field], FIELD_LIMITS[field]);
  }

  merged.id = Number(row.id) || 1;
  merged.updated_at = typeof row.updated_at === "string" ? row.updated_at : null;
  return merged;
}

export function sanitizeChassisPageContentInput(input: ChassisPageContentInput) {
  const sanitized: Record<string, string> = {};

  for (const field of CHASSIS_PAGE_CONTENT_FIELDS) {
    if (input[field] === undefined) continue;
    sanitized[field] = normalizeText(input[field], DEFAULT_CHASSIS_PAGE_CONTENT[field], FIELD_LIMITS[field]);
  }

  return sanitized;
}
