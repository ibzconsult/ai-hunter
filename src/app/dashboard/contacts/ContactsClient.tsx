'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Contact = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  companyId: string | null;
  company: { id: string; nome: string } | null;
  _count?: { leads: number };
};

type CompanyLite = { id: string; nome: string };

export default function ContactsClient() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void load();
  }, [q]);

  async function load() {
    setLoading(true);
    const url = q ? `/api/contacts?q=${encodeURIComponent(q)}` : '/api/contacts';
    const res = await fetch(url);
    const data = await res.json();
    if (data.ok) setContacts(data.contacts);
    setLoading(false);
  }

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-xs text-[var(--muted)] hover:underline">
            ← Dashboard
          </Link>
          <h1 className="text-xl font-semibold mt-1">Contatos</h1>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary px-3 py-1.5 text-sm">
          Novo contato
        </button>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nome, email, telefone…"
        className="input-field"
      />

      {loading ? (
        <div className="text-sm text-[var(--muted)]">Carregando…</div>
      ) : contacts.length === 0 ? (
        <div className="text-sm text-[var(--muted)]">Nenhum contato.</div>
      ) : (
        <div className="surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-soft)] text-xs text-[var(--muted)] uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2">Nome</th>
                <th className="text-left px-3 py-2">Telefone</th>
                <th className="text-left px-3 py-2">Email</th>
                <th className="text-left px-3 py-2">Empresa</th>
                <th className="text-left px-3 py-2">Oport.</th>
                <th className="text-right px-3 py-2 w-12">Editar</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => {
                const full = [c.firstName, c.lastName].filter(Boolean).join(' ') || '—';
                return (
                  <tr key={c.id} className="border-t border-[var(--line)] hover:bg-[var(--bg-soft)]">
                    <td className="px-3 py-2">
                      <Link href={`/dashboard/contacts/${c.id}`} className="text-[var(--accent)] hover:underline">
                        {full}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{c.phone ?? '—'}</td>
                    <td className="px-3 py-2 text-xs">{c.email ?? '—'}</td>
                    <td className="px-3 py-2 text-xs">
                      {c.company ? (
                        <Link
                          href={`/dashboard/companies/${c.company.id}`}
                          className="text-[var(--accent)] hover:underline"
                        >
                          {c.company.nome}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">{c._count?.leads ?? 0}</td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/dashboard/contacts/${c.id}`}
                        className="text-[var(--muted)] hover:text-[var(--accent)]"
                        aria-label="Editar contato"
                        title="Editar"
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="inline-block">
                          <path d="M11.5 2.5l2 2-7 7-2.5.5.5-2.5 7-7z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && <ContactCreateModal onClose={() => setCreating(false)} onCreated={load} />}
    </div>
  );
}

function ContactCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [companies, setCompanies] = useState<CompanyLite[]>([]);
  const [createOpportunity, setCreateOpportunity] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyModal, setCompanyModal] = useState(false);

  useEffect(() => {
    void loadCompanies();
  }, []);

  async function loadCompanies() {
    const res = await fetch('/api/companies');
    const data = await res.json();
    if (data.ok) setCompanies(data.companies.map((c: { id: string; nome: string }) => ({ id: c.id, nome: c.nome })));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: firstName || null,
        lastName: lastName || null,
        email: email || null,
        phone: phone || null,
        role: role || null,
        companyId: companyId || null,
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      setSaving(false);
      return setError(data.error ?? 'Falha');
    }

    if (createOpportunity) {
      const leadRes = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: data.contact.id,
          companyId: companyId || null,
          firstName: firstName || null,
          telefone: phone || null,
        }),
      });
      const leadData = await leadRes.json();
      setSaving(false);
      if (leadData.success) {
        onCreated();
        onClose();
        router.push(`/dashboard?opportunity=${leadData.lead.id}`);
        return;
      }
      setError(leadData.error ?? 'Contato salvo, mas falhou ao criar oportunidade');
      return;
    }

    setSaving(false);
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-6" onClick={onClose}>
      <div className="w-full max-w-md surface p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">Novo contato</h3>
        <div className="grid grid-cols-2 gap-2">
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Nome" className="input-field" />
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Sobrenome" className="input-field" />
        </div>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="input-field" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="WhatsApp" className="input-field" />
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Cargo" className="input-field" />

        <div>
          <label className="text-xs text-[var(--muted)]">Empresa</label>
          <div className="flex gap-2 mt-1">
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="input-field flex-1"
            >
              <option value="">(sem empresa)</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setCompanyModal(true)}
              className="btn-ghost px-3 text-xs whitespace-nowrap"
              title="Criar nova empresa"
            >
              + nova
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-[var(--muted)] pt-1">
          <input
            type="checkbox"
            checked={createOpportunity}
            onChange={(e) => setCreateOpportunity(e.target.checked)}
          />
          Criar oportunidade para este contato em seguida
        </label>

        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-ghost px-3 py-1.5 text-sm">Cancelar</button>
          <button onClick={save} disabled={saving} className="btn-primary px-3 py-1.5 text-sm">
            {saving ? '…' : 'Criar'}
          </button>
        </div>
      </div>

      {companyModal && (
        <InlineCompanyModal
          onClose={() => setCompanyModal(false)}
          onCreated={async (c) => {
            await loadCompanies();
            setCompanyId(c.id);
            setCompanyModal(false);
          }}
        />
      )}
    </div>
  );
}

function InlineCompanyModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (c: { id: string; nome: string }) => void;
}) {
  const [nome, setNome] = useState('');
  const [site, setSite] = useState('');
  const [segmento, setSegmento] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!nome.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, site, segmento }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.ok) return setError(data.error ?? 'Falha');
    onCreated(data.company);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-6"
      onClick={onClose}
    >
      <div className="w-full max-w-md surface p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">Nova empresa</h3>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome *" className="input-field" autoFocus />
        <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="Site (https://…)" className="input-field" />
        <input value={segmento} onChange={(e) => setSegmento(e.target.value)} placeholder="Segmento" className="input-field" />
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-ghost px-3 py-1.5 text-sm">Cancelar</button>
          <button onClick={save} disabled={saving || !nome.trim()} className="btn-primary px-3 py-1.5 text-sm">
            {saving ? '…' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
}
