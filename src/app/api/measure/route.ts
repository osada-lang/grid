import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { executeStoreMeasurement } from '@/lib/measurement-service';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { storeId, mockTrendFactor, intervalMeters } = body;

    let targetStores = [];
    if (storeId) {
      const store = await prisma.store.findUnique({ where: { id: storeId } });
      if (!store) {
        return NextResponse.json({ error: 'Store not found' }, { status: 404 });
      }
      targetStores.push(store);
    } else {
      // 全店舗
      targetStores = await prisma.store.findMany();
    }

    if (targetStores.length === 0) {
      return NextResponse.json({ message: 'No stores available to measure.' }, { status: 200 });
    }

    const runs = [];
    for (const store of targetStores) {
      const run = await executeStoreMeasurement(store.id, {
        mockTrendFactor,
        intervalMeters,
      });
      runs.push({ storeId: store.id, runId: run.id, status: run.status });
    }

    return NextResponse.json({
      message: 'Measurement completed successfully.',
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
