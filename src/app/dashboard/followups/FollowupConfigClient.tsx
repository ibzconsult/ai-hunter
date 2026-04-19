'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Step = {
  id?: string;
  order: number;
  delayDays: number;
  type: string;
  customHint: string | null;
  docId: string | null;
};

type Config = {
  id?: string;
  enabled: boolean;
  maxCount: number;
  windowStart: string;
  windowEnd: string;
  activeDays: number[];
  timezone: string;
  pauseOnReplyHours: number;
  instanceId: string | null;
  steps: Step[];
};

const TYPES = [
  { value: 'reminder', label: 'Lembrete' },
  { value: 'content', label: 'Material' },
  { value: 'social_proof', label: 'Prova social' },
  { value: 'proposal', label: 'Proposta' },
  { value: 'objection_break', label: 'Quebra objeção' },
  { value: 'value_add', label: 'Valor' },
  { value: 'breakup', label: 'Break-up' },
];

const DAYS = [
  { n: 0, label: 'Dom' },
  { n: 1, label: 'Seg' },
  { n: 2, label: 'Ter' },
  { n: 3, label: 'Qua' },
  { n: 4, label: 'Qui' },
  { n: 5, label: 'Sex' },
  { n: 6, label: 'Sáb' },
];

const DEFAULT_CONFIG: Config = {
  enabled: false,
  maxCount: 4,
  windowStart: '09:00',
  windowEnd: '18:00',
  activeDays: [1, 2, 3, 4, 5],
  timezone: 'America/Sao_Paulo',
  pauseOnReplyHours: 48,
  instanceId: null,
  steps: [
    { order: 0, delayDays: 2, type: 'reminder', customHint: null, docId: null },
    { order: 1, delayDays: 4, type: 'content', customHint: null, docId: null },
    { order: 2, delayDays: 7, type: 'social_proof', customHint: null, docId: null },
    { order: 3, delayDays: 14, type: 'breakup', customHint: null, docId: null },
  ],
};

export default function FollowupConfigClient() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const res = await fetch('/api/followup/config');
      const data = await res.json();
      if (!active) return;
      if (data?.ok && data.config) {
        setConfig({
          ...DEFAULT_CONFIG,
          ...data.config,
          steps:
            Array.isArray(data.config.steps) && data.config.steps.length > 0
              ? data.config.steps
              : DEFAULT_CONFIG.steps,
        });
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/followup/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!data?.ok) setMsg(data?.error ?? 'Falha ao salvar');
      else {
        setMsg('Salvo.');
        if (data.config) setConfig({ ...config, ...data.config });
      }
    } finally {
      setSaving(false);
    }
  }

  function updateStep(i: number, patch: Partial<Step>) {
    const steps = [...config.steps];
    steps[i] = { ...steps[i], ...patch };
    setConfig({ ...config, steps });
  }

  function addStep() {
    const nextOrder = config.steps.length;
    const last = config.steps[config.steps.length - 1];
    setConfig({
      ...config,
      steps: [
        ...config.steps,
        {
          order: nextOrder,
          delayDays: (last?.delayDays ?? 2) + 3,
          type: 'reminder',
          customHint: null,
          docId: null,
        },
      ],
    });
  }

  function removeStep(i: number) {
    setConfig({
      ...config,
      steps: config.steps.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, order: idx })),
    });
  }

  function toggleDay(n: number) {
    setConfig({
      ...config,
      activeDays: config.activeDays.includes(n)
        ? config.activeDays.filter((d) => d !== n)
        : [...config.activeDays, n].sort((a, b) => a - b),
    });
  }

  if (loading) return <div className="p-8 text-sm text-[var(--muted)]">Carregando…</div>;

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-xs text-[var(--muted)] hover:underline">
            ← Dashboard
          </Link>
          <h1 className="text-xl font-semibold mt-1">Follow-ups automáticos</h1>
          <p className="text-sm text-[var(--muted)]">
            Cadência de toques que a IA dispara quando o lead não responde.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
          />
          {config.enabled ? 'Ativado' : 'Desativado'}
        </label>
      </div>

      <div className="surface p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs">
            Máx. de toques
            <input
              type="number"
              min={1}
              max={20}
              value={config.maxCount}
              onChange={(e) => setConfig({ ...config, maxCount: Number(e.target.value) })}
              className="input-field mt-1"
            />
          </label>
          <label className="block text-xs">
            Pausa ao responder (horas)
            <input
              type="number"
              min={0}
              max={720}
              value={config.pauseOnReplyHours}
              onChange={(e) => setConfig({ ...config, pauseOnReplyHours: Number(e.target.value) })}
              className="input-field mt-1"
            />
          </label>
          <label className="block text-xs">
            Janela começa
            <input
              value={config.windowStart}
              onChange={(e) => setConfig({ ...config, windowStart: e.target.value })}
              className="input-field mt-1"
              placeholder="09:00"
            />
          </label>
          <label className="block text-xs">
            Janela termina
            <input
              value={config.windowEnd}
              onChange={(e) => setConfig({ ...config, windowEnd: e.target.value })}
              className="input-field mt-1"
              placeholder="18:00"
            />
          </label>
          <label className="block text-xs col-span-2">
            Fuso
            <input
              value={config.timezone}
              onChange={(e) => setConfig({ ...config, timezone: e.target.value })}
              className="input-field mt-1"
            />
          </label>
        </div>

        <div>
          <div className="text-xs mb-1">Dias ativos</div>
          <div className="flex gap-1 flex-wrap">
            {DAYS.map((d) => {
              const on = config.activeDays.includes(d.n);
              return (
                <button
                  key={d.n}
                  type="button"
                  onClick={() => toggleDay(d.n)}
                  className={`px-2.5 py-1 text-xs rounded-full border ${
                    on
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent)]'
                      : 'border-[var(--line)] text-[var(--muted)]'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Cadência</h2>
          <button type="button" onClick={addStep} className="btn-ghost px-2 py-1 text-xs">
            + Adicionar passo
          </button>
        </div>
        {config.steps.length === 0 && (
          <p className="text-xs text-[var(--muted)]">Nenhum passo configurado.</p>
        )}
        {config.steps.map((step, i) => (
          <div
            key={i}
            className="grid grid-cols-12 gap-2 items-center border border-[var(--line)] rounded-md p-2"
          >
            <span className="col-span-1 text-xs font-mono text-[var(--muted)]">{i + 1}</span>
            <label className="col-span-2 block text-[10px]">
              Dias
              <input
                type="number"
                min={1}
                value={step.delayDays}
                onChange={(e) => updateStep(i, { delayDays: Number(e.target.value) })}
                className="input-field mt-0.5"
              />
            </label>
            <label className="col-span-3 block text-[10px]">
              Tipo
              <select
                value={step.type}
                onChange={(e) => updateStep(i, { type: e.target.value })}
                className="input-field mt-0.5"
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="col-span-5 block text-[10px]">
              Diretriz opcional (customHint)
              <input
                value={step.customHint ?? ''}
                onChange={(e) => updateStep(i, { customHint: e.target.value })}
                className="input-field mt-0.5"
                placeholder="Ex: cite case hospital X"
              />
            </label>
            <button
              type="button"
              onClick={() => removeStep(i)}
              className="col-span-1 btn-ghost px-1 py-1 text-xs text-[var(--danger)]"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="btn-primary px-4 py-2 text-sm"
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
        {msg && <span className="text-xs text-[var(--muted)]">{msg}</span>}
      </div>
    </div>
  );
}
