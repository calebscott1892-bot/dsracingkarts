export function isRemoteImageUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://");
}

export function isPlaceholderImageUrl(url: string | null | undefined) {
  return Boolean(url && url.includes("image-coming-soon"));
}

export function isRealProductImageUrl(url: string | null | undefined): url is string {
  return Boolean(url && !isPlaceholderImageUrl(url));
}
