'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useDirtyForm, UnsavedConfirmDialog } from '../../_components/DirtyGuard';

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
  isPrimary: boolean;
  notes: string | null;
  leads: Opportunity[];
};

type CompanyLite = { id: string; nome: string };

type Draft = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  companyId: string;
  isPrimary: boolean;
  notes: string;
};

function toDraft(c: Contact | null): Draft {
  return {
    firstName: c?.firstName ?? '',
    lastName: c?.lastName ?? '',
    email: c?.email ?? '',
    phone: c?.phone ?? '',
    role: c?.role ?? '',
    companyId: c?.companyId ?? '',
    isPrimary: c?.isPrimary ?? false,
    notes: c?.notes ?? '',
  };
}

export default function ContactDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [companies, setCompanies] = useState<CompanyLite[]>([]);
  const [saving, setSaving] = useState(false);
  const [leads, setLeads] = useState<Opportunity[]>([]);

  const { form, setForm, dirty, persist } = useDirtyForm<Draft>(toDraft(contact));
  const [confirmPending, setConfirmPending] = useState<null | 'back'>(null);

  useEffect(() => {
    void load();
    void fetch('/api/companies')
      .then((r) => r.json())
      .then((d) => d.ok && setCompanies(d.companies));
  }, [id]);

  async function load() {
    const res = await fetch(`/api/contacts/${id}`);
    const data = await res.json();
    if (data.ok) {
      setContact(data.contact);
      setLeads(data.contact.leads ?? []);
    }
  }

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setForm({ ...form, [k]: v });
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/contacts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: form.firstName || null,
        lastName: form.lastName || null,
        email: form.email || null,
        phone: form.phone || null,
        role: form.role || null,
        companyId: form.companyId || null,
        isPrimary: form.isPrimary,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.ok) {
      await load();
      persist(form);
    }
  }

  async function handleBack() {
    if (dirty) {
      setConfirmPending('back');
      return;
    }
    router.push('/dashboard/contacts');
  }

  async function createOpportunity() {
    if (!contact) return;
    if (dirty) {
      if (!confirm('Há alterações pendentes no contato. Salvar antes de criar a oportunidade?')) return;
      await save();
    }
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactId: contact.id,
        companyId: contact.companyId || null,
        firstName: contact.firstName || null,
        telefone: contact.phone || null,
      }),
    });
    const data = await res.json();
    if (data.success) {
      router.push(`/dashboard?opportunity=${data.lead.id}`);
    } else {
      alert(data.error ?? 'Erro ao criar oportunidade');
    }
  }

  async function onConfirm(choice: 'save' | 'discard' | 'cancel') {
    if (choice === 'cancel') return setConfirmPending(null);
    if (choice === 'save') {
      await save();
    }
    setConfirmPending(null);
    router.push('/dashboard/contacts');
  }

  if (!contact) return <div className="p-8 text-sm text-[var(--muted)]">Carregando…</div>;

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-4">
      <button onClick={handleBack} className="text-xs text-[var(--muted)] hover:underline">
        ← Contatos
      </button>

      <div className="surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">
            {[form.firstName, form.lastName].filter(Boolean).join(' ') || '(sem nome)'}
          </h1>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="btn-primary px-4 py-1.5 text-sm disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome" value={form.firstName} onChange={(v) => set('firstName', v)} />
          <Field label="Sobrenome" value={form.lastName} onChange={(v) => set('lastName', v)} />
          <Field label="Email" value={form.email} onChange={(v) => set('email', v)} />
          <Field label="Telefone" value={form.phone} onChange={(v) => set('phone', v)} />
          <Field label="Cargo" value={form.role} onChange={(v) => set('role', v)} />
          <div>
            <label className="text-xs text-[var(--muted)]">Empresa</label>
            <select
              value={form.companyId}
              onChange={(e) => set('companyId', e.target.value)}
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

        {form.companyId && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isPrimary}
              onChange={(e) => set('isPrimary', e.target.checked)}
            />
            Contato principal desta empresa
          </label>
        )}

        {dirty && <p className="text-xs text-amber-700">Alterações pendentes.</p>}
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
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">Oportunidades ({leads.length})</h2>
          <button onClick={createOpportunity} className="btn-primary px-3 py-1 text-xs">
            + Nova oportunidade
          </button>
        </div>
        {leads.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">Nenhuma oportunidade associada.</p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {leads.map((o) => (
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

      <UnsavedConfirmDialog open={confirmPending !== null} onChoice={onConfirm} />
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
  return (
    <div>
      <label className="text-xs text-[var(--muted)]">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field mt-1"
      />
    </div>
  );
}
