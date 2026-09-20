import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { executeStoreMeasurement } from '@/lib/measurement-service';

export async function GET(request: Request) {
  return handleCronJob(request);
}

export async function POST(request: Request) {
  return handleCronJob(request);
}

async function handleCronJob(request: Request) {
  // CRON_SECRET の検証（環境変数で設定されている場合）
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('secret') !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // 計測ON (isMeasurementActive: true) の店舗のみ自動計測
    const stores = await prisma.store.findMany({
      where: { isMeasurementActive: true },
    });
    const results = [];

    for (const store of stores) {
      try {
        const run = await executeStoreMeasurement(store.id);
        results.push({ storeId: store.id, storeName: store.name, status: 'SUCCESS', runId: run.id });
      } catch (err: any) {
        results.push({ storeId: store.id, storeName: store.name, status: 'FAILED', error: err.message });
      }
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      processedStores: results.length,
      details: results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
