'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useDirtyForm, UnsavedConfirmDialog } from '../../_components/DirtyGuard';

type Contact = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
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

type Draft = {
  nome: string;
  site: string;
  segmento: string;
  notes: string;
};

function toDraft(c: Company | null): Draft {
  return {
    nome: c?.nome ?? '',
    site: c?.site ?? '',
    segmento: c?.segmento ?? '',
    notes: c?.notes ?? '',
  };
}

export default function CompanyDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);
  const { form, setForm, dirty, persist } = useDirtyForm<Draft>(toDraft(company));
  const [confirmPending, setConfirmPending] = useState<null | 'back'>(null);

  useEffect(() => {
    void load();
  }, [id]);

  async function load() {
    const res = await fetch(`/api/companies/${id}`);
    const data = await res.json();
    if (data.ok) setCompany(data.company);
  }

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setForm({ ...form, [k]: v });
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/companies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: form.nome,
        site: form.site,
        segmento: form.segmento,
        notes: form.notes,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.ok) {
      await load();
      persist(form);
    }
  }

  async function makePrimary(contactId: string) {
    await fetch(`/api/contacts/${contactId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPrimary: true }),
    });
    await load();
  }

  function handleBack() {
    if (dirty) return setConfirmPending('back');
    router.push('/dashboard/companies');
  }

  async function onConfirm(choice: 'save' | 'discard' | 'cancel') {
    if (choice === 'cancel') return setConfirmPending(null);
    if (choice === 'save') await save();
    setConfirmPending(null);
    router.push('/dashboard/companies');
  }

  if (!company) return <div className="p-8 text-sm text-[var(--muted)]">Carregando…</div>;

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-4">
      <button onClick={handleBack} className="text-xs text-[var(--muted)] hover:underline">
        ← Empresas
      </button>

      <div className="surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">{form.nome || '(sem nome)'}</h1>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="btn-primary px-4 py-1.5 text-sm disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome" value={form.nome} onChange={(v) => set('nome', v)} />
          <Field label="Site" value={form.site} onChange={(v) => set('site', v)} />
          <Field label="Segmento" value={form.segmento} onChange={(v) => set('segmento', v)} />
          <Field label="Notas" value={form.notes} onChange={(v) => set('notes', v)} />
        </div>
        {dirty && <p className="text-xs text-amber-700">Alterações pendentes.</p>}
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
                <li key={c.id} className="py-2 text-sm flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Link href={`/dashboard/contacts/${c.id}`} className="text-[var(--accent)] hover:underline truncate">
                      {full}
                    </Link>
                    {c.isPrimary && <span className="chip chip--accent !text-[9px]">principal</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-[var(--muted)] font-mono">{c.phone ?? c.email ?? '—'}</span>
                    {!c.isPrimary && (
                      <button
                        onClick={() => makePrimary(c.id)}
                        className="btn-ghost px-2 py-1 text-[10px]"
                        title="Tornar principal"
                      >
                        tornar principal
                      </button>
                    )}
                  </div>
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
