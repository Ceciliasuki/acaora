import { NextRequest, NextResponse } from "next/server";
import { fetchWithTimeout } from "../../../lib/http";

type UnknownRecord = Record<string, unknown>;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length < 3) {
    return NextResponse.json({ error: "请输入至少三个字符。" }, { status: 400 });
  }

  try {
    const fields = "paperId,title,authors,year,abstract,citationCount,url,openAccessPdf,venue,externalIds";
    const response = await fetchWithTimeout(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=10&fields=${fields}`, {
      headers: { "User-Agent": "Acaora-PaperLab/1.0" },
    }, 8_000);
    if (!response.ok) throw new Error(`Semantic Scholar ${response.status}`);
    const payload = await response.json() as { data?: UnknownRecord[] };
    const papers = (payload.data ?? []).map((item) => normalizeSemanticScholar(item));
    return NextResponse.json({ source: "Semantic Scholar", papers });
  } catch {
    try {
      const select = "DOI,title,author,published,container-title,URL,abstract,is-referenced-by-count";
      const response = await fetchWithTimeout(`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(query)}&rows=10&select=${select}`, {
        headers: { "User-Agent": "Acaora-PaperLab/1.0" },
      }, 8_000);
      if (!response.ok) throw new Error(`Crossref ${response.status}`);
      const payload = await response.json() as { message?: { items?: UnknownRecord[] } };
      const papers = (payload.message?.items ?? []).map((item) => normalizeCrossref(item));
      return NextResponse.json({ source: "Crossref", papers });
    } catch {
      return NextResponse.json({ error: "公共学术索引暂时不可用，请稍后重试。" }, { status: 503 });
    }
  }
}

function normalizeSemanticScholar(item: UnknownRecord) {
  const authors = Array.isArray(item.authors) ? item.authors as UnknownRecord[] : [];
  const externalIds = (item.externalIds ?? {}) as UnknownRecord;
  const openAccessPdf = (item.openAccessPdf ?? {}) as UnknownRecord;
  return {
    id: String(item.paperId ?? externalIds.DOI ?? crypto.randomUUID()),
    title: String(item.title ?? "Untitled"),
    authors: authors.map((author) => String(author.name ?? "")).filter(Boolean),
    year: typeof item.year === "number" ? item.year : null,
    venue: String(item.venue ?? ""),
    abstract: String(item.abstract ?? ""),
    citationCount: Number(item.citationCount ?? 0),
    url: String(item.url ?? ""),
    pdfUrl: String(openAccessPdf.url ?? ""),
    doi: String(externalIds.DOI ?? ""),
    source: "Semantic Scholar" as const,
  };
}

function normalizeCrossref(item: UnknownRecord) {
  const authors = Array.isArray(item.author) ? item.author as UnknownRecord[] : [];
  const published = (item.published ?? {}) as { [key: string]: unknown };
  const dateParts = Array.isArray(published["date-parts"]) ? published["date-parts"] as unknown[][] : [];
  const titles = Array.isArray(item.title) ? item.title as string[] : [];
  const venues = Array.isArray(item["container-title"]) ? item["container-title"] as string[] : [];
  return {
    id: String(item.DOI ?? crypto.randomUUID()),
    title: titles[0] ?? "Untitled",
    authors: authors.map((author) => `${String(author.given ?? "")} ${String(author.family ?? "")}`.trim()).filter(Boolean),
    year: typeof dateParts[0]?.[0] === "number" ? dateParts[0][0] : null,
    venue: venues[0] ?? "",
    abstract: String(item.abstract ?? "").replace(/<[^>]+>/g, ""),
    citationCount: Number(item["is-referenced-by-count"] ?? 0),
    url: String(item.URL ?? ""),
    pdfUrl: "",
    doi: String(item.DOI ?? ""),
    source: "Crossref" as const,
  };
}
