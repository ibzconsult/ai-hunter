import { normalizePhone } from './phone';

type SerpLocal = {
  title?: string;
  phone?: string;
  rating?: number;
  reviews?: number;
  type?: string;
  types?: string[];
  website?: string;
  gps_coordinates?: { latitude: number; longitude: number };
};

export type Prospect = {
  nomeEmpresa: string;
  telefone: string;
  rating?: number;
  reviews?: number;
  especialidades?: string;
  site?: string;
};

const PAGE_SIZE = 20;
const DEFAULT_MAX_PAGES = 5; // 20 × 5 = até 100 resultados

export async function expandSegmentQueries(
  apiKey: string,
  segmento: string,
  location?: string
): Promise<string[]> {
  if (!apiKey || !segmento.trim()) return [segmento];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Gere variações do termo de busca pra encontrar empresas no Google Maps brasileiro. Retorne JSON {"queries": [3-5 termos]} — inclua o termo original + sinônimos reais usados no mercado. Sem frases longas, sem adjetivos, só o tipo de negócio. Exemplo: "transportadora" → {"queries":["transportadora","empresa de transporte","frete","logística","transporte de cargas"]}.`,
          },
          {
            role: 'user',
            content: `Termo: ${segmento}${location ? ` (busca em ${location})` : ''}`,
          },
        ],
        temperature: 0.3,
      }),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return [segmento];
    const json = await res.json();
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? '{}');
    const arr: string[] = Array.isArray(parsed.queries) ? parsed.queries : [];
    const deduped = Array.from(new Set([segmento, ...arr.map((s) => String(s).trim()).filter(Boolean)]));
    return deduped.slice(0, 5);
  } catch {
    return [segmento];
  } finally {
    clearTimeout(timer);
  }
}

export async function searchProspects(
  apiKey: string,
  query: string,
  location?: string,
  opts?: { maxPages?: number }
): Promise<Prospect[]> {
  if (!apiKey) throw new Error('SerpAPI key ausente');

  const maxPages = Math.max(1, Math.min(10, opts?.maxPages ?? DEFAULT_MAX_PAGES));

  // SearchAPI google_maps responde melhor quando a localidade vem embutida na
  // query. Passar só `location` frequentemente cai em São Paulo por default.
  const trimmedLoc = location?.trim() ?? '';
  const effectiveQ = trimmedLoc ? `${query} em ${trimmedLoc}` : query;

  const prospects: Prospect[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      engine: 'google_maps',
      q: effectiveQ,
      api_key: apiKey,
      hl: 'pt-br',
      gl: 'br',
    });
    if (trimmedLoc) params.set('location', trimmedLoc);
    if (page > 0) params.set('start', String(page * PAGE_SIZE));

    const res = await fetch(`https://www.searchapi.io/api/v1/search?${params.toString()}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      if (page === 0) throw new Error(`SearchAPI ${res.status}: ${await res.text()}`);
      break; // páginas subsequentes falhando — retorna o que já temos
    }

    const json = (await res.json()) as { local_results?: SerpLocal[] };
    const locals = json.local_results ?? [];
    if (locals.length === 0) break;

    let seenAllKeys = 0;
    const prevCount = prospects.length;
    for (const l of locals) {
      const phone = normalizePhone(l.phone);
      if (!phone || !l.title) continue;
      if (seen.has(phone)) {
        seenAllKeys++;
        continue;
      }
      seen.add(phone);
      prospects.push({
        nomeEmpresa: l.title,
        telefone: phone,
        rating: l.rating,
        reviews: l.reviews,
        especialidades: l.type ?? l.types?.join(', '),
        site: l.website,
      });
    }

    // Só interrompe quando a página veio 100% duplicada (sinal de que o
    // Google Maps começou a repetir os mesmos resultados).
    if (prospects.length === prevCount && seenAllKeys > 0) break;
  }

  return prospects;
}
