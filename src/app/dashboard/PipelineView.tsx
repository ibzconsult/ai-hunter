'use client';

import { useEffect, useState } from 'react';

type Stage = {
  id: string;
  nome: string;
  ordem: number;
  tipo: string;
};

type Pipeline = {
  id: string;
  nome: string;
  isDefault: boolean;
  stages: Stage[];
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
  stageId: string | null;
  respondeu: boolean;
  classificacao: string | null;
  ultimaMensagem: string | null;
  ultimaResposta: string | null;
  siteAnalysis: SiteAnalysis | null;
  createdAt: string;
  isDraft?: boolean;
  interestScore?: number;
  interestBand?: 'cold' | 'warm' | 'hot' | 'interested';
  followupCount?: number;
  nextFollowupAt?: string | null;
  lastInteractionAt?: string | null;
  followupManuallyPaused?: boolean;
  interested?: boolean;
  tags?: LeadTag[];
};

type Props = {
  leads: Lead[];
  onLeadMoved: (leadId: string, stageId: string | null) => void;
  onLeadClick: (lead: Lead) => void;
  onLeadsChanged: () => void;
};

export default function PipelineView({ leads, onLeadMoved, onLeadClick, onLeadsChanged }: Props) {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [draggingLead, setDraggingLead] = useState<string | null>(null);
  const [hoverStage, setHoverStage] = useState<string | null>(null);
  const [editingStage, setEditingStage] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/pipelines');
    const data = await res.json();
    if (data.success) {
      setPipeline(data.pipelines[0] ?? null);
      // backfill pode ter assinado leads à primeira etapa — recarrega
      onLeadsChanged();
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addStage() {
    if (!pipeline) return;
    const res = await fetch(`/api/pipelines/${pipeline.id}/stages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: 'Nova etapa' }),
    });
    const data = await res.json();
    if (data.success) {
      setPipeline({ ...pipeline, stages: [...pipeline.stages, data.stage] });
      setEditingStage(data.stage.id);
    }
  }

  async function renameStage(id: string, nome: string) {
    if (!pipeline) return;
    setPipeline({ ...pipeline, stages: pipeline.stages.map((s) => (s.id === id ? { ...s, nome } : s)) });
    await fetch(`/api/stages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome }),
    });
  }

  async function deleteStage(id: string) {
    if (!pipeline) return;
    if (!confirm('Remover etapa? Os leads ficarão sem etapa.')) return;
    const res = await fetch(`/api/stages/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      setPipeline({ ...pipeline, stages: pipeline.stages.filter((s) => s.id !== id) });
    } else alert(data.error);
  }

  async function moveLead(leadId: string, stageId: string) {
    onLeadMoved(leadId, stageId);
    await fetch(`/api/leads/${leadId}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stageId }),
    });
  }

  if (!pipeline) {
    return <p className="text-sm text-[var(--text-muted)]">Carregando pipeline…</p>;
  }

  const leadsByStage = new Map<string | null, Lead[]>();
  for (const l of leads) {
    const key = l.stageId;
    if (!leadsByStage.has(key)) leadsByStage.set(key, []);
    leadsByStage.get(key)!.push(l);
  }

  return (
    <div className="scroll-x -mx-8 px-8 pb-3">
      <div className="flex gap-4 min-w-max pb-4">
        {pipeline.stages.map((stage) => {
          const stageLeads = leadsByStage.get(stage.id) ?? [];
          const isHover = hoverStage === stage.id;
          return (
            <div
              key={stage.id}
              className={`w-[300px] shrink-0 rounded-[var(--radius)] transition-all ${
                isHover
                  ? 'bg-[var(--accent-soft)] ring-2 ring-[var(--accent-border)] ring-offset-0'
                  : 'bg-[var(--bg-column)]'
              }`}
              onDragOver={(e) => {
                if (draggingLead) {
                  e.preventDefault();
                  setHoverStage(stage.id);
                }
              }}
              onDragLeave={() => setHoverStage(null)}
              onDrop={(e) => {
                e.preventDefault();
                setHoverStage(null);
                if (draggingLead) void moveLead(draggingLead, stage.id);
                setDraggingLead(null);
              }}
            >
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {editingStage === stage.id ? (
                    <input
                      autoFocus
                      defaultValue={stage.nome}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v) void renameStage(stage.id, v);
                        setEditingStage(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const v = (e.target as HTMLInputElement).value.trim();
                          if (v) void renameStage(stage.id, v);
                          setEditingStage(null);
                        }
                        if (e.key === 'Escape') setEditingStage(null);
                      }}
                      className="flex-1 bg-white border border-[var(--line)] rounded px-2 py-1 text-[13px] font-semibold focus:outline-none focus:border-[var(--accent)]"
                    />
                  ) : (
                    <button
                      onClick={() => stage.tipo === 'custom' && setEditingStage(stage.id)}
                      className={`text-[13px] font-semibold truncate text-left tracking-tight ${
                        stage.tipo === 'custom' ? 'hover:text-[var(--accent)] cursor-text' : 'cursor-default'
                      }`}
                      title={stage.tipo === 'custom' ? 'Clique pra renomear' : 'Etapa do sistema'}
                    >
                      {stage.nome}
                    </button>
                  )}
                  <span className="num text-[11px] text-[var(--text-muted)] shrink-0 bg-white border border-[var(--line)] rounded-full px-1.5 py-[1px] min-w-[20px] text-center font-medium">
                    {stageLeads.length}
                  </span>
                </div>
                {stage.tipo === 'custom' && (
                  <button
                    onClick={() => deleteStage(stage.id)}
                    className="btn-icon w-6 h-6 text-[var(--text-faint)] hover:text-[var(--danger)]"
                    title="Remover etapa"
                    aria-label="Remover etapa"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="px-2 pb-2 space-y-2 min-h-[120px] max-h-[calc(100vh-260px)] scroll-y">
                {stageLeads.length === 0 && (
                  <div className="border border-dashed border-[var(--line)] rounded-md py-6 text-center">
                    <p className="text-[11px] text-[var(--text-faint)]">
                      {draggingLead ? 'solte aqui' : 'vazio'}
                    </p>
                  </div>
                )}
                {stageLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onDragStart={() => setDraggingLead(lead.id)}
                    onDragEnd={() => {
                      setDraggingLead(null);
                      setHoverStage(null);
                    }}
                    onClick={() => onLeadClick(lead)}
                  />
                ))}
              </div>
            </div>
          );
        })}
        <button
          onClick={addStage}
          className="w-[300px] shrink-0 rounded-[var(--radius)] border-2 border-dashed border-[var(--line)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] text-sm font-medium text-[var(--text-muted)] hover:text-[var(--accent)] min-h-[120px] flex items-center justify-center gap-2 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Nova etapa
        </button>
      </div>
    </div>
  );
}

