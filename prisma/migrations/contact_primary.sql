-- Migration: is_primary em contacts + índice parcial + backfill opcional

ALTER TABLE "prospector_contacts" ADD COLUMN "is_primary" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "prospector_contacts_company_id_is_primary_idx" ON "prospector_contacts"("company_id", "is_primary");

-- Backfill: marcar o 1º contato de cada empresa como principal
UPDATE "prospector_contacts" c
SET "is_primary" = true
WHERE c.id IN (
  SELECT DISTINCT ON ("company_id") id
  FROM "prospector_contacts"
  WHERE "company_id" IS NOT NULL
  ORDER BY "company_id", "created_at" ASC
);
