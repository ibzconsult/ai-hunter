import * as cheerio from 'cheerio';

export type ScrapePage = {
  url: string;
  title: string;
  metaDescription: string;
  h1: string[];
  h2: string[];
  lists: string[];
  ctas: string[];
  mainText: string;
};

export type ScrapeData = {
  url: string;
  pages: ScrapePage[];
  contacts: { emails: string[]; phones: string[]; whatsapp: string[] };
  socials: { instagram?: string; linkedin?: string; facebook?: string; youtube?: string };
  totalChars: number;
};

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

const INTERNAL_SLUG_RX =
  /(sobre|about|servic|services|solucoe|solutions|produto|product|contato|contact|cliente|case|portfolio|equipe|team|quem-somos|nossa-historia)/i;

function normalizeUrl(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const withProto = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProto);
    u.hash = '';
    return u.toString();
  } catch {
    return '';
  }
}

async function fetchHtml(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return '';
    const ct = res.headers.get('content-type') ?? '';
    if (!/text\/html|application\/xhtml/i.test(ct)) return '';
    return await res.text();
  } catch {
    clearTimeout(timer);
    return '';
  }
}

function extractPage(url: string, html: string): ScrapePage {
  const $ = cheerio.load(html);
  $('script, style, noscript, nav, footer, header, .cookie, .cookies').remove();

  const title = ($('title').first().text() || $('h1').first().text() || '').trim();
  const metaDescription =
    $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    '';

  const h1 = $('h1')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
  const h2 = $('h2')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 30);

  const lists: string[] = [];
  $('ul li, ol li').each((_, el) => {
    const t = $(el).text().trim().replace(/\s+/g, ' ');
    if (t && t.length < 200) lists.push(t);
  });

  const ctas: string[] = [];
  $('button, a.btn, a[class*="cta"], a[class*="button"]').each((_, el) => {
    const t = $(el).text().trim().replace(/\s+/g, ' ');
    if (t && t.length < 60) ctas.push(t);
  });

  const mainEl = $('main, article, [role="main"]').first();
  const main = mainEl.length ? mainEl : $('body');
  const mainText = main
    .text()
    .replace(/\s+/g, ' ')
    .trim();

  return {
    url,
    title: title.slice(0, 200),
    metaDescription: metaDescription.trim().slice(0, 300),
    h1: h1.slice(0, 10),
    h2,
    lists: lists.slice(0, 40),
    ctas: ctas.slice(0, 15),
    mainText: mainText.slice(0, 8000),
  };
}

function discoverInternalLinks($: cheerio.CheerioAPI, base: URL, max: number): string[] {
  const found = new Set<string>();
  $('a[href]').each((_, el) => {
    if (found.size >= max) return;
    const href = $(el).attr('href') ?? '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    let abs: URL;
    try {
      abs = new URL(href, base);
    } catch {
      return;
    }
    if (abs.host !== base.host) return;
    abs.hash = '';
    abs.search = '';
    const path = abs.pathname.toLowerCase();
    if (path === '/' || path === base.pathname.toLowerCase()) return;
    if (!INTERNAL_SLUG_RX.test(path)) return;
    found.add(abs.toString());
  });
  return Array.from(found);
}

function extractContacts(html: string): ScrapeData['contacts'] {
  const emails = Array.from(
    new Set((html.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? []).map((e) => e.toLowerCase()))
  )
    .filter((e) => !/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(e))
    .slice(0, 10);
  const phones = Array.from(
    new Set((html.match(/\+?55\s?\(?\d{2}\)?\s?9?\d{4}-?\d{4}/g) ?? []).map((p) => p.trim()))
  ).slice(0, 10);
  const whatsapp = Array.from(
    new Set((html.match(/wa\.me\/[\d+]+/gi) ?? []).map((w) => w.toLowerCase()))
  ).slice(0, 5);
  return { emails, phones, whatsapp };
}

function extractSocials($: cheerio.CheerioAPI): ScrapeData['socials'] {
  const out: ScrapeData['socials'] = {};
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (!href) return;
    if (!out.instagram && /instagram\.com\//i.test(href)) out.instagram = href;
    if (!out.linkedin && /linkedin\.com\//i.test(href)) out.linkedin = href;
    if (!out.facebook && /facebook\.com\//i.test(href)) out.facebook = href;
    if (!out.youtube && /youtube\.com\/|youtu\.be\//i.test(href)) out.youtube = href;
  });
  return out;
}

async function withSemaphore<T>(items: string[], limit: number, fn: (s: string) => Promise<T>): Promise<T[]> {
  const results: T[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function scrapeSiteDeep(
  url: string,
  opts?: { maxPages?: number; maxCharsTotal?: number; perPageTimeoutMs?: number }
): Promise<ScrapeData> {
  const maxPages = opts?.maxPages ?? 5;
  const maxCharsTotal = opts?.maxCharsTotal ?? 15000;
  const perPageTimeoutMs = opts?.perPageTimeoutMs ?? 5000;

  const normalized = normalizeUrl(url);
  if (!normalized) {
    return { url: url ?? '', pages: [], contacts: { emails: [], phones: [], whatsapp: [] }, socials: {}, totalChars: 0 };
  }

  const homeHtml = await fetchHtml(normalized, 8000);
  if (!homeHtml) {
    return { url: normalized, pages: [], contacts: { emails: [], phones: [], whatsapp: [] }, socials: {}, totalChars: 0 };
  }

  const home = extractPage(normalized, homeHtml);
  const $home = cheerio.load(homeHtml);
  const internal = discoverInternalLinks($home, new URL(normalized), Math.max(0, maxPages - 1) * 3);

  const seen = new Set<string>([new URL(normalized).pathname.toLowerCase()]);
  const candidates: string[] = [];
  for (const link of internal) {
    const path = new URL(link).pathname.toLowerCase();
    if (seen.has(path)) continue;
    seen.add(path);
    candidates.push(link);
    if (candidates.length >= maxPages - 1) break;
  }

  const fetched = await withSemaphore(candidates, 3, async (link) => {
    const html = await fetchHtml(link, perPageTimeoutMs);
    if (!html) return null;
    return { html, page: extractPage(link, html) };
  });

  const pages: ScrapePage[] = [home];
  let totalChars = home.mainText.length;
  let aggregateHtml = homeHtml;

  for (const f of fetched) {
    if (!f) continue;
    if (totalChars >= maxCharsTotal) break;
    const remaining = maxCharsTotal - totalChars;
    const truncated: ScrapePage = { ...f.page, mainText: f.page.mainText.slice(0, Math.max(800, remaining)) };
    pages.push(truncated);
    totalChars += truncated.mainText.length;
    aggregateHtml += '\n' + f.html;
  }

  const contacts = extractContacts(aggregateHtml);
  const socials = extractSocials(cheerio.load(aggregateHtml));

  return { url: normalized, pages, contacts, socials, totalChars };
}

export function flattenScrape(data: ScrapeData, maxChars = 15000): string {
  return data.pages.map((p) => p.mainText).join('\n\n').slice(0, maxChars);
}

export async function scrapeSite(url: string, maxChars = 3000): Promise<string> {
  if (!url) return '';
  const data = await scrapeSiteDeep(url, { maxPages: 1, maxCharsTotal: maxChars });
  return flattenScrape(data, maxChars);
}
