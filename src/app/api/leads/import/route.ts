import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { firstStageId } from '@/lib/pipeline';
import { normalizePhone } from '@/lib/phone';

type Row = Record<string, string | undefined>;

function pick(row: Row, keys: string[]): string | null {
  for (const k of keys) {
    const hit = Object.keys(row).find((h) => h.trim().toLowerCase() === k.toLowerCase());
    if (hit) {
      const v = row[hit]?.toString().trim();
      if (v) return v;
    }
  }
  return null;
}

function firstNameFrom(full: string | null): string | null {
  if (!full) return null;
  const first = full.trim().split(/\s+/)[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : null;
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ success: false }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: 'Arquivo ausente' }, { status: 400 });
  }

  const text = await file.text();
  const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    return NextResponse.json(
      { success: false, error: `CSV inválido: ${parsed.errors[0].message}` },
      { status: 400 }
    );
  }

  const stageId = await firstStageId(s.tenantId);
  const imported: { telefone: string }[] = [];
  const skipped: { linha: number; motivo: string }[] = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const nomeRaw = pick(row, ['nome', 'first name', 'firstname', 'nome contato', 'contato']);
    const phoneRaw = pick(row, ['whatsapp', 'telefone', 'phone', 'celular', 'numero']);
    const site = pick(row, ['site', 'website', 'url']);
    const empresa = pick(row, ['empresa', 'nome empresa', 'company', 'razao social']);
    const contexto = pick(row, ['contexto', 'context', 'observacao', 'observação', 'notes']);

    const phone = normalizePhone(phoneRaw);
    if (!phone) {
      skipped.push({ linha: i + 2, motivo: 'WhatsApp inválido ou ausente' });
      continue;
    }

    const firstName = firstNameFrom(nomeRaw);

    await prisma.lead.upsert({
      where: {
        tenantId_telefone: { tenantId: s.tenantId, telefone: phone },
      },
      create: {
        tenantId: s.tenantId,
        telefone: phone,
        firstName,
        empresa: empresa ?? nomeRaw,
        site: site ?? null,
        contexto: contexto ?? null,
        origem: 'csv',
        stageId,
      },
      update: {
        firstName: firstName ?? undefined,
        empresa: empresa ?? nomeRaw ?? undefined,
        site: site ?? undefined,
        contexto: contexto ?? undefined,
      },
    });
    imported.push({ telefone: phone });
  }

  return NextResponse.json({
    success: true,
    imported: imported.length,
    skipped: skipped.length,
    skippedDetails: skipped.slice(0, 10),
  });
}
