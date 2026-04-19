# Deploy na VPS Hetzner

## Pré-requisitos
- VPS com Docker + Traefik rodando (network `traefik-public` com certresolver `letsencrypt`)
- Subdomínio apontado pra IP da VPS (ex: `ai-hunter.ibusiness.ia.br` via CNAME/A)

## Primeiro deploy

```bash
# SSH na VPS
ssh -i ~/.ssh/ed25519_hetzner root@167.235.19.228

# Clone ou copia o repo
cd /opt
git clone https://github.com/ibzconsult/ai-hunter.git
cd ai-hunter

# Cria .env.production com TODAS as variáveis:
#   DATABASE_URL, DIRECT_URL, JWT_SECRET, UAZAPI_URL, UAZAPI_ADMIN_TOKEN,
#   FOLLOWUP_CRON_TOKEN
cp .env.example .env.production   # se existir; senão, cria do zero
nano .env.production

# Build + up
docker compose up -d --build

# Confere logs
docker compose logs -f ai-hunter
```

## Atualização (deploy subsequente)

```bash
cd /opt/ai-hunter
git pull
docker compose up -d --build
docker compose logs -f ai-hunter
```

Traefik renova SSL automaticamente. Container reinicia sozinho se crashar.

## DNS

Aponta `ai-hunter.ibusiness.ia.br` (ou subdomínio escolhido) pro IP da VPS via:
- CNAME → outro domínio da VPS, OU
- A record → `167.235.19.228`

Se o network Traefik tiver outro nome, edita `docker-compose.yml` trocando `traefik-public` pelo nome correto. Pra descobrir:

```bash
docker network ls | grep traefik
```

## n8n cron

Após subir, atualize o workflow do n8n pra apontar pra nova URL:
`https://ai-hunter.ibusiness.ia.br/api/cron/followups` com o mesmo Bearer token
(`FOLLOWUP_CRON_TOKEN`).

## Webhook Uazapi

Reaponte o webhook da instância pro endpoint novo:
`https://ai-hunter.ibusiness.ia.br/api/webhooks/uazapi`