const ORIGIN_COLOR: Record<string, string> = {
  inbound: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  outbound: 'bg-blue-100 text-blue-700 border-blue-200',
  manual: 'bg-slate-100 text-slate-700 border-slate-200',
  indication: 'bg-purple-100 text-purple-700 border-purple-200',
};

const BAND_COLOR: Record<string, string> = {
  cold: '#94a3b8',
  warm: '#f59e0b',
  hot: '#ef4444',
  interested: '#10b981',
};

function relativeTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  const diff = Date.now() - d;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h`;
  const dd = Math.round(h / 24);
  return `${dd}d`;
}

function futureLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  const diff = d - Date.now();
  if (diff <= 0) return 'agora';
  const h = Math.round(diff / 3600000);
  if (h < 24) return `em ${h}h`;
  const dd = Math.round(h / 24);
  return `em ${dd}d`;
}

function LeadCard({
  lead,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  lead: Lead;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  const band = lead.interestBand ?? 'cold';
  const score = lead.interestScore ?? 0;
  const originKey = lead.origem ?? 'manual';
  const originClass = ORIGIN_COLOR[originKey] ?? ORIGIN_COLOR.manual;
  const lastRel = relativeTime(lead.lastInteractionAt);
  const nextFwLabel = lead.nextFollowupAt ? futureLabel(lead.nextFollowupAt) : null;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`group rounded-md bg-white border px-3 py-2.5 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-[var(--line-strong)] transition-all ${
        lead.isDraft ? 'border-amber-300' : 'border-[var(--line)]'
      }`}
      style={{ boxShadow: 'var(--shadow-xs)' }}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-[9px] uppercase tracking-wider font-semibold border rounded-full px-1.5 py-[1px] ${originClass}`}>
          {originKey}
        </span>
        {lead.isDraft && (
          <span className="text-[9px] uppercase tracking-wider font-semibold border rounded-full px-1.5 py-[1px] bg-amber-100 text-amber-700 border-amber-300">
            triagem
          </span>
        )}
        {lead.followupManuallyPaused && (
          <span className="text-[9px] uppercase tracking-wider font-semibold border rounded-full px-1.5 py-[1px] bg-slate-200 text-slate-700 border-slate-300">
            pausado
          </span>
        )}
        {lead.tags?.slice(0, 3).map((t) => (
          <span
            key={t.id}
            className="text-[9px] font-medium border rounded-full px-1.5 py-[1px]"
            style={{ color: t.color, borderColor: t.color, backgroundColor: `${t.color}15` }}
          >
            {t.nome}
          </span>
        ))}
      </div>

      <div className="mt-1.5 text-[13px] font-semibold truncate text-[var(--text)] tracking-tight">
        {lead.empresa ?? lead.firstName ?? '—'}
      </div>
      {lead.firstName && lead.empresa && (
        <div className="text-[11px] text-[var(--text-muted)] truncate">{lead.firstName}</div>
      )}
      <div className="text-[11px] font-mono text-[var(--text-muted)] truncate">{lead.telefone}</div>

      {!lead.isDraft && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(2, score)}%`, backgroundColor: BAND_COLOR[band] }}
            />
          </div>
          <span className="text-[10px] font-mono text-[var(--text-muted)] tabular-nums w-6 text-right">
            {score}
          </span>
        </div>
      )}

      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-[var(--text-muted)]">
        <span className="truncate">
          {lead.respondeu ? '💬 ' : '⏳ '}
          {lastRel ? `há ${lastRel}` : 'sem atividade'}
        </span>
        {nextFwLabel && !lead.isDraft && (
          <span className="truncate">
            🔁 {nextFwLabel}
            {lead.followupCount != null ? ` (${lead.followupCount})` : ''}
          </span>
        )}
      </div>
    </div>
  );
}
