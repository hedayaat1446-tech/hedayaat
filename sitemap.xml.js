import site from "../content/site.json";

// Generated at build time. Uses meta.url from site.json, so it updates automatically when the domain changes.
const base = (site.meta?.url || "").replace(/\/+$/, "");
const pages = ["/", "/board/", "/governance/", "/transparency/", "/accessibility/", "/privacy/", "/reports/", "/videos/", "/participation/"];

export function GET() {
  const urls = pages.map((ar) => {
    const en = ar === "/" ? "/en/" : `/en${ar}`;
    const alts = `<xhtml:link rel="alternate" hreflang="ar" href="${base}${ar}"/><xhtml:link rel="alternate" hreflang="en" href="${base}${en}"/>`;
    return `<url><loc>${base}${ar}</loc>${alts}</url><url><loc>${base}${en}</loc>${alts}</url>`;
  }).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
