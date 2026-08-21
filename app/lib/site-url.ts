const localDevelopmentUrl = "http://localhost:3000";

function parseHttpUrl(value?: string | null) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function firstForwardedValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || null;
}

function isTrustedRequestOrigin(url: URL) {
  const hostname = url.hostname.toLowerCase();
  if (url.protocol === "https:" && hostname.endsWith(".edgeone.dev")) return true;
  return url.protocol === "http:" && (hostname === "localhost" || hostname === "127.0.0.1");
}

/**
 * Returns the externally visible request origin for EdgeOne preview/deployment
 * hosts. Custom production domains must be configured through SITE_URL.
 */
export function getRequestSiteOrigin(request: Request) {
  const forwardedHost = firstForwardedValue(request.headers.get("x-forwarded-host"));
  const forwardedProtocol = firstForwardedValue(request.headers.get("x-forwarded-proto"));
  const candidates = [
    request.headers.get("origin"),
    forwardedHost ? `${forwardedProtocol || "https"}://${forwardedHost}` : null,
    new URL(request.url).origin,
  ];

  for (const candidate of candidates) {
    const url = parseHttpUrl(candidate);
    if (url && isTrustedRequestOrigin(url)) return url.origin;
  }
  return undefined;
}

export function getSiteUrl(pathname = "/", requestOrigin?: string) {
  const candidates = [
    process.env.SITE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    requestOrigin,
    process.env.NODE_ENV === "development" ? localDevelopmentUrl : undefined,
  ];

  for (const candidate of candidates) {
    const url = parseHttpUrl(candidate);
    if (url) return new URL(pathname, url).toString();
  }

  // metadataBase requires an absolute URL during static builds. Authentication
  // routes never use this value because they always pass the live request origin.
  return new URL(pathname, localDevelopmentUrl).toString();
}
