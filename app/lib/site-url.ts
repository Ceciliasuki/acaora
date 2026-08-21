const fallbackSiteUrl = "https://acaora-dp12ulx0tbef.edgeone.dev";

export function getSiteUrl(pathname = "/") {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || fallbackSiteUrl;

  try {
    const url = new URL(configuredUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("INVALID_SITE_PROTOCOL");
    return new URL(pathname, url).toString();
  } catch {
    return new URL(pathname, fallbackSiteUrl).toString();
  }
}
