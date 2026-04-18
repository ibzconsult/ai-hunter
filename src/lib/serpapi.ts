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

export async function searchProspects(
  apiKey: string,
  query: string,
  location?: string
): Promise<Prospect[]> {
  if (!apiKey) throw new Error('SerpAPI key ausente');

  const params = new URLSearchParams({
    engine: 'google_maps',
    q: query,
    api_key: apiKey,
    hl: 'pt-br',
    gl: 'br',
  });
  if (location) params.set('location', location);

  const res = await fetch(`https://www.searchapi.io/api/v1/search?${params.toString()}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`SearchAPI ${res.status}: ${await res.text()}`);

  const json = (await res.json()) as { local_results?: SerpLocal[] };
  const locals = json.local_results ?? [];

  const prospects: Prospect[] = [];
  const seen = new Set<string>();
  for (const l of locals) {
    const phone = normalizePhone(l.phone);
    if (!phone || !l.title) continue;
    if (seen.has(phone)) continue;
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
  return prospects;
}
