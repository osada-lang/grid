import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const stores = await prisma.store.findMany({
      select: { area: true, id: true },
    });

    const areaCountMap = new Map<string, number>();
    for (const s of stores) {
      const areaName = s.area && s.area.trim() !== '' ? s.area : '（直営・未設定）';
      areaCountMap.set(areaName, (areaCountMap.get(areaName) || 0) + 1);
    }

    const agencies = Array.from(areaCountMap.entries()).map(([name, count]) => ({
      id: encodeURIComponent(name),
      name,
      _count: { stores: count },
    }));

    if (agencies.length === 0) {
      agencies.push({
        id: 'all',
        name: '（全店舗・直営）',
        _count: { stores: 0 },
      });
    }

    return NextResponse.json({ agencies });
  } catch (error: any) {
    console.error('API /api/agencies GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
