# Prospector IA

SaaS multi-tenant de prospecção B2B com IA. Next.js 16 + Prisma + Postgres + Uazapi + OpenAI.

## Setup local

1. **Preencher `.env`** com seu `DATABASE_URL` (Postgres)
2. **Criar tabelas:**
   ```bash
   npx prisma db push
   ```
3. **Rodar:**
   ```bash
   npm run dev
   ```
4. Acessar http://localhost:3000

## Stack

- Next.js 16 (App Router, TypeScript)
- Prisma 6 (ORM, queries parametrizadas automáticas)
- bcryptjs (hash senha)
- jose (JWT em cookie httpOnly)
- Tailwind 4

## Rotas API

- `POST /api/auth/login` | `/register` | `/logout`
- `GET /api/auth/me`
- `PUT /api/profile`
- `GET | POST /api/instances`
- `POST | DELETE /api/instances/:id` (action=connect|status)
- `POST /api/dispatch` (envia lead via WhatsApp)

## Diferenças vs versão n8n

| n8n | Next.js |
|---|---|
| Code node com HTML inline | Componentes React `.tsx` |
| Webhook + Route Action | API routes tipadas |
| `queryReplacement` frágil | Prisma parametriza automático |
| safeStorage polyfill | Cookie httpOnly |
| crypt+pgcrypto | bcryptjs |

## Deploy

Netlify ou Vercel grátis. Defina as env vars no painel.
