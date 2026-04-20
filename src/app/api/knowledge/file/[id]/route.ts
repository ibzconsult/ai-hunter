import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, promises as fs } from 'fs';
import path from 'path';
import { Readable } from 'stream';

export const runtime = 'nodejs';

const UPLOAD_ROOT = process.env.KB_UPLOAD_DIR ?? '/app/uploads/kb';

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
};

function mimeFromExt(ext: string): string {
  return MIME[ext.toLowerCase()] ?? 'application/octet-stream';
}

type Params = Promise<{ id: string }>;

export async function GET(_req: NextRequest, ctx: { params: Params }) {
  const { id: raw } = await ctx.params;
  const match = /^([0-9a-f-]{36})\.([a-z0-9]{1,5})$/i.exec(raw);
  if (!match) return new NextResponse('Not found', { status: 404 });

  const [, uuid, ext] = match;
  const fileName = `${uuid}.${ext}`;

  let resolved: string | null = null;
  try {
    const tenants = await fs.readdir(UPLOAD_ROOT);
    for (const t of tenants) {
      const candidate = path.join(UPLOAD_ROOT, t, fileName);
      try {
        const stat = await fs.stat(candidate);
        if (stat.isFile()) {
          resolved = candidate;
          break;
        }
      } catch {}
    }
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
  if (!resolved) return new NextResponse('Not found', { status: 404 });

  const stat = await fs.stat(resolved);
  const stream = createReadStream(resolved);
  const webStream = Readable.toWeb(stream) as ReadableStream;
  return new NextResponse(webStream, {
    headers: {
      'Content-Type': mimeFromExt(ext),
      'Content-Length': String(stat.size),
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'private, max-age=300',
    },
  });
}
