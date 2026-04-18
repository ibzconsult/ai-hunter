const UAZAPI_URL = process.env.UAZAPI_URL ?? 'https://ibusiness.uazapi.com';
const ADMIN_TOKEN = process.env.UAZAPI_ADMIN_TOKEN ?? '';

type Json = Record<string, unknown>;

async function call<T = Json>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${UAZAPI_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Uazapi ${path} ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export async function initInstance(name: string) {
  const resp = await call<Json>('/instance/init', {
    method: 'POST',
    headers: { admintoken: ADMIN_TOKEN },
    body: JSON.stringify({ name }),
  });
  const token = (resp.token as string) ?? ((resp.data as Json | undefined)?.token as string) ?? '';
  if (!token) throw new Error('Uazapi init sem token');
  return { token, raw: resp };
}

function extractQr(resp: Json): string | null {
  const candidates: Json[] = [resp];
  for (const key of ['data', 'instance', 'response']) {
    const v = resp[key];
    if (v && typeof v === 'object') candidates.push(v as Json);
  }
  for (const c of candidates) {
    const raw =
      (c.qrcode as string) ??
      (c.qr as string) ??
      (c.qrCode as string) ??
      (c.base64 as string) ??
      '';
    if (raw && typeof raw === 'string' && raw.length > 20) {
      return raw.startsWith('data:image') ? raw : `data:image/png;base64,${raw}`;
    }
  }
  return null;
}

export async function connectInstance(token: string) {
  const resp = await call<Json>('/instance/connect', {
    method: 'POST',
    headers: { token },
    body: '{}',
  });
  const qrcode = extractQr(resp);
  const instance = resp.instance as Json | undefined;
  console.log('[uazapi connect]', {
    hasQr: !!qrcode,
    keys: Object.keys(resp),
    instanceKeys: instance ? Object.keys(instance) : null,
    responseKeys: resp.response ? Object.keys(resp.response as Json) : null,
  });
  return { qrcode, raw: resp };
}

export async function getStatus(token: string) {
  const resp = await call<Json>('/instance/status', {
    method: 'GET',
    headers: { token },
  });
  const data = (resp.data as Json | undefined) ?? {};
  const qrcode = extractQr(resp);
  console.log('[uazapi status]', { hasQr: !!qrcode, keys: Object.keys(resp), status: resp.status });
  const rawStatus = resp.status ?? resp.state ?? data.status ?? data.state;
  let status: string;
  if (typeof rawStatus === 'string') {
    status = rawStatus;
  } else if (rawStatus && typeof rawStatus === 'object') {
    const s = rawStatus as { connected?: boolean; loggedIn?: boolean };
    status = s.connected ? 'connected' : s.loggedIn ? 'connecting' : 'disconnected';
  } else {
    status = 'disconnected';
  }
  return { status, qrcode, raw: resp };
}

export async function checkWhatsApp(
  token: string,
  phones: string[]
): Promise<Record<string, boolean>> {
  if (phones.length === 0) return {};
  const resp = await call<Json>('/chat/check', {
    method: 'POST',
    headers: { token },
    body: JSON.stringify({ numbers: phones }),
  });
  const raw = Array.isArray(resp) ? resp : ((resp.data ?? resp.result ?? []) as Json[]);
  const out: Record<string, boolean> = {};
  for (const item of raw as Array<Record<string, unknown>>) {
    const num = (item.number ?? item.query ?? item.jid ?? '') as string;
    const ok =
      (item.exists as boolean) ??
      (item.isInWhatsapp as boolean) ??
      (item.isWhatsapp as boolean) ??
      (item.isValid as boolean) ??
      false;
    const phone = String(num).replace(/\D/g, '');
    if (phone) out[phone] = !!ok;
  }
  return out;
}

export async function sendText(token: string, phone: string, message: string) {
  return call('/send/text', {
    method: 'POST',
    headers: { token },
    body: JSON.stringify({ number: phone, text: message }),
  });
}

export type MediaKind = 'document' | 'image' | 'video' | 'audio';

export async function sendMedia(
  token: string,
  phone: string,
  fileUrl: string,
  opts?: { caption?: string; type?: MediaKind; fileName?: string }
) {
  const type: MediaKind = opts?.type ?? 'document';
  const payload: Json = {
    number: phone,
    type,
    file: fileUrl,
  };
  if (opts?.caption) payload.text = opts.caption;
  if (opts?.fileName) payload.docName = opts.fileName;
  return call('/send/media', {
    method: 'POST',
    headers: { token },
    body: JSON.stringify(payload),
  });
}
