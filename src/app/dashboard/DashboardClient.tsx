'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import PipelineView from './PipelineView';
import { formatPhone } from '@/lib/phone';

type Tenant = {
  id: string;
  nomeEmpresa: string;
  email: string;
  produtosServicos: string | null;
  icp: string | null;
  diferenciais: string | null;
  tomAbordagem: string;
  propostaValor: string | null;
  mensagemPadrao: string | null;
  apresentacao: string | null;
  cumprimento1: string | null;
  cumprimento2: string | null;
  cumprimento3: string | null;
  openaiApiKey: string | null;
  serpapiKey: string | null;
  notificationPhone: string | null;
  agentEnabled: boolean;
  agentPersona: string | null;
};

type Instance = {
  id: string;
  label: string | null;
  status: string;
  instanceToken: string | null;
  createdAt: string | Date;
};

type SiteAnalysis = {
  tipoNegocio: string;
  segmento: string;
  ofertas: string[];
  doresAparentes: string[];
  provaSocial: string[];
  tomMarca: string;
  ganchoEspecifico: string;
  pessoasMencionadas: { nome: string; cargo?: string }[];
  publicoAlvo: string;
  confianca: number;
};

type LeadTag = { id: string; nome: string; color: string };

type Lead = {
  id: string;
  empresa: string | null;
  firstName: string | null;
  telefone: string | null;
  site: string | null;
  contexto: string | null;
  disparo: string;
  origem: string;
  ultimaMensagem: string | null;
  stageId: string | null;
  respondeu: boolean;
  classificacao: string | null;
  ultimaResposta: string | null;
  siteAnalysis: SiteAnalysis | null;
  createdAt: string;
  isDraft?: boolean;
  interestScore?: number;
  interestBand?: 'cold' | 'warm' | 'hot' | 'interested';
  interestSignals?: Array<{ type: string; weight: number; matchedAt: string; excerpt: string }> | null;
  followupCount?: number;
  lastFollowupAt?: string | null;
  nextFollowupAt?: string | null;
  followupPausedUntil?: string | null;
  followupManuallyPaused?: boolean;
  interested?: boolean;
  lastInteractionAt?: string | null;
  tags?: LeadTag[];
  contact?: { id: string; firstName: string | null; lastName: string | null; phone: string | null } | null;
  company?: { id: string; nome: string } | null;
  stage?: { id: string; nome: string } | null;
  messagesOutCount?: number;
};

type ProspectRow = {
  nomeEmpresa: string;
  telefone: string;
  rating?: number;
  reviews?: number;
  especialidades?: string;
  site?: string;
  jaEnviado: boolean;
  existe: boolean;
};

type LeadFormValues = {
  firstName: string;
  empresa: string;
  telefone: string;
  site: string;
  contexto: string;
};

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; lead: Lead };

type TabId = 'prospect' | 'leads' | 'pipeline' | 'agente' | 'whatsapp' | 'integracoes';

type Props = { tenant: Tenant; initialInstances: Instance[] };

