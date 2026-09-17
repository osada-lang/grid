import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    const whereClause = search
      ? {
          name: {
            contains: search,
          },
        }
      : {};

    const agencies = await prisma.agency.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { stores: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ agencies });
  } catch (error: any) {
    console.error('API /api/agencies GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Agency name is required' }, { status: 400 });
    }

    const trimmedName = name.trim();

    // 既存の同名代理店がないか確認
    let agency = await prisma.agency.findUnique({
      where: { name: trimmedName },
    });

    if (!agency) {
      agency = await prisma.agency.create({
        data: { name: trimmedName },
      });
    }

    return NextResponse.json({ agency }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/agencies POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
