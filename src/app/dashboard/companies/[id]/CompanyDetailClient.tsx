'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Contact = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
};

type Opportunity = {
  id: string;
  stage: { nome: string } | null;
  firstName: string | null;
  contact: { id: string; firstName: string | null; lastName: string | null } | null;
  interested: boolean;
  interestBand: string;
  interestScore: number;
};

type Company = {
  id: string;
  nome: string;
  site: string | null;
  segmento: string | null;
  notes: string | null;
  contacts: Contact[];
  leads: Opportunity[];
};

export default function CompanyDetailClient({ id }: { id: string }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, [id]);

  async function load() {
    const res = await fetch(`/api/companies/${id}`);
    const data = await res.json();
    if (data.ok) setCompany(data.company);
  }

  async function save(patch: Partial<Company>) {
    setSaving(true);
    await fetch(`/api/companies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    await load();
  }

  if (!company) return <div className="p-8 text-sm text-[var(--muted)]">Carregando…</div>;

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-4">
      <Link href="/dashboard/companies" className="text-xs text-[var(--muted)] hover:underline">
        ← Empresas
      </Link>

      <div className="surface p-4 space-y-3">
        <h1 className="text-lg font-semibold">{company.nome}</h1>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome" value={company.nome} onChange={(v) => save({ nome: v })} />
          <Field label="Site" value={company.site ?? ''} onChange={(v) => save({ site: v })} />
          <Field label="Segmento" value={company.segmento ?? ''} onChange={(v) => save({ segmento: v })} />
          <Field label="Notas" value={company.notes ?? ''} onChange={(v) => save({ notes: v })} />
        </div>
        {saving && <p className="text-xs text-[var(--muted)]">Salvando…</p>}
      </div>

      <div className="surface p-4">
        <h2 className="text-sm font-semibold mb-2">Contatos ({company.contacts.length})</h2>
        {company.contacts.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">Nenhum contato vinculado.</p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {company.contacts.map((c) => {
              const full = [c.firstName, c.lastName].filter(Boolean).join(' ') || '(sem nome)';
              return (
                <li key={c.id} className="py-2 text-sm flex items-center justify-between">
                  <Link href={`/dashboard/contacts/${c.id}`} className="text-[var(--accent)] hover:underline">
                    {full}
                  </Link>
                  <span className="text-xs text-[var(--muted)] font-mono">{c.phone ?? c.email ?? '—'}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="surface p-4">
        <h2 className="text-sm font-semibold mb-2">Oportunidades ({company.leads.length})</h2>
        {company.leads.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">Nenhuma oportunidade.</p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {company.leads.map((o) => {
              const contactName = o.contact
                ? [o.contact.firstName, o.contact.lastName].filter(Boolean).join(' ')
                : o.firstName;
              return (
                <li key={o.id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <Link href={`/dashboard?opportunity=${o.id}`} className="text-[var(--accent)] hover:underline">
                      {contactName || 'Oportunidade'}
                    </Link>
                    <span className="ml-2 text-xs text-[var(--muted)]">
                      {o.stage?.nome ?? '—'} · {o.interestBand} ({o.interestScore})
                    </span>
                  </div>
                  {o.interested && <span className="chip chip--success !text-[9px]">interessado</span>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <div>
      <label className="text-xs text-[var(--muted)]">{label}</label>
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => local !== value && onChange(local)}
        className="input-field mt-1"
      />
    </div>
  );
}
