export const SCAFF_LOGO_URL = "/images/history/Scaff.png";
export const CLAW_CONSTRUCTION_LOGO_URL = "/images/history/Claw-Construction-Logo.png";
export const CLAW_RACING_PHOTO_URL = "/images/history/Claw Racing.jpg";

const SCAFF_LEGACY_LOGO_URLS = new Set([
  "/images/history/Scaff it up.jpeg",
  "/images/history/Scaff it up.jpg",
  "public/images/history/Scaff it up.jpeg",
  "public/images/history/Scaff it up.jpg",
]);

export function normalizeTeamLogoUrl(
  logoUrl?: string | null,
  teamName?: string | null,
) {
  const trimmedLogoUrl = logoUrl?.trim();
  const normalizedTeamName = teamName?.trim().toLowerCase();

  if (normalizedTeamName?.includes("claw racing")) {
    return CLAW_CONSTRUCTION_LOGO_URL;
  }

  if (trimmedLogoUrl && SCAFF_LEGACY_LOGO_URLS.has(trimmedLogoUrl)) {
    return SCAFF_LOGO_URL;
  }

  if (!trimmedLogoUrl) {
    if (normalizedTeamName === "scaff it up") return SCAFF_LOGO_URL;
    if (normalizedTeamName?.includes("claw racing")) return CLAW_CONSTRUCTION_LOGO_URL;
    return undefined;
  }

  return trimmedLogoUrl;
}
