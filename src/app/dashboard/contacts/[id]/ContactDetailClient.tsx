'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Opportunity = {
  id: string;
  stageId: string | null;
  stage: { nome: string } | null;
  empresa: string | null;
  company: { id: string; nome: string } | null;
  interested: boolean;
  interestBand: string;
  interestScore: number;
};

type Contact = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  companyId: string | null;
  company: { id: string; nome: string } | null;
  notes: string | null;
  leads: Opportunity[];
};

type CompanyLite = { id: string; nome: string };

export default function ContactDetailClient({ id }: { id: string }) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [companies, setCompanies] = useState<CompanyLite[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
    void fetch('/api/companies')
      .then((r) => r.json())
      .then((d) => d.ok && setCompanies(d.companies));
  }, [id]);

  async function load() {
    const res = await fetch(`/api/contacts/${id}`);
    const data = await res.json();
    if (data.ok) setContact(data.contact);
  }

  async function save(patch: Partial<Contact>) {
    setSaving(true);
    await fetch(`/api/contacts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    await load();
  }

  if (!contact) return <div className="p-8 text-sm text-[var(--muted)]">Carregando…</div>;

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-4">
      <Link href="/dashboard/contacts" className="text-xs text-[var(--muted)] hover:underline">
        ← Contatos
      </Link>

      <div className="surface p-4 space-y-3">
        <h1 className="text-lg font-semibold">
          {[contact.firstName, contact.lastName].filter(Boolean).join(' ') || '(sem nome)'}
        </h1>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome" value={contact.firstName ?? ''} onChange={(v) => save({ firstName: v })} />
          <Field label="Sobrenome" value={contact.lastName ?? ''} onChange={(v) => save({ lastName: v })} />
          <Field label="Email" value={contact.email ?? ''} onChange={(v) => save({ email: v })} />
          <Field label="Telefone" value={contact.phone ?? ''} onChange={(v) => save({ phone: v })} />
          <Field label="Cargo" value={contact.role ?? ''} onChange={(v) => save({ role: v })} />
          <div>
            <label className="text-xs text-[var(--muted)]">Empresa</label>
            <select
              value={contact.companyId ?? ''}
              onChange={(e) => save({ companyId: e.target.value || null })}
              className="input-field mt-1"
            >
              <option value="">(sem empresa)</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
        {saving && <p className="text-xs text-[var(--muted)]">Salvando…</p>}
      </div>

      {contact.company && (
        <div className="surface p-4">
          <h2 className="text-sm font-semibold mb-2">Empresa</h2>
          <Link
            href={`/dashboard/companies/${contact.company.id}`}
            className="text-[var(--accent)] hover:underline text-sm"
          >
            {contact.company.nome} →
          </Link>
        </div>
      )}

      <div className="surface p-4">
        <h2 className="text-sm font-semibold mb-2">Oportunidades ({contact.leads.length})</h2>
        {contact.leads.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">Nenhuma oportunidade associada.</p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {contact.leads.map((o) => (
              <li key={o.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <Link href={`/dashboard?opportunity=${o.id}`} className="text-[var(--accent)] hover:underline">
                    {o.company?.nome ?? o.empresa ?? 'Oportunidade'}
                  </Link>
                  <span className="ml-2 text-xs text-[var(--muted)]">
                    {o.stage?.nome ?? '—'} · {o.interestBand} ({o.interestScore})
                  </span>
                </div>
                {o.interested && <span className="chip chip--success !text-[9px]">interessado</span>}
              </li>
            ))}
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
