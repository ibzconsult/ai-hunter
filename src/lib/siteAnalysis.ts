import type { ScrapeData } from './scraper';

export type SiteAnalysis = {
  tipoNegocio: string;
  segmento: string;
  ofertas: string[];
  doresAparentes: string[];
  provaSocial: string[];
  tomMarca: 'formal' | 'consultivo' | 'descontraido' | 'tecnico' | 'institucional';
  ganchoEspecifico: string;
  pessoasMencionadas: { nome: string; cargo?: string }[];
  publicoAlvo: string;
  confianca: number;
};

const SYSTEM = `Você analisa o site institucional de uma empresa e devolve um JSON estruturado para um SDR usar como base de personalização.

Regras:
- Seja conciso e factual. NUNCA invente. Se faltar dado, devolva string vazia ou array vazio.
- "ganchoEspecifico" = UMA frase única e factual desse site (não pode ser genérica). Ex bom: "atendem 12 cidades do interior do CE com pronto-socorro 24h". Ex ruim: "oferecem soluções de qualidade".
- "segmento" canonicalizado em UMA palavra-chave de: odonto, juridico, tech, varejo, saude, educacao, b2b_servicos, ecommerce, imobiliario, financeiro, industria, construcao, alimentacao, beleza, automotivo, generico.
- "tomMarca" só pode ser: formal, consultivo, descontraido, tecnico, institucional.
- "pessoasMencionadas" só inclui nomes próprios reais que aparecem explícitos no site (founder, CEO, equipe). Nunca invente.
- "doresAparentes" são dores prováveis do CLIENTE FINAL desse negócio (ex: para clínica odontológica, "paciente esfria entre avaliação e fechamento"), não dores da empresa.
- "confianca" 0-1 reflete quão rico foi o material analisado.

Retorne SOMENTE JSON válido com exatamente esses campos: tipoNegocio (string), segmento (string), ofertas (string[]), doresAparentes (string[]), provaSocial (string[]), tomMarca (string), ganchoEspecifico (string), pessoasMencionadas (objeto[] {nome, cargo?}), publicoAlvo (string), confianca (number).`;

function compactInput(scrape: ScrapeData, hint?: { especialidades?: string; empresa?: string }) {
  const home = scrape.pages[0];
  const allH2 = scrape.pages.flatMap((p) => p.h2).slice(0, 30);
  const allLists = scrape.pages.flatMap((p) => p.lists).slice(0, 30);
  const allCtas = scrape.pages.flatMap((p) => p.ctas).slice(0, 15);
  const mainText = scrape.pages.map((p) => p.mainText).join('\n\n').slice(0, 12000);

  const lines = [
    `URL: ${scrape.url}`,
    hint?.empresa ? `EMPRESA_HINT: ${hint.empresa}` : null,
    hint?.especialidades ? `SEGMENTO_HINT: ${hint.especialidades}` : null,
    home ? `HOME_TITLE: ${home.title}` : null,
    home?.metaDescription ? `META: ${home.metaDescription}` : null,
    home?.h1.length ? `H1: ${home.h1.join(' | ')}` : null,
    allH2.length ? `H2 (todas pgs): ${allH2.join(' | ')}` : null,
    allCtas.length ? `CTAS: ${allCtas.join(' | ')}` : null,
    allLists.length ? `LISTAS (top): ${allLists.slice(0, 25).join(' | ')}` : null,
    scrape.contacts.emails.length ? `EMAILS: ${scrape.contacts.emails.join(', ')}` : null,
    scrape.contacts.phones.length ? `TELEFONES: ${scrape.contacts.phones.join(', ')}` : null,
    Object.keys(scrape.socials).length ? `SOCIAIS: ${JSON.stringify(scrape.socials)}` : null,
    `PAGINAS_RASPADAS: ${scrape.pages.length}`,
    `TEXTO PRINCIPAL:\n"""${mainText}"""`,
  ].filter(Boolean);
  return lines.join('\n');
}

const SEGMENTOS_VALIDOS = new Set([
  'odonto', 'juridico', 'tech', 'varejo', 'saude', 'educacao',
  'b2b_servicos', 'ecommerce', 'imobiliario', 'financeiro',
  'industria', 'construcao', 'alimentacao', 'beleza',
  'automotivo', 'generico',
]);

const TOMS_VALIDOS = new Set(['formal', 'consultivo', 'descontraido', 'tecnico', 'institucional']);

function sanitize(parsed: unknown): SiteAnalysis | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as Record<string, unknown>;
  const arr = (k: string) => (Array.isArray(o[k]) ? (o[k] as unknown[]).map(String).filter(Boolean).slice(0, 12) : []);
  const str = (k: string) => (typeof o[k] === 'string' ? (o[k] as string).trim() : '');

  const segRaw = str('segmento').toLowerCase();
  const segmento = SEGMENTOS_VALIDOS.has(segRaw) ? segRaw : 'generico';
  const tomRaw = str('tomMarca').toLowerCase();
  const tomMarca = (TOMS_VALIDOS.has(tomRaw) ? tomRaw : 'consultivo') as SiteAnalysis['tomMarca'];

  const pessoasRaw = Array.isArray(o.pessoasMencionadas) ? (o.pessoasMencionadas as unknown[]) : [];
  const pessoasMencionadas = pessoasRaw
    .map((p) => {
      if (!p || typeof p !== 'object') return null;
      const r = p as Record<string, unknown>;
      const nome = typeof r.nome === 'string' ? r.nome.trim() : '';
      if (!nome) return null;
      const cargo = typeof r.cargo === 'string' ? r.cargo.trim() : undefined;
      return cargo ? { nome, cargo } : { nome };
    })
    .filter(Boolean)
    .slice(0, 8) as { nome: string; cargo?: string }[];

  const conf = typeof o.confianca === 'number' ? Math.max(0, Math.min(1, o.confianca)) : 0;

  return {
    tipoNegocio: str('tipoNegocio'),
    segmento,
    ofertas: arr('ofertas'),
    doresAparentes: arr('doresAparentes'),
    provaSocial: arr('provaSocial'),
    tomMarca,
    ganchoEspecifico: str('ganchoEspecifico'),
    pessoasMencionadas,
    publicoAlvo: str('publicoAlvo'),
    confianca: conf,
  };
}

export async function analyzeSite(
  apiKey: string,
  scrape: ScrapeData,
  hint?: { especialidades?: string; empresa?: string }
): Promise<SiteAnalysis | null> {
  if (!apiKey) return null;
  if (!scrape.pages.length) return null;

  const body = {
    model: 'gpt-4.1-mini',
    response_format: { type: 'json_object' as const },
    messages: [
      { role: 'system' as const, content: SYSTEM },
      { role: 'user' as const, content: compactInput(scrape, hint) },
    ],
    temperature: 0.2,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? '{}';
    return sanitize(JSON.parse(content));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
