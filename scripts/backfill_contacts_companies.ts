/**
 * Backfill: cria Company e Contact a partir dos dados denormalizados em Lead
 * e grava os FKs lead.companyId / lead.contactId.
 *
 * Idempotente: pode rodar múltiplas vezes. Pula leads que já têm FKs.
 *
 * Uso: `npx tsx scripts/backfill_contacts_companies.ts`
 *   (ou: `node --loader ts-node/esm scripts/backfill_contacts_companies.ts`)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function normalizeCompanyName(nome: string): string {
  return nome.trim().replace(/\s+/g, ' ').toLowerCase().slice(0, 255);
}

async function main() {
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Processando ${leads.length} leads...`);

  const companyCache = new Map<string, string>(); // tenantId::nomeNorm -> companyId
  let createdCompanies = 0;
  let createdContacts = 0;
  let updatedLeads = 0;

  for (const lead of leads) {
    let companyId = lead.companyId;
    let contactId = lead.contactId;

    // Company por empresa normalizada
    if (!companyId && lead.empresa && lead.empresa.trim()) {
      const nome = lead.empresa.trim();
      const key = `${lead.tenantId}::${normalizeCompanyName(nome)}`;
      companyId = companyCache.get(key) ?? null;

      if (!companyId) {
        const existing = await prisma.company.findUnique({
          where: { tenantId_nome: { tenantId: lead.tenantId, nome } },
        });
        if (existing) {
          companyId = existing.id;
        } else {
          const created = await prisma.company.create({
            data: {
              tenantId: lead.tenantId,
              nome,
              site: lead.site,
              segmento: lead.especialidades,
              siteScrape: lead.siteScrape,
              siteAnalysis: lead.siteAnalysis ?? undefined,
            },
          });
          companyId = created.id;
          createdCompanies++;
        }
        companyCache.set(key, companyId);
      }
    }

    // Contact por phone (unique tenantId+phone)
    if (!contactId && (lead.telefone || lead.firstName)) {
      if (lead.telefone) {
        const existing = await prisma.contact.findUnique({
          where: { tenantId_phone: { tenantId: lead.tenantId, phone: lead.telefone } },
        });
        if (existing) {
          contactId = existing.id;
          // Se contato não tinha companyId e agora sabemos, atualizar
          if (!existing.companyId && companyId) {
            await prisma.contact.update({
              where: { id: existing.id },
              data: { companyId },
            });
          }
        } else {
          const created = await prisma.contact.create({
            data: {
              tenantId: lead.tenantId,
              firstName: lead.firstName,
              phone: lead.telefone,
              companyId,
            },
          });
          contactId = created.id;
          createdContacts++;
        }
      } else if (lead.firstName) {
        // Sem phone — cria contact sem unique check
        const created = await prisma.contact.create({
          data: {
            tenantId: lead.tenantId,
            firstName: lead.firstName,
            companyId,
          },
        });
        contactId = created.id;
        createdContacts++;
      }
    }

    if (
      (companyId && companyId !== lead.companyId) ||
      (contactId && contactId !== lead.contactId)
    ) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { companyId, contactId },
      });
      updatedLeads++;
    }
  }

  console.log(`Concluído.`);
  console.log(`  Empresas criadas: ${createdCompanies}`);
  console.log(`  Contatos criados: ${createdContacts}`);
  console.log(`  Leads atualizados: ${updatedLeads}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
