import { prisma } from '@/lib/db';
import type { Lead, Contact, Company } from '@prisma/client';

export async function upsertCompanyByName(
  tenantId: string,
  nome: string,
  extra?: { site?: string | null; segmento?: string | null; notes?: string | null }
): Promise<Company> {
  const clean = nome.trim().slice(0, 255);
  if (!clean) throw new Error('Company nome vazio');
  return prisma.company.upsert({
    where: { tenantId_nome: { tenantId, nome: clean } },
    update: {
      site: extra?.site ?? undefined,
      segmento: extra?.segmento ?? undefined,
      notes: extra?.notes ?? undefined,
    },
    create: {
      tenantId,
      nome: clean,
      site: extra?.site ?? null,
      segmento: extra?.segmento ?? null,
      notes: extra?.notes ?? null,
    },
  });
}

export async function upsertContactByPhone(
  tenantId: string,
  phone: string,
  extra?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    role?: string | null;
    companyId?: string | null;
  }
): Promise<Contact> {
  const clean = phone.trim();
  if (!clean) throw new Error('Contact phone vazio');
  return prisma.contact.upsert({
    where: { tenantId_phone: { tenantId, phone: clean } },
    update: {
      firstName: extra?.firstName ?? undefined,
      lastName: extra?.lastName ?? undefined,
      email: extra?.email ?? undefined,
      role: extra?.role ?? undefined,
      companyId: extra?.companyId ?? undefined,
    },
    create: {
      tenantId,
      phone: clean,
      firstName: extra?.firstName ?? null,
      lastName: extra?.lastName ?? null,
      email: extra?.email ?? null,
      role: extra?.role ?? null,
      companyId: extra?.companyId ?? null,
    },
  });
}

type OppPartyInput = Lead & {
  contact?: Contact | null;
  company?: Company | null;
};

export type ResolvedParties = {
  contact: { firstName: string | null; phone: string | null; email: string | null } | null;
  company: { nome: string | null; site: string | null; segmento: string | null } | null;
};

/**
 * Retorna os dados de contato/empresa associados ao Lead,
 * preferindo as relações; se null, cai no denormalizado (empresa/firstName/telefone).
 */
export function resolveOpportunityParties(opp: OppPartyInput): ResolvedParties {
  const contact = opp.contact
    ? {
        firstName: opp.contact.firstName ?? null,
        phone: opp.contact.phone ?? null,
        email: opp.contact.email ?? null,
      }
    : opp.firstName || opp.telefone
      ? { firstName: opp.firstName, phone: opp.telefone, email: null }
      : null;

  const company = opp.company
    ? {
        nome: opp.company.nome ?? null,
        site: opp.company.site ?? null,
        segmento: opp.company.segmento ?? null,
      }
    : opp.empresa || opp.site || opp.especialidades
      ? { nome: opp.empresa, site: opp.site, segmento: opp.especialidades }
      : null;

  return { contact, company };
}

export function companyDisplayName(opp: OppPartyInput): string | null {
  return opp.company?.nome ?? opp.empresa ?? null;
}

export function contactDisplayName(opp: OppPartyInput): string | null {
  const c = opp.contact;
  if (c) {
    const parts = [c.firstName, c.lastName].filter(Boolean) as string[];
    return parts.length ? parts.join(' ') : null;
  }
  return opp.firstName ?? null;
}

export function contactPhone(opp: OppPartyInput): string | null {
  return opp.contact?.phone ?? opp.telefone ?? null;
}
