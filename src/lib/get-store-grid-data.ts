import { prisma } from '@/lib/db';

export async function getStoreGridData(storeId: string, targetRunId?: string) {
  try {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: {
        keywords: { where: { isActive: true } },
      },
    });

    if (!store) {
      return null;
    }

    // 全ての計測実行履歴リスト
    const allRuns = await prisma.measurementRun.findMany({
      where: { storeId: store.id, status: 'COMPLETED' },
      orderBy: { executedAt: 'desc' },
      select: {
        id: true,
        executedAt: true,
        gridSize: true,
        intervalMeters: true,
      },
    });

    // 対象となる runId の決定（指定がなければ最新）
    const activeRunId = targetRunId || allRuns[0]?.id;

    // activeRunId を基準にした対象データおよび直前データを取得
    let latestRun = null;
    let previousRun = null;

    if (activeRunId) {
      const activeIndex = allRuns.findIndex((r: any) => r.id === activeRunId);
      const runsToFetchIds = [activeRunId];
      if (activeIndex !== -1 && allRuns[activeIndex + 1]) {
        runsToFetchIds.push(allRuns[activeIndex + 1].id);
      }

      const fetchedRuns = await prisma.measurementRun.findMany({
        where: { id: { in: runsToFetchIds } },
        include: {
          rankResults: {
            include: { keyword: true },
          },
        },
      });

      latestRun = fetchedRuns.find((r: any) => r.id === activeRunId) || null;
      if (activeIndex !== -1 && allRuns[activeIndex + 1]) {
        previousRun = fetchedRuns.find((r: any) => r.id === allRuns[activeIndex + 1].id) || null;
      }
    }

    const processRunData = (run: typeof latestRun) => {
      if (!run) return null;

      const keywordMap = new Map<
        string,
        {
          keywordId: string;
          keywordText: string;
          category: string;
          isMain: boolean;
          results: {
            pointX: number;
            pointY: number;
            latitude: number;
            longitude: number;
            rank: number | null;
          }[];
        }
      >();

      for (const result of run.rankResults) {
        if (!keywordMap.has(result.keywordId)) {
          keywordMap.set(result.keywordId, {
            keywordId: result.keywordId,
            keywordText: result.keyword.keywordText,
            category: (result.keyword as any).category || ((result.keyword as any).isMain ? 'MAIN' : 'SUB'),
            isMain: (result.keyword as any).category === 'MAIN' || (result.keyword as any).isMain === true,
            results: [],
          });
        }
        keywordMap.get(result.keywordId)!.results.push({
          pointX: result.pointX,
          pointY: result.pointY,
          latitude: result.latitude,
          longitude: result.longitude,
          rank: result.rank,
        });
      }

      const summaries = Array.from(keywordMap.values()).map((kw) => {
        const ranks = kw.results.map((r) => (r.rank === null ? 21 : r.rank));
        const avgRank = Number((ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(1));
        const top3Count = kw.results.filter((r) => r.rank !== null && r.rank <= 3).length;
        const top20Count = kw.results.filter((r) => r.rank !== null && r.rank <= 20).length;

        return {
          keywordId: kw.keywordId,
          keywordText: kw.keywordText,
          category: kw.category,
          isMain: kw.category === 'MAIN',
          avgRank,
          top3Count,
          top20Count,
          top10Count: top20Count,
          totalPoints: kw.results.length,
          gridMatrix: kw.results,
        };
      });

      const getCategoryOrder = (cat: string) => {
        if (cat === 'MAIN') return 1;
        if (cat === 'SUB') return 2;
        if (cat === 'EXCLUDED') return 3;
        return 4;
      };

      // メイン -> サブ -> 最近外したワード の順序で並び替え
      summaries.sort((a, b) => {
        const orderA = getCategoryOrder(a.category);
        const orderB = getCategoryOrder(b.category);
        return orderA - orderB;
      });

      return {
        runId: run.id,
        executedAt: run.executedAt.toISOString(),
        summaries,
      };
    };

    const latestProcessed = processRunData(latestRun);
    const previousProcessed = processRunData(previousRun);

    return {
      store: {
        id: store.id,
        name: store.name,
        targetName: store.targetName,
        centerLatitude: store.centerLatitude,
        centerLongitude: store.centerLongitude,
        address: store.address,
        intervalMeters: store.intervalMeters ?? 500,
      },
      latestRun: latestProcessed,
      previousRun: previousProcessed,
      historyRuns: allRuns.map((r: any) => ({
        ...r,
        executedAt: r.executedAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error('getStoreGridData error:', error);
    return null;
  }
}
