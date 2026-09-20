import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { executeStoreMeasurement } from '@/lib/measurement-service';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { storeId, intervalMeters } = body;

    let targetStores = [];
    if (storeId) {
      const store = await prisma.store.findUnique({ where: { id: storeId } });
      if (!store) {
        return NextResponse.json({ error: 'Store not found' }, { status: 404 });
      }
      targetStores.push(store);
    } else {
      // 全店舗一括計測時：計測ON (isMeasurementActive: true) の店舗のみを抽出
      targetStores = await prisma.store.findMany({
        where: { isMeasurementActive: true },
      });
    }

    if (targetStores.length === 0) {
      return NextResponse.json({
        message: '計測対象の有効な店舗がありません（すべての店舗で計測がOFFになっている可能性があります）。',
        runs: [],
      }, { status: 200 });
    }

    const runs = [];
    for (const store of targetStores) {
      try {
        const run = await executeStoreMeasurement(store.id, {
          intervalMeters,
        });
        runs.push({ storeId: store.id, storeName: store.name, runId: run.id, status: run.status });
      } catch (err: any) {
        console.warn(`Measurement skipped for store ${store.name}:`, err.message);
      }
    }

    return NextResponse.json({
      message: `${runs.length} 店舗の計測が完了しました！`,
      runs,
    });
  } catch (error: any) {
    console.error('API /api/measure error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to execute measurement' },
      { status: 500 }
    );
  }
}
