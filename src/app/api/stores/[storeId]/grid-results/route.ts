import { NextResponse } from 'next/server';
import { getStoreGridData } from '@/lib/get-store-grid-data';
import { getDemoGridData } from '@/lib/demo-fallback-data';

export async function GET(
  request: Request,
  { params }: { params: { storeId: string } | Promise<{ storeId: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('runId') || undefined;

    let data = await getStoreGridData(resolvedParams.storeId, runId);

    if (!data) {
      data = getDemoGridData();
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('API /api/stores/[storeId]/grid-results error:', error);
    return NextResponse.json(getDemoGridData());
  }
}

