import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

const UPLOAD_ROOT = process.env.KB_UPLOAD_DIR ?? '/app/uploads/kb';
const MAX_SIZE = 20 * 1024 * 1024;

function mimeToKind(mime: string): 'image' | 'video' | 'audio' | 'document' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'document';
}

function extFromMime(mime: string, fallback = 'bin'): string {
  const map: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
  };
  return map[mime] ?? fallback;
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ success: false, error: 'Arquivo ausente' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ success: false, error: 'Arquivo vazio' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ success: false, error: 'Arquivo acima de 20MB' }, { status: 400 });
  }

  const mime = file.type || 'application/octet-stream';
  const originalName = file.name || 'file';
  const extFromName = originalName.includes('.') ? originalName.split('.').pop()!.toLowerCase() : null;
  const ext = (extFromName && extFromName.length <= 5) ? extFromName : extFromMime(mime);
  const id = randomUUID();
  const tenantDir = path.join(UPLOAD_ROOT, s.tenantId);
  const filePath = path.join(tenantDir, `${id}.${ext}`);

  await fs.mkdir(tenantDir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, buf);

  const origin = req.nextUrl.origin;
  const fileUrl = `${origin}/api/knowledge/file/${id}.${ext}`;

  return NextResponse.json({
    success: true,
    fileUrl,
    fileType: mimeToKind(mime),
    originalName,
    size: file.size,
  });
}
