# Deploy na VPS Hetzner (Docker Swarm + Traefik)

## Infra existente
- Host: `167.235.19.228`, user `root`, chave `~/.ssh/id_ed25519_hetzner`
- Docker em Swarm mode
- Traefik v2.11 como ingress, certresolver **`letsencryptresolver`**, network **`network_public`**

## 1. DNS

Aponte `ai-hunter.ibusiness.ia.br` (ou o domínio escolhido) pro IP da VPS (`167.235.19.228`) via registro **A**. Em seguida espera o SSL subir (~1min).

Se usar outro domínio, edite `stack.yml` trocando o valor da label `Host(...)`.

## 2. Primeiro deploy

```bash
# SSH na VPS
ssh -i ~/.ssh/id_ed25519_hetzner root@167.235.19.228

# Clone o repo
mkdir -p /opt && cd /opt
git clone https://github.com/ibzconsult/ai-hunter.git
cd ai-hunter

# Crie o .env.production com TODAS as env vars:
#   DATABASE_URL, DIRECT_URL, JWT_SECRET, UAZAPI_URL, UAZAPI_ADMIN_TOKEN,
#   FOLLOWUP_CRON_TOKEN
nano .env.production

# Build da imagem
docker build -t ai-hunter:latest .

# Deploy como stack
docker stack deploy -c stack.yml ai-hunter

# Acompanha logs do service
docker service logs -f ai-hunter_web
```

Em ~1 min, `https://ai-hunter.ibusiness.ia.br` deve responder.

## 3. Atualização (deploys futuros)

```bash
cd /opt/ai-hunter
git pull
docker build -t ai-hunter:latest .
docker service update --force --image ai-hunter:latest ai-hunter_web
docker service logs -f ai-hunter_web
```

`update_config: order: start-first` garante que o container novo sobe antes do antigo cair — deploy sem downtime.

## 4. Reapontamentos

- **n8n cron workflow**: troca URL do HTTP Request de `https://ai-hunter.netlify.app/api/cron/followups` pra `https://ai-hunter.ibusiness.ia.br/api/cron/followups`. Bearer token continua o mesmo.
- **UazAPI webhook**: reaponta o webhook da instância pra `https://ai-hunter.ibusiness.ia.br/api/webhooks/uazapi`.

## 5. Diagnóstico

```bash
# Service health
docker service ps ai-hunter_web

# Container stats (CPU/RAM)
docker stats $(docker ps --filter name=ai-hunter_web -q)

# Logs paginados
docker service logs --tail 200 ai-hunter_web
```

## 6. Rollback

```bash
docker service rollback ai-hunter_web
```

## 7. Teardown (caso precise desmontar)

```bash
docker stack rm ai-hunter
# Opcional: remove imagens
docker image rm ai-hunter:latest
```
