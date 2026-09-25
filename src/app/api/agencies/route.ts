import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // 1. 登録されている代理店一覧を取得（店舗数カウント付き）
    const agencies = await prisma.agency.findMany({
      include: {
        _count: {
          select: { stores: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // 2. 代理店未所属（agencyId が null）の店舗数をカウント
    const unassignedStoreCount = await prisma.store.count({
      where: { agencyId: null },
    });

    const result = agencies.map((a) => ({
      id: a.id,
      name: a.name,
      _count: { stores: a._count.stores },
    }));

    if (unassignedStoreCount > 0) {
      result.push({
        id: 'unassigned',
        name: '（代理店未割り当て）',
        _count: { stores: unassignedStoreCount },
      });
    }

    if (result.length === 0) {
      result.push({
        id: 'all',
        name: '（全店舗）',
        _count: { stores: 0 },
      });
    }

    return NextResponse.json({ agencies: result });
  } catch (error: any) {
    console.error('API /api/agencies GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
