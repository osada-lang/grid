import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const CATEGORY_LIMITS: Record<string, { max: number; label: string }> = {
  MAIN: { max: 3, label: '★ メイン' },
  SUB: { max: 5, label: 'サブ' },
  EXCLUDED: { max: 2, label: '最近外したワード' },
};

const getCategoryOrder = (category: string) => {
  if (category === 'MAIN') return 1;
  if (category === 'SUB') return 2;
  if (category === 'EXCLUDED') return 3;
  return 4;
};

// キーワード一覧取得 (MAIN -> SUB -> EXCLUDED の順番でソート)
export async function GET(
  request: Request,
  { params }: { params: { storeId: string } | Promise<{ storeId: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const storeId = resolvedParams.storeId;

    const keywords = await prisma.keyword.findMany({
      where: { storeId },
      orderBy: { createdAt: 'asc' },
    });

    // カテゴリー優先度順（メイン -> サブ -> 最近外したワード）でソート
    keywords.sort((a, b) => {
      const orderA = getCategoryOrder(a.category);
      const orderB = getCategoryOrder(b.category);
      if (orderA !== orderB) return orderA - orderB;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return NextResponse.json({ keywords, limits: CATEGORY_LIMITS });
  } catch (error: any) {
    console.error('API /api/stores/[storeId]/keywords GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 新規キーワード追加
export async function POST(
  request: Request,
  { params }: { params: { storeId: string } | Promise<{ storeId: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const storeId = resolvedParams.storeId;
    const body = await request.json();
    const { keywordText, category = 'MAIN' } = body;

    if (!keywordText || typeof keywordText !== 'string' || keywordText.trim() === '') {
      return NextResponse.json({ error: 'キーワード名を入力してください' }, { status: 400 });
    }

    const trimmedText = keywordText.trim();
    const targetCategory = category || 'MAIN';
    const limitInfo = CATEGORY_LIMITS[targetCategory];

    // 1. 同一店舗内での重複キーワードチェック
    const existing = await prisma.keyword.findFirst({
      where: {
        storeId,
        keywordText: trimmedText,
      },
    });

    if (existing) {
      const catLabel =
        existing.category === 'MAIN'
          ? '「★ メイン」'
          : existing.category === 'SUB'
          ? '「サブ」'
          : '「最近外したワード」';
      return NextResponse.json(
        {
          error: `キーワード「${trimmedText}」は既に${catLabel}に登録されています。重複して登録することはできません。`,
        },
        { status: 400 }
      );
    }

    // 2. 上限チェック (MAIN: 3, SUB: 5, EXCLUDED: 2)
    if (limitInfo) {
      const currentCount = await prisma.keyword.count({
        where: { storeId, category: targetCategory, isActive: true },
      });
      if (currentCount >= limitInfo.max) {
        return NextResponse.json(
          {
            error: `「${limitInfo.label}」の上限数（最大${limitInfo.max}件）に達しています。他のキーワードを移動または削除してください。`,
          },
          { status: 400 }
        );
      }
    }

    const keyword = await prisma.keyword.create({
      data: {
        storeId,
        keywordText: trimmedText,
        category: targetCategory,
        isMain: targetCategory === 'MAIN',
        isActive: true,
      },
    });

    return NextResponse.json({ keyword }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/stores/[storeId]/keywords POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// キーワード更新（カテゴリー変更・最近外したワードへの移動・テキスト変更）
export async function PUT(
  request: Request,
  { params }: { params: { storeId: string } | Promise<{ storeId: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const storeId = resolvedParams.storeId;
    const body = await request.json();
    const { keywordId, keywordText, category, isMain, isActive } = body;

    if (!keywordId) {
      return NextResponse.json({ error: 'keywordId is required' }, { status: 400 });
    }

    const currentKeyword = await prisma.keyword.findUnique({
      where: { id: keywordId, storeId },
    });

    if (!currentKeyword) {
      return NextResponse.json({ error: 'キーワードが見つかりませんでした' }, { status: 404 });
    }

    // テキスト変更時の重複チェック
    if (keywordText !== undefined && keywordText.trim() !== currentKeyword.keywordText) {
      const trimmedText = keywordText.trim();
      const duplicate = await prisma.keyword.findFirst({
        where: {
          storeId,
          keywordText: trimmedText,
          id: { not: keywordId },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          {
            error: `キーワード「${trimmedText}」は既にこの店舗に登録されています。`,
          },
          { status: 400 }
        );
      }
    }

    // カテゴリー変更時の上限数チェック
    if (category !== undefined && category !== currentKeyword.category) {
      const limitInfo = CATEGORY_LIMITS[category];
      if (limitInfo) {
        const currentCount = await prisma.keyword.count({
          where: {
            storeId,
            category,
            isActive: true,
            id: { not: keywordId },
          },
        });
        if (currentCount >= limitInfo.max) {
          return NextResponse.json(
            {
              error: `「${limitInfo.label}」の上限数（最大${limitInfo.max}件）に達しているため移動できません。移動先の既存キーワードを調整してください。`,
            },
            { status: 400 }
          );
        }
      }
    }

    const updateData: any = {};
    if (keywordText !== undefined) updateData.keywordText = keywordText.trim();
    if (category !== undefined) {
      updateData.category = category;
      updateData.isMain = category === 'MAIN';
    }
    if (isMain !== undefined && category === undefined) updateData.isMain = isMain;
    if (isActive !== undefined) updateData.isActive = isActive;

    const keyword = await prisma.keyword.update({
      where: { id: keywordId, storeId },
      data: updateData,
    });

    return NextResponse.json({ keyword, message: 'Keyword updated successfully' });
  } catch (error: any) {
    console.error('API /api/stores/[storeId]/keywords PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// キーワード削除
export async function DELETE(
  request: Request,
  { params }: { params: { storeId: string } | Promise<{ storeId: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const storeId = resolvedParams.storeId;
    const { searchParams } = new URL(request.url);
    const keywordId = searchParams.get('keywordId');

    if (!keywordId) {
      return NextResponse.json({ error: 'keywordId is required' }, { status: 400 });
    }

    await prisma.keyword.delete({
      where: { id: keywordId, storeId },
    });

    return NextResponse.json({ message: 'Keyword deleted successfully' });
  } catch (error: any) {
    console.error('API /api/stores/[storeId]/keywords DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
