-- AlterTable
ALTER TABLE "prospector_leads" ADD COLUMN     "company_id" UUID,
ADD COLUMN     "contact_id" UUID;

-- CreateTable
CREATE TABLE "prospector_companies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "site" VARCHAR(500),
    "segmento" VARCHAR(120),
    "site_scrape" TEXT,
    "site_analysis" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospector_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospector_contacts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "role" VARCHAR(120),
    "company_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospector_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prospector_companies_tenant_id_idx" ON "prospector_companies"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "prospector_companies_tenant_id_nome_key" ON "prospector_companies"("tenant_id", "nome");

-- CreateIndex
CREATE INDEX "prospector_contacts_tenant_id_idx" ON "prospector_contacts"("tenant_id");

-- CreateIndex
CREATE INDEX "prospector_contacts_company_id_idx" ON "prospector_contacts"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "prospector_contacts_tenant_id_phone_key" ON "prospector_contacts"("tenant_id", "phone");

-- CreateIndex
CREATE INDEX "prospector_leads_contact_id_idx" ON "prospector_leads"("contact_id");

-- CreateIndex
CREATE INDEX "prospector_leads_company_id_idx" ON "prospector_leads"("company_id");

-- AddForeignKey
ALTER TABLE "prospector_leads" ADD CONSTRAINT "prospector_leads_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "prospector_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospector_leads" ADD CONSTRAINT "prospector_leads_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "prospector_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospector_companies" ADD CONSTRAINT "prospector_companies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "prospector_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospector_contacts" ADD CONSTRAINT "prospector_contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "prospector_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospector_contacts" ADD CONSTRAINT "prospector_contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "prospector_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

