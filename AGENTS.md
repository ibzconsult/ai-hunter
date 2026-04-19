<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AI Hunter — operational notes

## Stack
- Next 16 app router, Prisma **pinado em `~6.19.3`** (não saltar v7), Tailwind v4, Cheerio 1.x.
- Supabase isolado deste projeto (ref `xpgumjcissquyoqjpwim`). Sem `prisma/migrations/` — usa `prisma db push` (seguro porque o DB é dedicado, mas SEMPRE rodar SEM `--accept-data-loss`).
- Deploy Netlify auto da `main` (build no Linux). Nunca rodar `netlify deploy --build` local no Windows (EPERM symlink no `@prisma/client`).

## Modelos OpenAI (lock)
- `generateMessages` (cold outreach final) → **`gpt-4.1`** (full).
- `analyzeSite` + `classifyReply` → **`gpt-4.1-mini`** (econômico).
- Agente conversacional (`runAgentTurn`) → `gpt-4.1` com tool calling.

## Pipeline de personalização (`/api/dispatch`)
1. `scrapeSiteDeep(site)` — Cheerio, até 5 páginas, ~15k chars, descobre links sobre/serviços/contato/etc.
2. `analyzeSite(scrape)` → JSON estruturado (tipoNegocio, segmento, ofertas, dores, ganchoEspecifico, tom).
3. Persiste em `Lead.siteAnalysis` (JSONB) + `Lead.siteScrape` (texto agregado, fallback). Cache: pula scrape+analyze se `siteAnalysis` já existe.
4. `generateMessages` injeta análise estruturada + 2 few-shots do segmento (`src/lib/fewShots.ts`).
5. Invalidar `siteScrape` E `siteAnalysis` ao trocar `site` (já feito em `/api/leads/[id]` PATCH).

## Agente conversacional
- Ativado por tenant em `Tenant.agentEnabled`. Notificação ao dono via `Tenant.notificationPhone` usando a própria instância UazAPI do tenant.
- Webhook (`/api/webhooks/uazapi`) registra Message in, classifica, e se enabled+human chama `runAgentTurn`.
- Tools expostas: `replyText`, `sendDocument` (KB sendable+fileUrl), `notifyOwner` (marca `lead.interested=true`), `markStage` (`replied|won|lost`).
- Loop max 6 turns, anti-loop em mesma tool 3x ou 0 replyText em 3 turns.
- Pipeline default não tem `qualified` — usar `won/lost` ou flag `interested`.

## Schema relevante
- `Lead.siteAnalysis` (Json), `Lead.interested` (Boolean), `Lead.messages` (1:N).
- `Message`: `direction in|out`, `body`, `mediaUrl`, `mediaType`, `toolCalled` ('dispatch'|'replyText'|'sendDocument'|'notifyOwner').
- `KnowledgeDoc`: `conteudoTexto` vai pro contexto do agente; só `sendable=true && fileUrl` pode ser enviado.
- `Tenant`: `agentEnabled`, `agentPersona`, `notificationPhone`.

## UazAPI client
- `sendText(token, phone, msg)` — `/send/text` body `{number, text}`.
- `sendMedia(token, phone, fileUrl, {caption, type, fileName})` — `/send/media` body `{number, type, file, text?, docName?}`.
- Webhook payload: ignorar `fromMe`, grupos (`@g.us`), broadcast (`@broadcast`).

## Build local Windows
- `prisma generate` pode falhar com EPERM se o dev server estiver rodando (segura `query_engine-windows.dll.node`). Parar node antes (`Stop-Process -Name node -Force`).
- `npm install --ignore-scripts` evita postinstall (que roda `prisma generate`) — útil quando node tá segurando o engine.
