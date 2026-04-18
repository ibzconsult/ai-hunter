'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ nome_empresa: '', email: '', password: '', telefone: '' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) router.push('/dashboard');
      else setErr(data.error ?? 'Erro');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }

  function up<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <div className="relative z-10 min-h-screen flex items-center justify-center px-6 py-12">
      <form
        onSubmit={submit}
        className="w-full max-w-md surface p-8 space-y-6 rise"
      >
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)] font-mono mb-2">
            Começar
          </p>
          <h1 className="text-3xl font-semibold leading-tight">
            Crie sua conta <span className="text-[var(--accent)]">agora</span>.
          </h1>
          <p className="text-sm text-[var(--text-dim)] mt-2">
            Leva 30 segundos. Sem cartão.
          </p>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.15em] font-mono text-[var(--text-muted)]">
              Nome da empresa
            </span>
            <input
              value={form.nome_empresa}
              onChange={(e) => up('nome_empresa', e.target.value)}
              className="input-field mt-1.5"
              required
              autoFocus
            />
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.15em] font-mono text-[var(--text-muted)]">
              Email
            </span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => up('email', e.target.value)}
              className="input-field mt-1.5"
              required
            />
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.15em] font-mono text-[var(--text-muted)]">
              Senha
            </span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => up('password', e.target.value)}
              className="input-field mt-1.5"
              required
              minLength={6}
              placeholder="mínimo 6 caracteres"
            />
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.15em] font-mono text-[var(--text-muted)]">
              Telefone <span className="text-[var(--text-faint)] normal-case">(opcional)</span>
            </span>
            <input
              value={form.telefone}
              onChange={(e) => up('telefone', e.target.value)}
              className="input-field mt-1.5"
            />
          </label>
        </div>

        {err && (
          <p className="text-sm text-[var(--danger)] border-l-2 border-[var(--danger)] pl-3">
            {err}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-2.5 text-sm"
        >
          {loading ? 'Criando…' : 'Criar conta →'}
        </button>

        <div className="text-center text-sm text-[var(--text-muted)] pt-2 border-t border-[var(--line)]">
          Já tem conta?{' '}
          <Link href="/login" className="text-[var(--accent)] hover:text-[var(--accent-hover)]">
            Entrar
          </Link>
        </div>
      </form>
    </div>
  );
}
