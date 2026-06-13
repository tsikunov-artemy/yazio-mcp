// FatSecret consumer-web client (no auth, no developer account, no Premier).
//
// Uses the public consumer endpoints that power fatsecret.ru search:
//   - auto.fatsecret.com  → JSONP autocomplete (Russian market m=26&l=13)
//   - www.fatsecret.ru    → HTML search results with per-serving nutrition
//
// These hosts are NOT behind Cloudflare (only www.fatsecret.com is). A browser
// User-Agent + Accept-Language: ru is required. HTML scraping is inherently
// fragile — if FatSecret changes markup, the regexes below need updating.

import { request as httpsRequest } from 'node:https';

const RU_MARKET = 'm=26&l=13'; // Russian market + language; US would be m=1&l=1
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Accept-Language': 'ru-RU,ru;q=0.9',
};

export interface FatSecretFood {
  name: string;
  brand: string | null;
  serving: string | null; // e.g. "1 порция (340г)"
  calories_kcal: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  protein_g: number | null;
  url: string; // absolute fatsecret.ru product URL
}

const num = (s: string | undefined): number | null => {
  if (!s) return null;
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// www.fatsecret.ru serves an EXPIRED cert (CN=fatsecret.com, expired 2022) that
// browsers and `curl -k` still load. node:https rejects it by default. Since this
// is an unauthenticated public food search (no credentials sent), we skip TLS
// verification for this one host only — Yazio's authenticated calls keep strict TLS.
function insecureGet(
  url: string,
  headers: Record<string, string>,
  redirects = 0
): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = httpsRequest(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'GET',
        headers,
        rejectUnauthorized: false,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location && redirects < 4) {
          res.resume();
          const loc = res.headers.location.startsWith('http')
            ? res.headers.location
            : `https://${u.hostname}${res.headers.location}`;
          resolve(insecureGet(loc, headers, redirects + 1));
          return;
        }
        if (status >= 400 || status === 0) {
          res.resume();
          reject(new Error(`FatSecret search failed: ${status}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      }
    );
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('FatSecret search timeout')));
    req.end();
  });
}

const stripTags = (s: string): string =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Autocomplete suggestions for the Russian market. Returns plain strings. */
export async function fatsecretAutocomplete(query: string): Promise<string[]> {
  const url = `https://auto.fatsecret.com/?${RU_MARKET}&query=${encodeURIComponent(
    query
  )}&fn=autoComplete`;
  const resp = await fetch(url, { headers: BROWSER_HEADERS });
  if (!resp.ok) throw new Error(`FatSecret autocomplete failed: ${resp.status}`);
  const body = await resp.text();
  // JSONP: autoComplete({...});
  const m = body.match(/autoComplete\((.*)\);?\s*$/s);
  if (!m) return [];
  try {
    const data = JSON.parse(m[1]) as { suggestions?: string[] };
    return data.suggestions ?? [];
  } catch {
    return [];
  }
}

/** Full food search against the Russian consumer site. Scrapes HTML. */
export async function fatsecretSearchFoods(
  query: string,
  page = 0
): Promise<FatSecretFood[]> {
  const url = `https://www.fatsecret.ru/калории-питание/search?q=${encodeURIComponent(
    query
  )}${page ? `&pg=${page}` : ''}`;
  const html = await insecureGet(url, BROWSER_HEADERS);

  const results: FatSecretFood[] = [];
  // Each result starts with <a class="prominent" href="...">Name</a>, optionally
  // followed by <a class="brand">(Brand)</a> and a <div class="smallText..."> with
  // serving + "Калории: ...ккал | Жир: ...г | Углев: ...г | Белк: ...г".
  const blockRe =
    /<a[^>]*class="prominent"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>([\s\S]*?)(?=<a[^>]*class="prominent"|$)/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null) {
    const href = m[1];
    const name = stripTags(m[2]);
    const rest = m[3];
    if (!name) continue;

    const brandM = rest.match(/<a[^>]*class="brand"[^>]*>(.*?)<\/a>/s);
    const brand = brandM ? stripTags(brandM[1]).replace(/^\(|\)$/g, '').trim() : null;

    const factM = rest.match(
      /<div[^>]*class="smallText[^"]*"[^>]*>([\s\S]*?(?:Калории|ккал)[\s\S]*?)<\/div>/
    );
    const factText = factM ? stripTags(factM[1]) : '';

    const servingM = factText.match(/(?:в\s+)?(.*?)\s*-\s*Калории/);
    results.push({
      name,
      brand,
      serving: servingM ? servingM[1].trim() : null,
      calories_kcal: num(factText.match(/Калории:\s*([\d.,]+)/)?.[1]),
      fat_g: num(factText.match(/Жир:\s*([\d.,]+)/)?.[1]),
      carbs_g: num(factText.match(/Углев:\s*([\d.,]+)/)?.[1]),
      protein_g: num(factText.match(/Белк:\s*([\d.,]+)/)?.[1]),
      url: href.startsWith('http') ? href : `https://www.fatsecret.ru${href}`,
    });
  }
  return results;
}
