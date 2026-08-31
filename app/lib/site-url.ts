const localDevelopmentUrl = "http://localhost:3000";
const unsetProductionUrl = "https://acaora.invalid";

function parseHttpUrl(value?: string | null) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

export function getConfiguredSiteUrl() {
  return parseHttpUrl(process.env.SITE_URL)?.origin;
}

export function getSiteUrl(pathname = "/") {
  const configured = getConfiguredSiteUrl();
  if (configured) return new URL(pathname, configured).toString();
  if (process.env.NODE_ENV !== "production") return new URL(pathname, localDevelopmentUrl).toString();
  return new URL(pathname, unsetProductionUrl).toString();
}

export function requireSiteUrl(pathname = "/") {
  const configured = getConfiguredSiteUrl();
  if (!configured) throw new Error("SITE_URL_NOT_CONFIGURED");
  return new URL(pathname, configured).toString();
}
