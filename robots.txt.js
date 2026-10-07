import site from "../content/site.json";

const base = (site.meta?.url || "").replace(/\/+$/, "");

export function GET() {
  const body = `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nDisallow: /thank/\nDisallow: /en/thank/\n\nSitemap: ${base}/sitemap.xml\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
