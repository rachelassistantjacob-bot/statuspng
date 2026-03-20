import { NextRequest, NextResponse } from 'next/server';
import { createMonitor, getAllMonitors, deleteMonitor } from '@/lib/monitor';

export async function GET() {
  try {
    const monitors = await getAllMonitors();
    return NextResponse.json(monitors);
  } catch (e) {
    console.error('Failed to get monitors:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, url, email, interval_minutes } = body;

    if (!name || !url || !email) {
      return NextResponse.json({ error: 'name, url, and email are required' }, { status: 400 });
    }

    // Validate URL
    try { new URL(url); } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    const monitor = await createMonitor({ name, url, email, interval_minutes });
    return NextResponse.json(monitor, { status: 201 });
  } catch (e) {
    console.error('Failed to create monitor:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await deleteMonitor(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Failed to delete monitor:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
