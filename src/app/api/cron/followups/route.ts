import { NextRequest, NextResponse } from 'next/server';
import { resolveEligibleLeadIds, sendFollowup } from '@/lib/followup';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const expected = process.env.FOLLOWUP_CRON_TOKEN;
  if (!expected) return NextResponse.json({ ok: false, error: 'token_unset' }, { status: 500 });

  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== expected) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  try {
    const ids = await resolveEligibleLeadIds(50);
    let processed = 0;
    let failed = 0;
    const results: Array<{ id: string; ok: boolean; reason?: string }> = [];

    for (const id of ids) {
      try {
        const r = await sendFollowup(id);
        if (r.ok) {
          if (!r.skipped) processed++;
          results.push({ id, ok: true, reason: r.skipped });
        } else {
          failed++;
          results.push({ id, ok: false, reason: r.reason });
        }
      } catch (e) {
        failed++;
        results.push({ id, ok: false, reason: e instanceof Error ? e.message : 'err' });
      }
    }

    return NextResponse.json({ ok: true, eligible: ids.length, processed, failed, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    console.error('[cron/followups]', msg);
    return NextResponse.json({ ok: false, error: 'cron_failed', detail: msg }, { status: 500 });
  }
}
