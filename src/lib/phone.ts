/**
 * Normaliza telefone para formato E.164 sem o "+".
 * - Se começar com "+", respeita o código do país informado.
 * - Senão, assume Brasil (+55).
 * - Retorna null se o número for inválido (<10 dígitos).
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10) return null;

  if (hasPlus) return digits;
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  return `55${digits}`;
}

/**
 * Formata um telefone E.164 sem "+" para exibição legível.
 * Brasileiro (55): "+55 85 9 8888-7777"
 * Outros: "+<país> <resto>"
 */
export function formatPhone(raw: string | null): string {
  if (!raw) return '—';
  const d = raw.replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('55'))
    return `+55 ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12 && d.startsWith('55'))
    return `+55 ${d.slice(2, 4)} ${d.slice(4, 8)}-${d.slice(8)}`;
  // genérico: +<cc> <rest> com espaços a cada 4 dígitos
  if (d.length >= 10) return `+${d.slice(0, d.length - 7)} ${d.slice(-7, -4)}-${d.slice(-4)}`;
  return raw;
}
