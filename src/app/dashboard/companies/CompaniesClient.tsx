'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Company = {
  id: string;
  nome: string;
  site: string | null;
  segmento: string | null;
  _count?: { contacts: number; leads: number };
};

export default function CompaniesClient() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void load();
  }, [q]);

  async function load() {
    setLoading(true);
    const url = q ? `/api/companies?q=${encodeURIComponent(q)}` : '/api/companies';
    const res = await fetch(url);
    const data = await res.json();
    if (data.ok) setCompanies(data.companies);
    setLoading(false);
  }

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-xs text-[var(--muted)] hover:underline">
            ← Dashboard
          </Link>
          <h1 className="text-xl font-semibold mt-1">Empresas</h1>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary px-3 py-1.5 text-sm">
          Nova empresa
        </button>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nome…"
        className="input-field"
      />

      {loading ? (
        <div className="text-sm text-[var(--muted)]">Carregando…</div>
      ) : companies.length === 0 ? (
        <div className="text-sm text-[var(--muted)]">Nenhuma empresa.</div>
      ) : (
        <div className="surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-soft)] text-xs text-[var(--muted)] uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2">Nome</th>
                <th className="text-left px-3 py-2">Site</th>
                <th className="text-left px-3 py-2">Segmento</th>
                <th className="text-left px-3 py-2">Contatos</th>
                <th className="text-left px-3 py-2">Oport.</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-t border-[var(--line)] hover:bg-[var(--bg-soft)]">
                  <td className="px-3 py-2">
                    <Link href={`/dashboard/companies/${c.id}`} className="text-[var(--accent)] hover:underline">
                      {c.nome}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {c.site ? (
                      <a href={c.site} target="_blank" rel="noreferrer" className="hover:underline">
                        {c.site}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{c.segmento ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">{c._count?.contacts ?? 0}</td>
                  <td className="px-3 py-2 text-xs">{c._count?.leads ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && <CompanyCreateModal onClose={() => setCreating(false)} onCreated={load} />}
    </div>
  );
}

function CompanyCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [nome, setNome] = useState('');
  const [site, setSite] = useState('');
  const [segmento, setSegmento] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
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
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-6" onClick={onClose}>
      <div className="w-full max-w-md surface p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">Nova empresa</h3>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome *" className="input-field" />
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
