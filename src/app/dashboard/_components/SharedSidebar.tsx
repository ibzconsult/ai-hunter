'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type TenantLite = { nomeEmpresa: string; email: string };

export default function SharedSidebar({ tenant }: { tenant: TenantLite }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const tab = search.get('tab') ?? 'prospect';
  const initial = (tenant.nomeEmpresa.charAt(0) || tenant.email.charAt(0) || '?').toUpperCase();

  const onDashboard = pathname === '/dashboard';
  const onContacts = pathname?.startsWith('/dashboard/contacts');
  const onCompanies = pathname?.startsWith('/dashboard/companies');
  const onFollowups = pathname?.startsWith('/dashboard/followups');

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <aside className="w-60 shrink-0 border-r border-[var(--line)] bg-[var(--bg-sidebar)] flex flex-col sticky top-0 h-screen">
      <div className="px-4 py-5 border-b border-[var(--line)]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--accent)]/10 border border-[var(--accent-ring)]">
            <span className="text-[11px] font-bold tracking-tight text-[var(--accent)]">AH</span>
          </div>
          <div className="text-[15px] font-semibold tracking-tight">AI Hunter</div>
        </div>
      </div>

      <nav className="flex-1 p-2 overflow-y-auto hide-scrollbar space-y-4">
        <div>
          <div className="nav-section-label">Operação</div>
          <div className="space-y-0.5">
            <NavLinkItem
              href="/dashboard?tab=prospect"
              label="Prospectar"
              icon={<IconTarget />}
              active={onDashboard && tab === 'prospect'}
            />
            <NavLinkItem
              href="/dashboard?tab=leads"
              label="Oportunidades"
              icon={<IconBoard />}
              active={onDashboard && tab === 'leads'}
            />
            <NavLinkItem
              href="/dashboard/contacts"
              label="Contatos"
              icon={<IconUser />}
              active={!!onContacts}
            />
            <NavLinkItem
              href="/dashboard/companies"
              label="Empresas"
              icon={<IconBuilding />}
              active={!!onCompanies}
            />
          </div>
        </div>

        <div>
          <div className="nav-section-label">Configurações</div>
          <div className="space-y-0.5">
            <NavLinkItem
              href="/dashboard?tab=agente"
              label="Agente"
              icon={<IconSparkle />}
              active={onDashboard && tab === 'agente'}
            />
            <NavLinkItem
              href="/dashboard/followups"
              label="Follow-ups"
              icon={<IconClock />}
              active={!!onFollowups}
            />
            <NavLinkItem
              href="/dashboard?tab=whatsapp"
              label="WhatsApp"
              icon={<IconPhone />}
              active={onDashboard && tab === 'whatsapp'}
            />
            <NavLinkItem
              href="/dashboard?tab=integracoes"
              label="Integrações"
              icon={<IconKey />}
              active={onDashboard && tab === 'integracoes'}
            />
          </div>
        </div>
      </nav>

      <div className="border-t border-[var(--line)] p-3">
        <div className="flex items-center gap-3 p-2 rounded-md">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-raised)] border border-[var(--line)] text-sm font-medium">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium truncate">{tenant.nomeEmpresa}</div>
            <div className="text-[11px] text-[var(--text-muted)] truncate">{tenant.email}</div>
          </div>
          <button onClick={logout} className="btn-icon w-7 h-7" title="Sair" aria-label="Sair">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M10 11v1.5a1.5 1.5 0 01-1.5 1.5H3.5A1.5 1.5 0 012 12.5v-9A1.5 1.5 0 013.5 2h5A1.5 1.5 0 0110 3.5V5M7 8h7m0 0l-2.5-2.5M14 8l-2.5 2.5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

function NavLinkItem({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link href={href} className={`nav-item w-full ${active ? 'active' : ''}`}>
      <span className="nav-icon">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
    </Link>
  );
}

function IconTarget() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="0.8" fill="currentColor" />
    </svg>
  );
}

function IconBoard() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2.5" width="3.5" height="11" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="6.5" y="2.5" width="3.5" height="7" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="11" y="2.5" width="3" height="9" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M3 13.5c1-2.5 3-3.5 5-3.5s4 1 5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2.5" y="2" width="11" height="12" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 5h1.5M9.5 5H11M5 7.5h1.5M9.5 7.5H11M5 10h1.5M9.5 10H11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M7 14v-2.5h2V14" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M3 3.5A1.5 1.5 0 014.5 2h1a1.5 1.5 0 011.5 1.2l.4 2A1.5 1.5 0 017.1 6.7l-1 .7a10 10 0 004.5 4.5l.7-1a1.5 1.5 0 011.5-.5l2 .4a1.5 1.5 0 011.2 1.5v1A1.5 1.5 0 0114.5 15 11.5 11.5 0 013 3.5z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconKey() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="5.5" cy="10.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7.3 8.7L13 3M11.5 4.5l1.5 1.5M10 6l1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
