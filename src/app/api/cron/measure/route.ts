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
  // CRON_SECRET の検証（環境変数または365ボイス標準シークレット: thanx_cron_secret_2026）
  const authHeader = request.headers.get('authorization');
  const envSecret = process.env.CRON_SECRET;
  const defaultSecret = 'thanx_cron_secret_2026';

  const { searchParams } = new URL(request.url);
  const secretParam = searchParams.get('secret') || searchParams.get('key');

  const validSecrets = [defaultSecret, envSecret].filter(Boolean) as string[];

  const isHeaderValid = validSecrets.some(
    (s) => authHeader === `Bearer ${s}` || authHeader === s
  );
  const isParamValid = validSecrets.some((s) => secretParam === s);

  if (!isHeaderValid && !isParamValid) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid cron authorization token.' },
      { status: 401 }
    );
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
        results.push({
          storeId: store.id,
          storeName: store.name,
          status: 'SUCCESS',
          runId: run.id,
        });
      } catch (err: any) {
        results.push({
          storeId: store.id,
          storeName: store.name,
          status: 'FAILED',
          error: err.message,
        });
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
