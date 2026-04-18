'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
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

  return (
    <div className="relative z-10 min-h-screen grid md:grid-cols-2">
      <aside className="hidden md:flex flex-col justify-between p-12 border-r border-[var(--line)]">
        <div className="flex items-center gap-3 rise">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--accent-ring)] bg-[var(--accent)]/10">
            <span className="text-[13px] font-bold tracking-tight text-[var(--accent)]">AH</span>
          </div>
          <div className="text-xl font-semibold tracking-tight">AI Hunter</div>
        </div>

        <div className="space-y-6 rise rise-d2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)] font-mono">
            Prospecção B2B · WhatsApp
          </p>
          <h1 className="text-5xl leading-[1.05] tracking-tight">
            Encontre. <span className="text-[var(--accent)]">Filtre.</span>
            <br />
            Dispare com copy
            <br />
            de <span className="text-[var(--accent)]">gente</span>.
          </h1>
          <p className="text-[var(--text-dim)] max-w-sm leading-relaxed">
            Google Maps → filtro automático de WhatsApp → abertura personalizada em 2 mensagens.
            Sem lista morta, sem copia-cola.
          </p>
        </div>

        <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)] font-mono rise rise-d3">
          by @igorconsultor
        </p>
      </aside>

      <main className="flex items-center justify-center p-8">
        <form
          onSubmit={submit}
          className="w-full max-w-sm surface p-8 space-y-6 rise rise-d1"
        >
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)] font-mono mb-2">
              Entrar
            </p>
            <h2 className="text-3xl font-semibold">Bem-vindo de volta.</h2>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.15em] font-mono text-[var(--text-muted)]">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field mt-1.5"
                required
                autoFocus
              />
            </label>

            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.15em] font-mono text-[var(--text-muted)]">
                Senha
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field mt-1.5"
                required
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
            {loading ? 'Entrando…' : 'Entrar →'}
          </button>

          <div className="text-center text-sm text-[var(--text-muted)] pt-2 border-t border-[var(--line)]">
            Não tem conta?{' '}
            <Link href="/register" className="text-[var(--accent)] hover:text-[var(--accent-hover)]">
              Criar agora
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
