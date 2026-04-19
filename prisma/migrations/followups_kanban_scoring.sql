-- Migration: followups + kanban rico + scoring
-- Revisado via `prisma migrate diff` — apenas ADDs, nenhum DROP

-- AlterTable
ALTER TABLE "prospector_leads" ADD COLUMN     "followup_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "followup_manually_paused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "followup_paused_until" TIMESTAMP(3),
ADD COLUMN     "interest_band" VARCHAR(20) NOT NULL DEFAULT 'cold',
ADD COLUMN     "interest_score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "interest_signals" JSONB,
ADD COLUMN     "interest_updated_at" TIMESTAMP(3),
ADD COLUMN     "is_draft" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_followup_at" TIMESTAMP(3),
ADD COLUMN     "last_interaction_at" TIMESTAMP(3),
ADD COLUMN     "next_followup_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "prospector_tenants" ADD COLUMN     "inbound_greeting" TEXT;

-- CreateTable
CREATE TABLE "prospector_followup_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "max_count" INTEGER NOT NULL DEFAULT 4,
    "window_start" VARCHAR(5) NOT NULL DEFAULT '09:00',
    "window_end" VARCHAR(5) NOT NULL DEFAULT '18:00',
    "active_days" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
    "pause_on_reply_hours" INTEGER NOT NULL DEFAULT 48,
    "instance_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "prospector_followup_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospector_followup_steps" (
    "id" UUID NOT NULL,
    "config_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "delay_days" INTEGER NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "custom_hint" TEXT,
    "doc_id" UUID,
    CONSTRAINT "prospector_followup_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospector_tags" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(60) NOT NULL,
    "color" VARCHAR(9) NOT NULL DEFAULT '#64748b',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prospector_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospector_lead_tags" (
    "lead_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prospector_lead_tags_pkey" PRIMARY KEY ("lead_id","tag_id")
);

-- Indexes
CREATE UNIQUE INDEX "prospector_followup_configs_tenant_id_key" ON "prospector_followup_configs"("tenant_id");
CREATE UNIQUE INDEX "prospector_followup_steps_config_id_order_key" ON "prospector_followup_steps"("config_id", "order");
CREATE INDEX "prospector_tags_tenant_id_idx" ON "prospector_tags"("tenant_id");
CREATE UNIQUE INDEX "prospector_tags_tenant_id_nome_key" ON "prospector_tags"("tenant_id", "nome");
CREATE INDEX "prospector_lead_tags_tag_id_idx" ON "prospector_lead_tags"("tag_id");
CREATE INDEX "prospector_leads_tenant_id_next_followup_at_idx" ON "prospector_leads"("tenant_id", "next_followup_at");
CREATE INDEX "prospector_leads_tenant_id_is_draft_idx" ON "prospector_leads"("tenant_id", "is_draft");
CREATE INDEX "prospector_leads_tenant_id_interest_score_idx" ON "prospector_leads"("tenant_id", "interest_score" DESC);

-- FKs
ALTER TABLE "prospector_followup_configs" ADD CONSTRAINT "prospector_followup_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "prospector_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prospector_followup_steps" ADD CONSTRAINT "prospector_followup_steps_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "prospector_followup_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prospector_tags" ADD CONSTRAINT "prospector_tags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "prospector_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prospector_lead_tags" ADD CONSTRAINT "prospector_lead_tags_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "prospector_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prospector_lead_tags" ADD CONSTRAINT "prospector_lead_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "prospector_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed stage triagem em pipelines que ainda não têm
INSERT INTO "prospector_stages" (id, pipeline_id, nome, ordem, tipo, created_at)
SELECT gen_random_uuid(), p.id, 'Triagem', -1, 'triage', NOW()
FROM "prospector_pipelines" p
WHERE NOT EXISTS (
  SELECT 1 FROM "prospector_stages" s
  WHERE s.pipeline_id = p.id AND s.tipo = 'triage'
);
