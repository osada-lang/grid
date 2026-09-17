import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agencyId = searchParams.get('agencyId');
    const search = searchParams.get('search');

    if (agencyId) {
      // 特定代理店配下の店舗を取得（遅延ロード用）
      const stores = await prisma.store.findMany({
        where: { agencyId },
        include: {
          agency: true,
          keywords: true,
          measurementRuns: {
            where: { status: 'COMPLETED' },
            orderBy: { executedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ stores });
    }

    if (search && search.trim() !== '') {
      const q = search.trim();
      // サーバーサイド検索（店舗名、判定名、住所、またはキーワードに含まれる店舗）
      const stores = await prisma.store.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { targetName: { contains: q } },
            { address: { contains: q } },
            {
              keywords: {
                some: {
                  keywordText: { contains: q },
                },
              },
            },
          ],
        },
        include: {
          agency: true,
          keywords: true,
          measurementRuns: {
            where: { status: 'COMPLETED' },
            orderBy: { executedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50, // 検索結果上限
      });
      return NextResponse.json({ stores });
    }

    // デフォルト（全店舗）
    const stores = await prisma.store.findMany({
      include: {
        agency: true,
        keywords: true,
        measurementRuns: {
          where: { status: 'COMPLETED' },
          orderBy: { executedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ stores });
  } catch (error: any) {
    console.error('API /api/stores GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, targetName, centerLatitude, centerLongitude, address, agencyId, agencyName, keywords } = body;

    if (!name || !targetName || centerLatitude === undefined || centerLongitude === undefined) {
      return NextResponse.json(
        { error: 'Missing required store information' },
        { status: 400 }
      );
    }

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: 'At least one keyword is required' },
        { status: 400 }
      );
    }

    // 代理店IDの決定
    let targetAgencyId = agencyId;
    if (!targetAgencyId) {
      if (agencyName && agencyName.trim() !== '') {
        // 名前から代理店を検索または作成
        let agency = await prisma.agency.findUnique({
          where: { name: agencyName.trim() },
        });
        if (!agency) {
          agency = await prisma.agency.create({
            data: { name: agencyName.trim() },
          });
        }
        targetAgencyId = agency.id;
      } else {
        // デフォルトの（直営店）を検索または作成
        let directAgency = await prisma.agency.findFirst({
          where: { name: '（直営店）' },
        });
        if (!directAgency) {
          directAgency = await prisma.agency.create({
            data: { name: '（直営店）' },
          });
        }
        targetAgencyId = directAgency.id;
      }
    }

    // 店舗とキーワードを作成
    const store = await prisma.store.create({
      data: {
        agencyId: targetAgencyId,
        name,
        targetName,
        centerLatitude: parseFloat(centerLatitude),
        centerLongitude: parseFloat(centerLongitude),
        address,
        keywords: {
          create: keywords.map((kwText: string) => ({
            keywordText: kwText.trim(),
            category: 'MAIN',
            isMain: true,
          })),
        },
      },
      include: {
        agency: true,
        keywords: true,
      },
    });

    return NextResponse.json({ store }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/stores POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
