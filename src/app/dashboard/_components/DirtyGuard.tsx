'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useDirtyForm<T>(initial: T) {
  const [form, setForm] = useState<T>(initial);
  const originalRef = useRef<T>(initial);

  // Reinicializa quando `initial` muda (ex: carregamento tardio de dados).
  useEffect(() => {
    originalRef.current = initial;
    setForm(initial);
  }, [initial]);

  const dirty = JSON.stringify(form) !== JSON.stringify(originalRef.current);

  const reset = useCallback(() => {
    setForm(originalRef.current);
  }, []);

  const persist = useCallback((next: T) => {
    originalRef.current = next;
    setForm(next);
  }, []);

  // Alerta do browser em reload/close de aba com alterações pendentes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  return { form, setForm, dirty, reset, persist };
}

type ConfirmChoice = 'save' | 'discard' | 'cancel';

export function UnsavedConfirmDialog({
  open,
  onChoice,
}: {
  open: boolean;
  onChoice: (choice: ConfirmChoice) => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-6"
      onClick={() => onChoice('cancel')}
    >
      <div
        className="w-full max-w-sm rounded-md bg-white border border-[var(--line)] p-5 space-y-3 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold">Edições não salvas</h3>
        <p className="text-sm text-[var(--muted)]">
          Você tem alterações que ainda não foram salvas. O que deseja fazer?
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={() => onChoice('cancel')} className="btn-ghost px-3 py-1.5 text-sm">
            Cancelar
          </button>
          <button onClick={() => onChoice('discard')} className="btn-ghost px-3 py-1.5 text-sm text-[var(--danger)]">
            Descartar
          </button>
          <button onClick={() => onChoice('save')} className="btn-primary px-3 py-1.5 text-sm">
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
