-- Migration: guardrails + 3 CTAs configuráveis do agente

ALTER TABLE "prospector_tenants"
  ADD COLUMN "agent_guardrails" TEXT,
  ADD COLUMN "agent_cta_1" TEXT,
  ADD COLUMN "agent_cta_2" TEXT,
  ADD COLUMN "agent_cta_3" TEXT;
