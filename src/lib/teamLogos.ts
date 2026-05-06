export const SCAFF_LOGO_URL = "/images/history/Scaff.png";
export const CLAW_CONSTRUCTION_LOGO_URL = "/images/history/Claw-Construction-Logo.png";
export const CLAW_RACING_PHOTO_URL = "/images/history/Claw Racing.jpg";
export const SKIDMARK_LOGO_URL = "/images/history/Skidmark Logo.jpeg";

const SCAFF_LEGACY_LOGO_URLS = new Set([
  "/images/history/Scaff it up.jpeg",
  "/images/history/Scaff it up.jpg",
  "public/images/history/Scaff it up.jpeg",
  "public/images/history/Scaff it up.jpg",
]);

const SKIDMARK_LEGACY_LOGO_URLS = new Set([
  "/images/history/Skid Mark Marcing.jpeg",
  "public/images/history/Skid Mark Marcing.jpeg",
]);

export function normalizeTeamLogoUrl(
  logoUrl?: string | null,
  _teamName?: string | null,
) {
  const trimmedLogoUrl = logoUrl?.trim();

  if (trimmedLogoUrl && SCAFF_LEGACY_LOGO_URLS.has(trimmedLogoUrl)) {
    return SCAFF_LOGO_URL;
  }

  if (trimmedLogoUrl && SKIDMARK_LEGACY_LOGO_URLS.has(trimmedLogoUrl)) {
    return SKIDMARK_LOGO_URL;
  }

  return trimmedLogoUrl || undefined;
}
