export const SCAFF_LOGO_URL = "/images/history/Scaff.png";

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

  if (trimmedLogoUrl && SCAFF_LEGACY_LOGO_URLS.has(trimmedLogoUrl)) {
    return SCAFF_LOGO_URL;
  }

  if (!trimmedLogoUrl) {
    return normalizedTeamName === "scaff it up" ? SCAFF_LOGO_URL : undefined;
  }

  return trimmedLogoUrl;
}