export default function DashboardClient({ tenant, initialInstances }: Props) {
  const router = useRouter();
  const [instances, setInstances] = useState(initialInstances);
  const [qr, setQr] = useState<{ id: string; qrcode: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabId) ?? 'prospect';
  const validTabs: TabId[] = ['prospect', 'leads', 'pipeline', 'agente', 'whatsapp', 'integracoes'];
  const [tab, setTab] = useState<TabId>(
    validTabs.includes(initialTab) ? initialTab : 'prospect'
  );

  // Sincroniza com mudanças de URL vindo do sidebar compartilhado
  useEffect(() => {
    const t = searchParams.get('tab') as TabId | null;
    if (t && validTabs.includes(t) && t !== tab) setTab(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoaded, setLeadsLoaded] = useState(false);
  const [oppView, setOppView] = useState<'list' | 'kanban'>('list');
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const [modalErr, setModalErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [minDelay, setMinDelay] = useState(45);
  const [maxDelay, setMaxDelay] = useState(90);
  const [bulk, setBulk] = useState<null | {
    total: number;
    done: number;
    fail: number;
    current?: string;
  }>(null);
  const stopRef = useRef(false);

  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [maxPages, setMaxPages] = useState(5);
  const [prospects, setProspects] = useState<ProspectRow[]>([]);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const [sending, setSending] = useState<Record<string, 'loading' | 'ok' | 'err'>>({});
  const [selectedInstance, setSelectedInstance] = useState<string>('');

  useEffect(() => {
    if (!selectedInstance) {
      const connected = instances.find((i) => i.status === 'connected');
      if (connected) setSelectedInstance(connected.id);
      else if (instances[0]) setSelectedInstance(instances[0].id);
    }
  }, [instances, selectedInstance]);

  const [profile, setProfile] = useState({
    nome_empresa: tenant.nomeEmpresa,
    produtos_servicos: tenant.produtosServicos ?? '',
    icp: tenant.icp ?? '',
    diferenciais: tenant.diferenciais ?? '',
    tom_abordagem: tenant.tomAbordagem,
    proposta_valor: tenant.propostaValor ?? '',
    mensagem_padrao: tenant.mensagemPadrao ?? '',
    apresentacao: tenant.apresentacao ?? '',
    cumprimento_1: tenant.cumprimento1 ?? '',
    cumprimento_2: tenant.cumprimento2 ?? '',
    cumprimento_3: tenant.cumprimento3 ?? '',
    openai_api_key: tenant.openaiApiKey ?? '',
    serpapi_key: tenant.serpapiKey ?? '',
    notification_phone: tenant.notificationPhone ?? '',
    agent_enabled: tenant.agentEnabled,
    agent_persona: tenant.agentPersona ?? '',
  });

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  async function addInstance() {
    const label = prompt('Nome da instância (ex: Comercial, Suporte):');
    if (!label) return;
    setBusy(true);
    try {
      const res = await fetch('/api/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      const data = await res.json();
      if (data.success) {
        setInstances((arr) => [data.instance, ...arr]);
        if (data.instance.qrcode) setQr({ id: data.instance.id, qrcode: data.instance.qrcode });
      } else alert(data.error);
    } finally {
      setBusy(false);
    }
  }

  async function checkStatus(id: string) {
    const res = await fetch(`/api/instances/${id}?action=status`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      setInstances((arr) => arr.map((i) => (i.id === id ? { ...i, status: data.instance.status } : i)));
      if (data.instance.status === 'connected') {
        setQr((q) => (q && q.id === id ? null : q));
      } else if (data.instance.qrcode) {
        setQr({ id, qrcode: data.instance.qrcode });
      }
    }
    return data;
  }

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!qr) return;
    pollRef.current = setInterval(() => {
      void checkStatus(qr.id);
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qr?.id]);

  async function connect(id: string) {
    const res = await fetch(`/api/instances/${id}?action=connect`, { method: 'POST' });
    const data = await res.json();
    if (data.success && data.instance.qrcode) setQr({ id, qrcode: data.instance.qrcode });
  }

  async function remove(id: string) {
    if (!confirm('Remover instância?')) return;
    await fetch(`/api/instances/${id}`, { method: 'DELETE' });
    setInstances((arr) => arr.filter((i) => i.id !== id));
  }

  async function runSearch() {
    if (!query.trim()) return;
    if (!selectedInstance) {
      setSearchMsg('Selecione uma instância WhatsApp conectada antes de buscar.');
      return;
    }
    setBusy(true);
    setSearchMsg(null);
    setProspects([]);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, location, instance_id: selectedInstance, maxPages }),
      });
      const data = await res.json();
      if (data.success) {
        setProspects(data.prospects);
        if (data.prospects.length === 0) {
          setSearchMsg(
            data.totalFound > 0
              ? `${data.totalFound} resultados — nenhum com WhatsApp válido.`
              : 'Nenhum resultado com telefone.'
          );
        } else {
          setSearchMsg(`${data.withWhatsapp} com WhatsApp de ${data.totalFound} encontrados.`);
        }
      } else setSearchMsg(data.error ?? 'Erro na busca');
    } finally {
      setBusy(false);
    }
  }

  async function dispatchProspect(p: ProspectRow) {
    if (!selectedInstance) return alert('Selecione uma instância conectada.');
    setSending((s) => ({ ...s, [p.telefone]: 'loading' }));
    try {
      const res = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instance_id: selectedInstance,
          prospect: {
            nome_empresa: p.nomeEmpresa,
            telefone: p.telefone,
            rating_google: p.rating,
            reviews_google: p.reviews,
            especialidades: p.especialidades,
            site_empresa: p.site,
          },
        }),
      });
      const data = await res.json();
      setSending((s) => ({ ...s, [p.telefone]: data.success ? 'ok' : 'err' }));
      if (data.success) {
        setProspects((arr) => arr.map((x) => (x.telefone === p.telefone ? { ...x, jaEnviado: true } : x)));
      } else alert(data.error);
    } catch {
      setSending((s) => ({ ...s, [p.telefone]: 'err' }));
    }
  }

  async function loadLeads() {
    const res = await fetch('/api/leads');
    const data = await res.json();
    if (data.success) {
      setLeads(data.leads);
      setLeadsLoaded(true);
    }
  }

  useEffect(() => {
    if ((tab === 'leads' || tab === 'pipeline') && !leadsLoaded) void loadLeads();
  }, [tab, leadsLoaded]);

  async function uploadCsv(file: File) {
    setBusy(true);
    setImportMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/leads/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        setImportMsg(`${data.imported} importados · ${data.skipped} ignorados.`);
        await loadLeads();
      } else setImportMsg(data.error ?? 'Erro no import');
    } finally {
      setBusy(false);
    }
  }

  async function sendLead(leadId: string) {
    if (!selectedInstance) return alert('Selecione uma instância conectada.');
    setSending((s) => ({ ...s, [leadId]: 'loading' }));
    try {
      const res = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance_id: selectedInstance, lead_id: leadId }),
      });
      const data = await res.json();
      setSending((s) => ({ ...s, [leadId]: data.success ? 'ok' : 'err' }));
      if (data.success) {
        setLeads((arr) =>
          arr.map((l) =>
            l.id === leadId
              ? { ...l, disparo: 'sim', ultimaMensagem: (data.messages ?? []).join('\n\n') }
              : l
          )
        );
      } else alert(data.error);
    } catch {
      setSending((s) => ({ ...s, [leadId]: 'err' }));
    }
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllPending() {
    const pending = leads.filter((l) => l.disparo !== 'sim').map((l) => l.id);
    setSelected(new Set(pending));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function bulkDispatch() {
    if (!selectedInstance) return alert('Selecione uma instância conectada.');
    const ids = Array.from(selected).filter((id) => {
      const lead = leads.find((l) => l.id === id);
      return lead && lead.disparo !== 'sim';
    });
    if (ids.length === 0) return;

    const min = Math.max(15, Math.min(minDelay, maxDelay));
    const max = Math.max(min, maxDelay);

    stopRef.current = false;
    setBulk({ total: ids.length, done: 0, fail: 0 });

    for (let i = 0; i < ids.length; i++) {
      if (stopRef.current) break;
      const leadId = ids[i];
      const lead = leads.find((l) => l.id === leadId);
      setBulk((b) =>
        b ? { ...b, current: lead?.empresa ?? lead?.firstName ?? lead?.telefone ?? leadId } : b
      );
      setSending((s) => ({ ...s, [leadId]: 'loading' }));

      try {
        const res = await fetch('/api/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instance_id: selectedInstance, lead_id: leadId }),
        });
        const data = await res.json();
        const ok = !!data.success;
        setSending((s) => ({ ...s, [leadId]: ok ? 'ok' : 'err' }));
        if (ok) {
          setLeads((arr) =>
            arr.map((l) =>
              l.id === leadId
                ? { ...l, disparo: 'sim', ultimaMensagem: (data.messages ?? []).join('\n\n') }
                : l
            )
          );
        }
        setBulk((b) => (b ? { ...b, done: b.done + (ok ? 1 : 0), fail: b.fail + (ok ? 0 : 1) } : b));
      } catch {
        setSending((s) => ({ ...s, [leadId]: 'err' }));
        setBulk((b) => (b ? { ...b, fail: b.fail + 1 } : b));
      }

      if (i < ids.length - 1 && !stopRef.current) {
        const wait = (min + Math.random() * (max - min)) * 1000;
        const until = Date.now() + wait;
        while (Date.now() < until && !stopRef.current) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
    }

    setBulk(null);
    setSelected(new Set());
  }

  async function saveLeadForm(values: LeadFormValues) {
    setModalErr(null);
    if (modal.mode === 'edit') {
      const res = await fetch(`/api/leads/${modal.lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.success) {
        setLeads((arr) => arr.map((l) => (l.id === modal.lead.id ? { ...l, ...data.lead } : l)));
        setModal({ mode: 'closed' });
      } else setModalErr(data.error ?? 'Erro ao salvar');
    } else if (modal.mode === 'create') {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.success) {
        setLeads((arr) => [data.lead, ...arr]);
        setModal({ mode: 'closed' });
      } else setModalErr(data.error ?? 'Erro ao criar');
    }
  }

  async function deleteLead(leadId: string) {
    if (!confirm('Remover este lead?')) return;
    const res = await fetch('/api/leads', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [leadId] }),
    });
    const data = await res.json();
    if (data.success) setLeads((arr) => arr.filter((l) => l.id !== leadId));
  }

  async function saveProfile() {
    setBusy(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (data.success) alert('Salvo.');
      else alert(data.error);
    } finally {
      setBusy(false);
    }
  }

  const pendingCount = leads.filter((l) => l.disparo !== 'sim').length;
  const sentCount = leads.filter((l) => l.disparo === 'sim').length;
  const initial = (tenant.nomeEmpresa.charAt(0) || tenant.email.charAt(0) || '?').toUpperCase();

  return (
    <>
      <div className="min-w-0">
        {tab === 'prospect' && (
          <PageShell
            title="Prospectar"
            subtitle="Busca no Google Maps com filtro automático de WhatsApp ativo."
          >
            <div className="surface p-5 space-y-4">
              <div className="grid md:grid-cols-[1fr_1fr_auto_auto] gap-3">
                <FieldStacked label="Segmento">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                    placeholder="clínica odontológica"
                    className="input-field"
                  />
                </FieldStacked>
                <FieldStacked label="Cidade (opcional)">
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                    placeholder="Fortaleza, CE"
                    className="input-field"
                  />
                </FieldStacked>
                <FieldStacked label="Máx. resultados" hint="20 por página">
                  <select
                    value={maxPages}
                    onChange={(e) => setMaxPages(Number(e.target.value))}
                    className="input-field"
                  >
                    <option value={1}>20</option>
                    <option value={2}>40</option>
                    <option value={3}>60</option>
                    <option value={5}>100</option>
                    <option value={10}>200</option>
                  </select>
                </FieldStacked>
                <div className="flex items-end">
                  <button
                    onClick={runSearch}
                    disabled={busy || !query.trim()}
                    className="btn-primary px-5 py-2 text-sm w-full md:w-auto h-[34px]"
                  >
                    {busy ? 'Buscando…' : 'Buscar'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-[var(--line)] pt-3">
                <InstancePicker
                  instances={instances}
                  value={selectedInstance}
                  onChange={setSelectedInstance}
                />
                {searchMsg && (
                  <p className="text-xs text-[var(--text-muted)] font-mono">{searchMsg}</p>
                )}
              </div>
            </div>

            {prospects.length > 0 && (
              <ul className="space-y-1.5 mt-4">
                {prospects.map((p) => {
                  const st = sending[p.telefone];
                  return (
                    <li
                      key={p.telefone}
                      className="surface px-4 py-3 flex items-center justify-between gap-4 hover:border-[var(--line-strong)] transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate text-sm">{p.nomeEmpresa}</div>
                        <div className="text-[11px] text-[var(--text-muted)] flex flex-wrap gap-x-3 gap-y-1 mt-1 items-center">
                          <span className="num text-[var(--text-dim)]">{formatPhone(p.telefone)}</span>
                          {p.rating !== undefined && (
                            <span className="num">
                              ★ {p.rating.toFixed(1)}{' '}
                              <span className="text-[var(--text-faint)]">({p.reviews ?? 0})</span>
                            </span>
                          )}
                          {p.especialidades && <span className="truncate max-w-[240px]">{p.especialidades}</span>}
                          <span className="chip chip--success">wa</span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {p.jaEnviado ? (
                          <span className="text-xs text-[var(--success)] font-mono">✓ enviado</span>
                        ) : (
                          <button
                            onClick={() => dispatchProspect(p)}
                            disabled={st === 'loading' || !selectedInstance}
                            className="btn-primary px-3 py-1.5 text-xs"
                          >
                            {st === 'loading' ? 'Enviando…' : st === 'ok' ? 'Enviado' : 'Disparar'}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </PageShell>
        )}

        {tab === 'leads' && (
          <PageShell
            title="Oportunidades"
            subtitle="Base completa. Importe via CSV, crie manualmente ou adicione via busca."
            actions={
              <>
                <label className="cursor-pointer btn-ghost px-3 py-2 text-sm">
                  {busy ? 'Enviando…' : 'Importar CSV'}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    disabled={busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadCsv(f);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={() => {
                    setModalErr(null);
                    setModal({ mode: 'create' });
                  }}
                  className="btn-primary px-3 py-2 text-sm"
                >
                  + Novo lead
                </button>
              </>
            }
          >
            <div className="flex items-center gap-6 text-xs text-[var(--text-muted)] mb-4">
              <StatMini label="pendentes" value={pendingCount} accent />
              <StatMini label="enviados" value={sentCount} />
              <StatMini label="total" value={leads.length} muted />
            </div>

            <div className="surface px-4 py-3 flex items-center justify-between gap-4 flex-wrap mb-3">
              <div className="flex items-center gap-6 flex-wrap">
                <InstancePicker
                  instances={instances}
                  value={selectedInstance}
                  onChange={setSelectedInstance}
                />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)] font-mono">
                    Delay
                  </span>
                  <input
                    type="number"
                    min={15}
                    value={minDelay}
                    onChange={(e) => setMinDelay(Number(e.target.value) || 15)}
                    className="input-field !w-14 py-1 text-xs num"
                  />
                  <span className="text-[var(--text-faint)]">–</span>
                  <input
                    type="number"
                    min={15}
                    value={maxDelay}
                    onChange={(e) => setMaxDelay(Number(e.target.value) || 90)}
                    className="input-field !w-14 py-1 text-xs num"
                  />
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">s</span>
                </div>
              </div>
              <button
                onClick={selectAllPending}
                disabled={pendingCount === 0}
                className="btn-ghost px-3 py-1.5 text-xs flex items-center gap-2"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Selecionar pendentes
              </button>
            </div>

            {selected.size > 0 && !bulk && (
              <div className="rounded-md px-4 py-3 flex items-center justify-between gap-3 flex-wrap mb-3 bg-[var(--accent-soft)] border border-[var(--accent-ring)]">
                <div className="flex items-center gap-3 text-sm">
                  <span className="num text-[var(--accent)] font-semibold">{selected.size}</span>
                  <span>selecionado{selected.size > 1 ? 's' : ''}</span>
                  <button onClick={clearSelection} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">
                    limpar
                  </button>
                </div>
                <button onClick={bulkDispatch} className="btn-primary px-4 py-1.5 text-xs">
                  Disparar selecionados →
                </button>
              </div>
            )}

            {bulk && (
              <div className="surface px-4 py-3 mb-3 border-[var(--accent-ring)]">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-sm">
                      Disparando{' '}
                      <span className="num text-[var(--accent)]">
                        {bulk.done + bulk.fail}/{bulk.total}
                      </span>
                      {bulk.current && <span className="text-[var(--text-muted)]"> · {bulk.current}</span>}
                    </div>
                    <div className="text-[11px] font-mono text-[var(--text-muted)] mt-0.5">
                      ✓ {bulk.done} · ✕ {bulk.fail}
                    </div>
                  </div>
                  <button
                    onClick={() => { stopRef.current = true; }}
                    className="btn-ghost px-3 py-1 text-xs hover:text-[var(--danger)]"
                  >
                    Parar
                  </button>
                </div>
                <div className="h-0.5 bg-[var(--bg)] rounded-full overflow-hidden mt-3">
                  <div
                    className="h-full bg-[var(--accent)] transition-all duration-300"
                    style={{ width: `${((bulk.done + bulk.fail) / bulk.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {importMsg && <p className="text-xs text-[var(--text-dim)] font-mono mb-3">{importMsg}</p>}

            <div className="flex items-center gap-1 mb-3">
              <button
                onClick={() => setOppView('list')}
                className={`px-3 py-1.5 text-xs rounded-md border ${
                  oppView === 'list'
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent)]'
                    : 'border-[var(--line)] text-[var(--text-muted)]'
                }`}
              >
                Lista
              </button>
              <button
                onClick={() => setOppView('kanban')}
                className={`px-3 py-1.5 text-xs rounded-md border ${
                  oppView === 'kanban'
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent)]'
                    : 'border-[var(--line)] text-[var(--text-muted)]'
                }`}
              >
                Kanban
              </button>
            </div>

            {leads.length === 0 ? (
              <EmptyState
                title="Nenhuma oportunidade ainda"
                body="Importe um CSV, busque no Maps ou insira manualmente."
              />
            ) : oppView === 'kanban' ? (
              <PipelineView
                leads={leads}
                onLeadMoved={(leadId, stageId) =>
                  setLeads((arr) => arr.map((l) => (l.id === leadId ? { ...l, stageId } : l)))
                }
                onLeadClick={(lead) => {
                  setModalErr(null);
                  setModal({ mode: 'edit', lead });
                }}
                onLeadsChanged={() => void loadLeads()}
              />
            ) : (
              <div className="surface overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--bg-soft)] text-xs text-[var(--muted)] uppercase tracking-wider">
                    <tr>
                      <th className="w-8 px-2"></th>
                      <th className="text-left px-3 py-2">Empresa</th>
                      <th className="text-left px-3 py-2">Contato</th>
                      <th className="text-left px-3 py-2">Telefone</th>
                      <th className="text-left px-3 py-2">Etapa</th>
                      <th className="text-left px-3 py-2">Score</th>
                      <th className="text-left px-3 py-2">Msgs</th>
                      <th className="text-left px-3 py-2">Última interação</th>
                      <th className="text-right px-3 py-2 w-32">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((l) => {
                      const st = sending[l.id];
                      const enviado = l.disparo === 'sim';
                      const isSelected = selected.has(l.id);
                      const empresaNome = l.company?.nome ?? l.empresa ?? '—';
                      const contatoNome = l.contact
                        ? [l.contact.firstName, l.contact.lastName].filter(Boolean).join(' ')
                        : l.firstName ?? '';
                      const phone = l.contact?.phone ?? l.telefone;
                      const stageNome = l.stage?.nome ?? '—';
                      const score = l.interestScore ?? 0;
                      const band = l.interestBand ?? 'cold';
                      const bandColor =
                        band === 'interested'
                          ? '#10b981'
                          : band === 'hot'
                            ? '#ef4444'
                            : band === 'warm'
                              ? '#f59e0b'
                              : '#94a3b8';
                      return (
                        <tr
                          key={l.id}
                          className={`border-t border-[var(--line)] hover:bg-[var(--bg-soft)] ${
                            isSelected ? 'bg-[var(--accent-soft)]' : ''
                          }`}
                        >
                          <td className="px-2 align-middle">
                            {!enviado ? (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(l.id)}
                                aria-label="Selecionar"
                              />
                            ) : (
                              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                                <path d="M3 8.5l3.5 3.5L13 5" stroke="var(--success)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {l.company ? (
                              <a
                                href={`/dashboard/companies/${l.company.id}`}
                                className="text-[var(--accent)] hover:underline"
                              >
                                {empresaNome}
                              </a>
                            ) : (
                              <span className="text-[var(--text-muted)]">{empresaNome}</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {l.contact ? (
                              <a
                                href={`/dashboard/contacts/${l.contact.id}`}
                                className="text-[var(--accent)] hover:underline"
                              >
                                {contatoNome || '—'}
                              </a>
                            ) : (
                              <span className="text-[var(--text-muted)]">{contatoNome || '—'}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{formatPhone(phone)}</td>
                          <td className="px-3 py-2 text-xs">{stageNome}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${Math.max(2, score)}%`, backgroundColor: bandColor }}
                                />
                              </div>
                              <span className="text-[10px] font-mono tabular-nums w-6 text-right">{score}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs text-center">{l.messagesOutCount ?? 0}</td>
                          <td className="px-3 py-2 text-xs">
                            {l.lastInteractionAt
                              ? new Date(l.lastInteractionAt).toLocaleDateString('pt-BR')
                              : '—'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setModalErr(null);
                                  setModal({ mode: 'edit', lead: l });
                                }}
                                className="btn-icon w-7 h-7"
                                aria-label="Editar"
                                title="Editar"
                              >
                                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                                  <path d="M11.5 2.5l2 2L5 13l-3 1 1-3 8.5-8.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                              {!enviado && (
                                <button
                                  onClick={() => sendLead(l.id)}
                                  disabled={st === 'loading' || !selectedInstance}
                                  className="btn-primary px-2 py-1 text-[10px]"
                                >
                                  {st === 'loading' ? '…' : 'Disparar'}
                                </button>
                              )}
                              <button
                                onClick={() => deleteLead(l.id)}
                                className="btn-icon w-7 h-7 hover:text-[var(--danger)]"
                                aria-label="Remover"
                                title="Remover"
                              >
                                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                                  <path
                                    d="M3 4h10M6 4V2.5a1 1 0 011-1h2a1 1 0 011 1V4M5 4l.5 9a1 1 0 001 1h3a1 1 0 001-1L11 4"
                                    stroke="currentColor"
                                    strokeWidth="1.3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </PageShell>
        )}

        {tab === 'pipeline' && (
          <PageShell
            title="Pipeline"
            subtitle="Kanban dos leads. Arraste entre etapas. Clique em 'Nova etapa' pra customizar."
            wide
          >
            <PipelineView
              leads={leads}
              onLeadMoved={(leadId, stageId) =>
                setLeads((arr) => arr.map((l) => (l.id === leadId ? { ...l, stageId } : l)))
              }
              onLeadClick={(lead) => {
                setModalErr(null);
                setModal({ mode: 'edit', lead });
              }}
              onLeadsChanged={() => void loadLeads()}
            />
          </PageShell>
        )}

        {tab === 'agente' && (
          <PageShell
            title="Agente"
            subtitle="Como o agente se apresenta, ICP, tom e copy. Quanto mais específico, melhor."
          >
            <div className="surface p-5 space-y-4 max-w-2xl">
              <SectionLabel>Identidade</SectionLabel>
              <FieldStacked label="Nome da empresa">
                <input value={profile.nome_empresa} onChange={(e) => setProfile((p) => ({ ...p, nome_empresa: e.target.value }))} className="input-field" />
              </FieldStacked>
              <FieldStacked label="Como o agente se apresenta" hint="ex: 'aqui é o João da ibusiness'">
                <input value={profile.apresentacao} onChange={(e) => setProfile((p) => ({ ...p, apresentacao: e.target.value }))} className="input-field" />
              </FieldStacked>
              <FieldStacked label="Tom de abordagem" hint="consultivo, direto, informal…">
                <input value={profile.tom_abordagem} onChange={(e) => setProfile((p) => ({ ...p, tom_abordagem: e.target.value }))} className="input-field" />
              </FieldStacked>

              <div className="pt-3 border-t border-[var(--line)] space-y-4">
                <SectionLabel>Negócio</SectionLabel>
                <FieldStacked label="Produtos / serviços">
                  <textarea rows={3} value={profile.produtos_servicos} onChange={(e) => setProfile((p) => ({ ...p, produtos_servicos: e.target.value }))} className="input-field" />
                </FieldStacked>
                <FieldStacked label="ICP (cliente ideal)">
                  <textarea rows={3} value={profile.icp} onChange={(e) => setProfile((p) => ({ ...p, icp: e.target.value }))} className="input-field" />
                </FieldStacked>
                <FieldStacked label="Diferenciais">
                  <textarea rows={3} value={profile.diferenciais} onChange={(e) => setProfile((p) => ({ ...p, diferenciais: e.target.value }))} className="input-field" />
                </FieldStacked>
                <FieldStacked label="Proposta de valor">
                  <textarea rows={3} value={profile.proposta_valor} onChange={(e) => setProfile((p) => ({ ...p, proposta_valor: e.target.value }))} className="input-field" />
                </FieldStacked>
              </div>

              <div className="pt-3 border-t border-[var(--line)] space-y-4">
                <SectionLabel>Cumprimentos (msg 1 do disparo)</SectionLabel>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Até 3 variações. O agente escolhe uma a cada disparo. Use <span className="font-mono text-[var(--text-dim)]">{'{firstName}'}</span> se quiser personalizar com o nome.
                </p>
                <FieldStacked label="Cumprimento 1">
                  <input value={profile.cumprimento_1} onChange={(e) => setProfile((p) => ({ ...p, cumprimento_1: e.target.value }))} className="input-field" placeholder="{firstName}, tudo bem?" />
                </FieldStacked>
                <FieldStacked label="Cumprimento 2">
                  <input value={profile.cumprimento_2} onChange={(e) => setProfile((p) => ({ ...p, cumprimento_2: e.target.value }))} className="input-field" placeholder="Oi {firstName}, posso te roubar 30s?" />
                </FieldStacked>
                <FieldStacked label="Cumprimento 3">
                  <input value={profile.cumprimento_3} onChange={(e) => setProfile((p) => ({ ...p, cumprimento_3: e.target.value }))} className="input-field" placeholder="{firstName}, vi o site de vocês agora" />
                </FieldStacked>
                <FieldStacked label="Mensagem de inspiração (opcional)">
                  <textarea rows={2} value={profile.mensagem_padrao} onChange={(e) => setProfile((p) => ({ ...p, mensagem_padrao: e.target.value }))} className="input-field" />
                </FieldStacked>
              </div>

              <div className="pt-3 border-t border-[var(--line)] space-y-4">
                <SectionLabel>Agente conversacional</SectionLabel>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Quando o lead responder, o agente continua a conversa, manda documentos da KB e notifica você quando perceber interesse claro.
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={profile.agent_enabled}
                    onChange={(e) => setProfile((p) => ({ ...p, agent_enabled: e.target.checked }))}
                  />
                  <span>Ativar agente conversacional</span>
                </label>
                <FieldStacked label="WhatsApp para notificação" hint="seu número pessoal — recebe alerta quando lead se interessa">
                  <input
                    value={profile.notification_phone}
                    onChange={(e) => setProfile((p) => ({ ...p, notification_phone: e.target.value }))}
                    className="input-field num"
                    placeholder="11 98888-7777"
                  />
                </FieldStacked>
                <FieldStacked label="Persona do agente" hint="tom, limites, estilo. Default: usa o tom geral acima.">
                  <textarea
                    rows={3}
                    value={profile.agent_persona}
                    onChange={(e) => setProfile((p) => ({ ...p, agent_persona: e.target.value }))}
                    className="input-field"
                    placeholder="Você é o consultor da ibusiness, tom direto, sem prometer prazo, escala dúvida fora da KB."
                  />
                </FieldStacked>
              </div>

              <div className="pt-3 border-t border-[var(--line)]">
                <SectionLabel>Knowledge base</SectionLabel>
                <p className="text-[11px] text-[var(--text-muted)] mb-3">
                  Documentos e materiais que o agente conhece. Marcados como enviáveis viram tool de envio via WhatsApp.
                </p>
                <KnowledgeManager />
              </div>

              <div className="pt-3 border-t border-[var(--line)] flex justify-end">
                <button onClick={saveProfile} disabled={busy} className="btn-primary px-5 py-2 text-sm">
                  {busy ? 'Salvando…' : 'Salvar agente'}
                </button>
              </div>
            </div>
          </PageShell>
        )}

        {tab === 'whatsapp' && (
          <PageShell
            title="WhatsApp"
            subtitle="Conexões ativas. Um número por instância. A sessão fica salva, não precisa reescanear."
            actions={
              <button onClick={addInstance} disabled={busy} className="btn-primary px-3 py-2 text-sm">
                + Conectar novo
              </button>
            }
          >
            {instances.length === 0 ? (
              <EmptyState
                title="Nenhuma conta conectada"
                body='Clique em "Conectar novo" pra escanear o QR e começar a disparar.'
              />
            ) : (
              <ul className="grid md:grid-cols-2 gap-2">
                {instances.map((i) => {
                  const ok = i.status === 'connected';
                  return (
                    <li key={i.id} className="surface p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">{i.label ?? 'Sem nome'}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`inline-block h-1.5 w-1.5 rounded-full ${
                                ok ? 'bg-[var(--success)]' : 'bg-[var(--warn)] pulse-dot'
                              }`}
                            />
                            <span className="text-[11px] font-mono text-[var(--text-muted)] tracking-wide">
                              {i.status}
                            </span>
                          </div>
                        </div>
                        <span className="chip chip--muted">#{i.id.slice(0, 6)}</span>
                      </div>
                      <div className="flex gap-1.5 mt-3">
                        {!ok && (
                          <button onClick={() => connect(i.id)} className="btn-ghost px-2.5 py-1 text-xs">
                            QR
                          </button>
                        )}
                        <button onClick={() => checkStatus(i.id)} className="btn-ghost px-2.5 py-1 text-xs">
                          Atualizar
                        </button>
                        <button
                          onClick={() => remove(i.id)}
                          className="btn-ghost px-2.5 py-1 text-xs hover:text-[var(--danger)]"
                        >
                          Remover
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

          </PageShell>
        )}

        {tab === 'integracoes' && (
          <PageShell
            title="Integrações"
            subtitle="Chaves de API. Ficam criptografadas no banco e nunca são enviadas ao navegador."
          >
            <div className="surface p-5 space-y-4 max-w-2xl">
              <FieldStacked label="OpenAI API key" hint="usada pra gerar as mensagens personalizadas">
                <input
                  type="password"
                  value={profile.openai_api_key}
                  onChange={(e) => setProfile((p) => ({ ...p, openai_api_key: e.target.value }))}
                  className="input-field font-mono text-xs"
                  placeholder="sk-…"
                />
              </FieldStacked>
              <FieldStacked label="SearchAPI key" hint="searchapi.io — Google Maps scraping">
                <input
                  type="password"
                  value={profile.serpapi_key}
                  onChange={(e) => setProfile((p) => ({ ...p, serpapi_key: e.target.value }))}
                  className="input-field font-mono text-xs"
                />
              </FieldStacked>

              <div className="pt-3 border-t border-[var(--line)] flex justify-end">
                <button onClick={saveProfile} disabled={busy} className="btn-primary px-5 py-2 text-sm">
                  {busy ? 'Salvando…' : 'Salvar chaves'}
                </button>
              </div>
            </div>
          </PageShell>
        )}
      </div>

      {qr && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setQr(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr.qrcode}
              alt="QR Code"
              className="w-[340px] h-[340px] [image-rendering:pixelated]"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body,
        )}

      {modal.mode !== 'closed' && (
        <LeadModal
          key={modal.mode === 'edit' ? modal.lead.id : 'new'}
          initial={
            modal.mode === 'edit'
              ? {
                  firstName: modal.lead.firstName ?? '',
                  empresa: modal.lead.empresa ?? '',
                  telefone: modal.lead.telefone ?? '',
                  site: modal.lead.site ?? '',
                  contexto: modal.lead.contexto ?? '',
                }
              : { firstName: '', empresa: '', telefone: '', site: '', contexto: '' }
          }
          analysis={modal.mode === 'edit' ? modal.lead.siteAnalysis ?? null : null}
          lead={modal.mode === 'edit' ? modal.lead : null}
          leadId={modal.mode === 'edit' ? modal.lead.id : null}
          title={modal.mode === 'edit' ? 'Editar lead' : 'Novo lead'}
          cta={modal.mode === 'edit' ? 'Salvar' : 'Criar lead'}
          error={modalErr}
          onClose={() => setModal({ mode: 'closed' })}
          onSave={saveLeadForm}
          onAction={loadLeads}
        />
      )}
    </>
  );
}

// ── Layout primitives ─────────────────────────────────────────

function PageShell({
  title,
  subtitle,
  actions,
  children,
  wide,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`${wide ? 'max-w-none' : 'max-w-[1400px]'} mx-auto px-8 py-8 rise`}>
      <header className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-[var(--text-muted)] mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

function NavItem({
  active,
  onClick,
  label,
  icon,
  badge,
  indicator,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  indicator?: 'on' | 'off';
}) {
  return (
    <button onClick={onClick} className={`nav-item w-full ${active ? 'active' : ''}`}>
      <span className="nav-icon">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {indicator && (
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            indicator === 'on' ? 'bg-[var(--success)]' : 'bg-[var(--text-faint)]'
          }`}
        />
      )}
      {badge && (
        <span className="chip chip--accent !py-0">{badge}</span>
      )}
    </button>
  );
}

function NavLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <a href={href} className="nav-item w-full">
      <span className="nav-icon">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
    </a>
  );
}

function FieldStacked({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[11px] uppercase tracking-[0.1em] font-mono text-[var(--text-muted)]">
          {label}
        </span>
        {hint && <span className="text-[10px] text-[var(--text-faint)]">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-[0.15em] font-mono text-[var(--text-faint)]">
      {children}
    </div>
  );
}

function StatMini({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: number;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className={`num text-sm font-semibold ${
          accent ? 'text-[var(--accent)]' : muted ? 'text-[var(--text-muted)]' : 'text-[var(--text)]'
        }`}
      >
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-[0.1em] font-mono text-[var(--text-muted)]">
        {label}
      </span>
    </div>
  );
}

function InstancePicker({
  instances,
  value,
  onChange,
}: {
  instances: Instance[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)] font-mono">
        Instância
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field py-1 !w-auto text-xs"
      >
        {instances.length === 0 && <option value="">Nenhuma</option>}
        {instances.map((i) => (
          <option key={i.id} value={i.id}>
            {i.label ?? 'Sem nome'} · {i.status}
          </option>
        ))}
      </select>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-dashed border-[var(--line)] rounded-[var(--radius)] px-6 py-12 text-center">
      <p className="text-base font-medium text-[var(--text-dim)]">{title}</p>
      <p className="text-sm text-[var(--text-muted)] mt-1.5 max-w-sm mx-auto">{body}</p>
    </div>
  );
}


// ── Icons ─────────────────────────────────────────────────────

function IconTarget() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
    </svg>
  );
}

function IconList() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 1.5l1.5 4.5L14 7.5l-4.5 1.5L8 13.5 6.5 9 2 7.5 6.5 6 8 1.5z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="4" y="1.5" width="8" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 12.5h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconBoard() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.75" y="2.5" width="3.5" height="11" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="6.25" y="2.5" width="3.5" height="7" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="10.75" y="2.5" width="3.5" height="9" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function IconKey() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="5" cy="10" r="3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7.2 8.5L14 4M11 5.5L12.5 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

// ── Modal ─────────────────────────────────────────────────────

function LeadModal({
  initial,
  analysis,
  lead,
  leadId,
  title,
  cta,
  error,
  onClose,
  onSave,
  onAction,
}: {
  initial: LeadFormValues;
  analysis?: SiteAnalysis | null;
  lead?: Lead | null;
  leadId?: string | null;
  title: string;
  cta: string;
  error: string | null;
  onClose: () => void;
  onSave: (values: LeadFormValues) => Promise<void>;
  onAction?: () => void;
}) {
  const [form, setForm] = useState<LeadFormValues>(initial);
  const [savedForm, setSavedForm] = useState<LeadFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [tab, setTab] = useState<'edit' | 'conv'>('edit');
  const [localLead, setLocalLead] = useState<Lead | null>(lead ?? null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm);

  const band = localLead?.interestBand ?? 'cold';
  const score = localLead?.interestScore ?? 0;
  const bandColors: Record<string, string> = {
    cold: '#94a3b8',
    warm: '#f59e0b',
    hot: '#ef4444',
    interested: '#10b981',
  };

  async function callLeadAction(action: string) {
    if (!leadId || busyAction) return;
    setBusyAction(action);
    try {
      let res: Response;
      if (action === 'qualify' || action === 'discard') {
        res = await fetch(`/api/leads/${leadId}/qualify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
      } else if (action === 'pause') {
        res = await fetch(`/api/followup/lead/${leadId}/pause`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
      } else if (action === 'recompute') {
        res = await fetch(`/api/leads/${leadId}/score`, { method: 'POST' });
      } else {
        return;
      }
      const data = await res.json();
      if (data?.lead) setLocalLead({ ...(localLead ?? {} as Lead), ...data.lead });
      if (action === 'pause' && typeof data?.followupManuallyPaused === 'boolean' && localLead) {
        setLocalLead({ ...localLead, followupManuallyPaused: data.followupManuallyPaused });
      }
      onAction?.();
    } finally {
      setBusyAction(null);
    }
  }

  const set = <K extends keyof LeadFormValues>(k: K, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  function tryClose() {
    if (dirty) setConfirmClose(true);
    else onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-6"
      onClick={tryClose}
    >
      <div className="w-full max-w-lg surface p-6 space-y-4 rise" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            onClick={tryClose}
            className="btn-icon w-7 h-7"
            aria-label="Fechar"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {leadId && localLead && (
          <div className="space-y-3 -mt-2">
            {localLead.isDraft && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 space-y-2">
                <div className="text-xs text-amber-800 font-medium">Lead em triagem — qualifique ou descarte.</div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => callLeadAction('qualify')}
                    className="btn-primary px-3 py-1.5 text-xs"
                  >
                    {busyAction === 'qualify' ? '…' : 'Qualificar'}
                  </button>
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => callLeadAction('discard')}
                    className="btn-ghost px-3 py-1.5 text-xs"
                  >
                    {busyAction === 'discard' ? '…' : 'Descartar'}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Interesse — {band}</span>
                  <span className="text-xs font-mono tabular-nums">{score}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(2, score)}%`, backgroundColor: bandColors[band] }}
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => callLeadAction('recompute')}
                className="btn-ghost px-2 py-1 text-[11px]"
                title="Recalcular score"
              >
                {busyAction === 'recompute' ? '…' : 'recalc'}
              </button>
            </div>

            {!localLead.isDraft && (
              <div className="flex items-center justify-between text-[11px] text-[var(--muted)] gap-3">
                <span>Follow-ups: {localLead.followupCount ?? 0}</span>
                {localLead.nextFollowupAt && (
                  <span>próximo: {new Date(localLead.nextFollowupAt).toLocaleString('pt-BR')}</span>
                )}
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => callLeadAction('pause')}
                  className="btn-ghost px-2 py-1 text-[11px]"
                >
                  {busyAction === 'pause'
                    ? '…'
                    : localLead.followupManuallyPaused
                      ? 'retomar'
                      : 'pausar'}
                </button>
              </div>
            )}

            {Array.isArray(localLead.interestSignals) && localLead.interestSignals.length > 0 && (
              <details className="text-[11px] text-[var(--muted)]">
                <summary className="cursor-pointer">Últimos sinais ({localLead.interestSignals.length})</summary>
                <ul className="mt-1.5 space-y-0.5 pl-3">
                  {localLead.interestSignals.slice(-5).map((s, i) => (
                    <li key={i}>
                      <span className="font-mono">{s.weight > 0 ? '+' : ''}{s.weight}</span>{' '}
                      <span className="font-medium">{s.type}</span> — {s.excerpt.slice(0, 60)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {leadId && (
          <div className="flex gap-1 border-b border-[var(--line)] -mt-2">
            <button
              type="button"
              className={`px-3 py-1.5 text-sm border-b-2 -mb-px ${tab === 'edit' ? 'border-[var(--accent)] text-[var(--text)]' : 'border-transparent text-[var(--muted)]'}`}
              onClick={() => setTab('edit')}
            >
              Editar
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-sm border-b-2 -mb-px ${tab === 'conv' ? 'border-[var(--accent)] text-[var(--text)]' : 'border-transparent text-[var(--muted)]'}`}
              onClick={() => setTab('conv')}
            >
              Conversa
            </button>
          </div>
        )}

        {leadId && tab === 'conv' ? (
          <LeadConversation leadId={leadId} />
        ) : (
        <>
        <FieldStacked label="Primeiro nome" hint="variável {firstName} na copy">
          <input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} className="input-field" />
        </FieldStacked>
        <FieldStacked label="Empresa">
          <input value={form.empresa} onChange={(e) => set('empresa', e.target.value)} className="input-field" />
        </FieldStacked>
        <FieldStacked label="WhatsApp" hint="sem + vira Brasil (+55). Com + respeita o país">
          <input value={form.telefone} onChange={(e) => set('telefone', e.target.value)} className="input-field num" placeholder="11 98888-7777 ou +1 415 555 1234" />
        </FieldStacked>
        <FieldStacked label="Site" hint="IA extrai o texto da home pra personalizar">
          <input value={form.site} onChange={(e) => set('site', e.target.value)} className="input-field" />
        </FieldStacked>
        <FieldStacked label="Contexto" hint="o que você sabe — dor, oportunidade, referência">
          <textarea rows={3} value={form.contexto} onChange={(e) => set('contexto', e.target.value)} className="input-field" />
        </FieldStacked>

        {analysis && (
          <div className="border border-[var(--line)] rounded-md">
            <button
              type="button"
              onClick={() => setShowAnalysis((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-[var(--bg-soft)]"
            >
              <span>Análise IA do site</span>
              <span className="text-xs text-[var(--muted)]">
                {showAnalysis ? 'ocultar' : 'mostrar'} · conf {Math.round((analysis.confianca ?? 0) * 100)}%
              </span>
            </button>
            {showAnalysis && (
              <div className="px-3 pb-3 pt-1 space-y-2 text-xs text-[var(--text)]">
                {analysis.tipoNegocio && (
                  <div><span className="text-[var(--muted)]">Tipo: </span>{analysis.tipoNegocio}</div>
                )}
                {analysis.segmento && (
                  <div><span className="text-[var(--muted)]">Segmento: </span>{analysis.segmento}</div>
                )}
                {analysis.tomMarca && (
                  <div><span className="text-[var(--muted)]">Tom da marca: </span>{analysis.tomMarca}</div>
                )}
                {analysis.publicoAlvo && (
                  <div><span className="text-[var(--muted)]">Público: </span>{analysis.publicoAlvo}</div>
                )}
                {analysis.ganchoEspecifico && (
                  <div className="pt-1 border-t border-[var(--line)]">
                    <div className="text-[var(--muted)] mb-0.5">Gancho:</div>
                    <div>{analysis.ganchoEspecifico}</div>
                  </div>
                )}
                {analysis.ofertas?.length > 0 && (
                  <div>
                    <div className="text-[var(--muted)] mb-0.5">Ofertas:</div>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {analysis.ofertas.map((o, i) => <li key={i}>{o}</li>)}
                    </ul>
                  </div>
                )}
                {analysis.doresAparentes?.length > 0 && (
                  <div>
                    <div className="text-[var(--muted)] mb-0.5">Dores aparentes:</div>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {analysis.doresAparentes.map((o, i) => <li key={i}>{o}</li>)}
                    </ul>
                  </div>
                )}
                {analysis.provaSocial?.length > 0 && (
                  <div>
                    <div className="text-[var(--muted)] mb-0.5">Prova social:</div>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {analysis.provaSocial.map((o, i) => <li key={i}>{o}</li>)}
                    </ul>
                  </div>
                )}
                {analysis.pessoasMencionadas?.length > 0 && (
                  <div>
                    <div className="text-[var(--muted)] mb-0.5">Pessoas:</div>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {analysis.pessoasMencionadas.map((p, i) => (
                        <li key={i}>{p.nome}{p.cargo ? ` — ${p.cargo}` : ''}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-[var(--danger)] border-l-2 border-[var(--danger)] pl-3">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
          <button onClick={tryClose} className="btn-ghost px-4 py-2 text-sm">
            Cancelar
          </button>
          <button
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(form);
                setSavedForm(form);
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving || !dirty}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
          >
            {saving ? 'Salvando…' : cta}
          </button>
        </div>
        </>
        )}
      </div>

      {confirmClose && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-6"
          onClick={() => setConfirmClose(false)}
        >
          <div
            className="w-full max-w-sm rounded-md bg-white border border-[var(--line)] p-5 space-y-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">Edições não salvas</h3>
            <p className="text-sm text-[var(--muted)]">
              Você tem alterações pendentes nesta oportunidade.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setConfirmClose(false)} className="btn-ghost px-3 py-1.5 text-sm">
                Cancelar
              </button>
              <button
                onClick={() => {
                  setConfirmClose(false);
                  onClose();
                }}
                className="btn-ghost px-3 py-1.5 text-sm text-[var(--danger)]"
              >
                Descartar
              </button>
              <button
                onClick={async () => {
                  setSaving(true);
                  try {
                    await onSave(form);
                    setSavedForm(form);
                    setConfirmClose(false);
                    onClose();
                  } finally {
                    setSaving(false);
                  }
                }}
                className="btn-primary px-3 py-1.5 text-sm"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type ConversationMessage = {
  id: string;
  direction: string;
  body: string;
  mediaUrl: string | null;
  mediaType: string | null;
  toolCalled: string | null;
  createdAt: string;
};

function LeadConversation({ leadId }: { leadId: string }) {
  const [msgs, setMsgs] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/leads/${leadId}/messages`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && d.success) setMsgs(d.messages);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [leadId]);

  if (loading) return <p className="text-sm text-[var(--muted)] py-4">Carregando…</p>;
  if (msgs.length === 0) return <p className="text-sm text-[var(--muted)] py-4">Nenhuma mensagem ainda.</p>;

  return (
    <div className="space-y-2 max-h-[60vh] overflow-y-auto py-2 pr-1">
      {msgs.map((m) => {
        const out = m.direction === 'out';
        return (
          <div key={m.id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${out ? 'bg-[var(--accent-soft)] text-[var(--text)]' : 'bg-[var(--bg-soft)]'}`}>
              {m.mediaUrl && (
                <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="block text-xs underline mb-1 break-all">
                  📎 {m.mediaType ?? 'arquivo'}
                </a>
              )}
              <div className="whitespace-pre-wrap">{m.body}</div>
              <div className="text-[10px] text-[var(--muted)] mt-1 flex gap-2">
                <span>{new Date(m.createdAt).toLocaleString('pt-BR')}</span>
                {m.toolCalled && <span>· {m.toolCalled}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type KnowledgeDocItem = {
  id: string;
  titulo: string;
  descricao: string | null;
  conteudoTexto: string | null;
  fileUrl: string | null;
  fileType: string | null;
  sendable: boolean;
};

function KnowledgeManager() {
  const [docs, setDocs] = useState<KnowledgeDocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ titulo: '', descricao: '', conteudoTexto: '', fileUrl: '', fileType: '', sendable: true });

  useEffect(() => {
    fetch('/api/knowledge')
      .then((r) => r.json())
      .then((d) => { if (d.success) setDocs(d.docs); })
      .finally(() => setLoading(false));
  }, []);

  async function add() {
    if (!draft.titulo.trim()) return;
    setAdding(true);
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const d = await res.json();
      if (d.success) {
        setDocs((arr) => [...arr, d.doc]);
        setDraft({ titulo: '', descricao: '', conteudoTexto: '', fileUrl: '', fileType: '', sendable: true });
      } else {
        alert(d.error ?? 'Erro');
      }
    } finally {
      setAdding(false);
    }
  }

  async function patch(id: string, body: Partial<KnowledgeDocItem>) {
    const res = await fetch(`/api/knowledge/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (d.success) setDocs((arr) => arr.map((x) => (x.id === id ? d.doc : x)));
  }

  async function remove(id: string) {
    if (!confirm('Remover documento?')) return;
    const res = await fetch(`/api/knowledge/${id}`, { method: 'DELETE' });
    const d = await res.json();
    if (d.success) setDocs((arr) => arr.filter((x) => x.id !== id));
  }

  if (loading) return <p className="text-xs text-[var(--muted)]">Carregando…</p>;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {docs.length === 0 && (
          <p className="text-xs text-[var(--muted)]">Nenhum documento ainda. Cadastre o primeiro abaixo.</p>
        )}
        {docs.map((d) => (
          <div key={d.id} className="border border-[var(--line)] rounded-md p-3 space-y-1">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{d.titulo}</div>
                {d.descricao && <div className="text-xs text-[var(--muted)]">{d.descricao}</div>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label className="text-xs flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={d.sendable}
                    onChange={(e) => patch(d.id, { sendable: e.target.checked })}
                  />
                  enviável
                </label>
                <button onClick={() => remove(d.id)} className="text-xs text-[var(--danger)]">remover</button>
              </div>
            </div>
            {d.fileUrl && (
              <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-xs underline break-all">
                📎 {d.fileType ?? 'arquivo'}
              </a>
            )}
            {d.conteudoTexto && (
              <div className="text-xs text-[var(--text)] whitespace-pre-wrap line-clamp-3">{d.conteudoTexto}</div>
            )}
          </div>
        ))}
      </div>

      <div className="border border-dashed border-[var(--line)] rounded-md p-3 space-y-2">
        <div className="text-xs font-medium text-[var(--muted)]">Novo documento</div>
        <input
          value={draft.titulo}
          onChange={(e) => setDraft((d) => ({ ...d, titulo: e.target.value }))}
          placeholder="Título (ex: Apresentação institucional)"
          className="input-field text-sm"
        />
        <input
          value={draft.descricao}
          onChange={(e) => setDraft((d) => ({ ...d, descricao: e.target.value }))}
          placeholder="Descrição curta"
          className="input-field text-sm"
        />
        <textarea
          rows={3}
          value={draft.conteudoTexto}
          onChange={(e) => setDraft((d) => ({ ...d, conteudoTexto: e.target.value }))}
          placeholder="Conteúdo em texto que o agente pode citar (opcional)"
          className="input-field text-sm"
        />
        <div className="flex gap-2">
          <input
            value={draft.fileUrl}
            onChange={(e) => setDraft((d) => ({ ...d, fileUrl: e.target.value }))}
            placeholder="URL pública do arquivo (PDF/imagem)"
            className="input-field text-sm flex-1"
          />
          <select
            value={draft.fileType}
            onChange={(e) => setDraft((d) => ({ ...d, fileType: e.target.value }))}
            className="input-field text-sm w-32"
          >
            <option value="">tipo</option>
            <option value="document">document</option>
            <option value="image">image</option>
            <option value="video">video</option>
            <option value="audio">audio</option>
          </select>
        </div>
        <div className="flex items-center justify-between">
          <label className="text-xs flex items-center gap-1">
            <input
              type="checkbox"
              checked={draft.sendable}
              onChange={(e) => setDraft((d) => ({ ...d, sendable: e.target.checked }))}
            />
            enviável via WhatsApp
          </label>
          <button onClick={add} disabled={adding || !draft.titulo.trim()} className="btn-primary px-3 py-1.5 text-xs">
            {adding ? 'Salvando…' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  );
}
