import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agencyId = searchParams.get('agencyId');
    const search = searchParams.get('search');

    let whereClause: any = {};

    if (agencyId) {
      if (agencyId === 'unassigned') {
        whereClause = { agencyId: null };
      } else if (agencyId !== 'all') {
        whereClause = { agencyId };
      }
    } else if (search && search.trim() !== '') {
      const q = search.trim();
      whereClause = {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { targetName: { contains: q, mode: 'insensitive' } },
          { area: { contains: q, mode: 'insensitive' } },
          { industry: { contains: q, mode: 'insensitive' } },
          {
            agency: {
              name: { contains: q, mode: 'insensitive' },
            },
          },
          {
            gridKeywords: {
              some: {
                keywordText: { contains: q, mode: 'insensitive' },
              },
            },
          },
        ],
      };
    }

    const stores = await prisma.store.findMany({
      where: whereClause,
      include: {
        agency: true,
        gridKeywords: true,
        gridMeasurementRuns: {
          where: { status: 'COMPLETED' },
          orderBy: { executedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedStores = stores.map((s) => ({
      id: s.id,
      name: s.name,
      targetName: s.targetName || s.name,
      centerLatitude: s.centerLatitude ?? 35.681236,
      centerLongitude: s.centerLongitude ?? 139.767125,
      address: s.area || null,
      intervalMeters: s.intervalMeters ?? 500,
      isMeasurementActive: s.isMeasurementActive ?? true,
      agencyId: s.agencyId || 'unassigned',
      agency: {
        id: s.agencyId || 'unassigned',
        name: s.agency?.name || '（代理店未割り当て）',
      },
      keywords: s.gridKeywords.map((k) => ({
        id: k.id,
        keywordText: k.keywordText,
        category: k.category,
      })),
      measurementRuns: s.gridMeasurementRuns.map((r) => ({
        id: r.id,
        executedAt: r.executedAt.toISOString(),
      })),
    }));

    return NextResponse.json({ stores: formattedStores });
  } catch (error: any) {
    console.error('API /api/stores GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
