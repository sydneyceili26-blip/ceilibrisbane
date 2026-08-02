// Runs before `vite dev` and `vite build` (predev/prebuild hooks); writes public/sitemap.xml.

import { writeFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://ceilimelbourne.com";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/categories", changefreq: "weekly", priority: "0.8" },
  { path: "/search", changefreq: "weekly", priority: "0.6" },
  { path: "/community", changefreq: "daily", priority: "0.8" },
  { path: "/guide", changefreq: "monthly", priority: "0.6" },
  { path: "/map", changefreq: "weekly", priority: "0.6" },
  { path: "/c/housing", changefreq: "daily", priority: "0.8" },
  { path: "/c/jobs", changefreq: "daily", priority: "0.8" },
  { path: "/c/items", changefreq: "daily", priority: "0.7" },
  { path: "/c/service", changefreq: "weekly", priority: "0.7" },
  { path: "/c/event", changefreq: "weekly", priority: "0.7" },
];

async function fetchDynamicEntries(): Promise<SitemapEntry[]> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.warn("Supabase env vars missing; skipping dynamic sitemap entries.");
    return [];
  }
  let supabase;
  try {
    supabase = createClient(url, key);
  } catch {
    console.warn("Invalid Supabase config; skipping dynamic sitemap entries.");
    return [];
  }
  const entries: SitemapEntry[] = [];

  const { data: listings } = await supabase
    .from("listings")
    .select("id, created_at")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(5000);
  (listings ?? []).forEach((l: { id: string; created_at: string }) => {
    entries.push({
      path: `/listing/${l.id}`,
      lastmod: l.created_at.slice(0, 10),
      changefreq: "weekly",
      priority: "0.6",
    });
  });

  const { data: questions } = await supabase
    .from("questions")
    .select("id, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);
  (questions ?? []).forEach((q: { id: string; created_at: string }) => {
    entries.push({
      path: `/community/${q.id}`,
      lastmod: q.created_at.slice(0, 10),
      changefreq: "weekly",
      priority: "0.5",
    });
  });

  return entries;
}

function generateSitemap(entries: SitemapEntry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

(async () => {
  const dynamic = await fetchDynamicEntries();
  const entries = [...staticEntries, ...dynamic];
  writeFileSync(resolve("public/sitemap.xml"), generateSitemap(entries));
  console.log(`sitemap.xml written (${entries.length} entries)`);
})();
