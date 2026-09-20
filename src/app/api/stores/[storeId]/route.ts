import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { storeId: string } | Promise<{ storeId: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const store = await prisma.store.findUnique({
      where: { id: resolvedParams.storeId },
      include: {
        gridKeywords: true,
      },
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json({ store });
  } catch (error: any) {
    console.error('API /api/stores/[storeId] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { storeId: string } | Promise<{ storeId: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const body = await request.json();
    const { isMeasurementActive, intervalMeters, targetName } = body;

    const updateData: any = {};
    if (isMeasurementActive !== undefined) updateData.isMeasurementActive = isMeasurementActive;
    if (intervalMeters !== undefined) updateData.intervalMeters = parseInt(intervalMeters, 10);
    if (targetName !== undefined) updateData.targetName = targetName.trim();

    const updatedStore = await prisma.store.update({
      where: { id: resolvedParams.storeId },
      data: updateData,
    });

    return NextResponse.json({
      message: 'Store updated successfully',
      store: updatedStore,
    });
  } catch (error: any) {
    console.error('API /api/stores/[storeId] PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
