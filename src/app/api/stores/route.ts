import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agencyId = searchParams.get('agencyId');
    const search = searchParams.get('search');

    let whereClause: any = {};

    if (agencyId) {
      const decodedArea = decodeURIComponent(agencyId);
      if (decodedArea === '（直営・未設定）') {
        whereClause = {
          OR: [{ area: null }, { area: '' }],
        };
      } else if (decodedArea !== 'all') {
        whereClause = { area: decodedArea };
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
      agencyId: encodeURIComponent(s.area || '（直営・未設定）'),
      agency: {
        id: encodeURIComponent(s.area || '（直営・未設定）'),
        name: s.area || '（直営・未設定）',
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
