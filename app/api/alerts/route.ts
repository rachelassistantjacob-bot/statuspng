import { NextRequest, NextResponse } from 'next/server';
import { getAlertHistory } from '@/lib/monitor';

// GET /api/alerts?monitor_id=X
// Returns alert history for a specific monitor
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const monitorId = searchParams.get('monitor_id');

    if (!monitorId) {
      return NextResponse.json({ error: 'monitor_id is required' }, { status: 400 });
    }

    const alerts = await getAlertHistory(monitorId, 10);
    return NextResponse.json(alerts);
  } catch (e) {
    console.error('Failed to get alert history:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
