'use client';

import Link from 'next/link';
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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, email, phone, role }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.ok) return setError(data.error ?? 'Falha');
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
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-ghost px-3 py-1.5 text-sm">Cancelar</button>
          <button onClick={save} disabled={saving} className="btn-primary px-3 py-1.5 text-sm">
            {saving ? '…' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
}
