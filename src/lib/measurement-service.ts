import { prisma } from './db';
import { calculateGridPoints } from './grid';
import { fetchRankAtPoint, RankFetchResult } from './ranker';

export interface MeasurementSummary {
  runId: string;
  executedAt: Date;
  keywordStats: {
    keywordId: string;
    keywordText: string;
    avgRank: number; // 圏外は20位換算または除外計算
    top3Count: number;
    top10Count: number;
    totalPoints: number;
  }[];
}

/**
 * 指定された店舗の7x7グリッド順位計測を実行し、完全な新規履歴として保存する
 */
export async function executeStoreMeasurement(
  storeId: string,
  options?: { intervalMeters?: number; mockTrendFactor?: number }
) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: {
      keywords: {
        where: { isActive: true },
      },
    },
  });

  if (!store) {
    throw new Error(`Store with ID ${storeId} not found.`);
  }

  if (store.keywords.length === 0) {
    throw new Error(`Store ${store.name} has no active keywords.`);
  }

  const intervalMeters = options?.intervalMeters ?? 500;
  const gridSize = 7; // 7x7

  // 1. 7x7 グリッド地点（49地点）の算出
  const gridPoints = calculateGridPoints(
    store.centerLatitude,
    store.centerLongitude,
    gridSize,
    intervalMeters
  );

  // 2. 新規 MeasurementRun レコードを作成（履歴保存ヘッダー）
  const run = await prisma.measurementRun.create({
    data: {
      storeId: store.id,
      gridSize,
      intervalMeters,
      status: 'IN_PROGRESS',
      executedAt: new Date(),
    },
  });

  try {
    const rankResultData: {
      measurementRunId: string;
      keywordId: string;
      pointX: number;
      pointY: number;
      latitude: number;
      longitude: number;
      rank: number | null;
      rawTitle: string | null;
    }[] = [];

    // 3. 各キーワード × 49地点で順位取得
    for (const keyword of store.keywords) {
      for (const point of gridPoints) {
        const result: RankFetchResult = await fetchRankAtPoint(
          keyword.keywordText,
          point,
          store.targetName,
          { mockTrendFactor: options?.mockTrendFactor }
        );

        rankResultData.push({
          measurementRunId: run.id,
          keywordId: keyword.id,
          pointX: point.pointX,
          pointY: point.pointY,
          latitude: result.latitude,
          longitude: result.longitude,
          rank: result.rank,
          rawTitle: result.rawTitle ?? null,
        });
      }
    }

    // 4. rank_results に一括挿入
    await prisma.rankResult.createMany({
      data: rankResultData,
    });

    // 5. ステータス完了に更新
    await prisma.measurementRun.update({
      where: { id: run.id },
      data: { status: 'COMPLETED' },
    });

    return run;
  } catch (error) {
    await prisma.measurementRun.update({
      where: { id: run.id },
      data: { status: 'FAILED' },
    });
    throw error;
  }
}

/**
 * 指定された MeasurementRun のキーワード別サマリー（平均順位, TOP3地点数, TOP10地点数）を取得する
 */
export async function getRunSummary(runId: string): Promise<MeasurementSummary> {
  const run = await prisma.measurementRun.findUnique({
    where: { id: runId },
    include: {
      rankResults: {
        include: {
          keyword: true,
        },
      },
    },
  });

  if (!run) {
    throw new Error(`MeasurementRun with ID ${runId} not found.`);
  }

  // キーワードごとにグループ化
  const grouped = new Map<
    string,
    { keywordText: string; results: (number | null)[] }
  >();

  for (const res of run.rankResults) {
    if (!grouped.has(res.keywordId)) {
      grouped.set(res.keywordId, {
        keywordText: res.keyword.keywordText,
        results: [],
      });
    }
    grouped.get(res.keywordId)!.results.push(res.rank);
  }

  const keywordStats = Array.from(grouped.entries()).map(
    ([keywordId, { keywordText, results }]) => {
      const validRanks = results.map((r) => (r === null ? 21 : r)); // 圏外は21位として計算
      const sum = validRanks.reduce((a, b) => a + b, 0);
      const avgRank = Number((sum / results.length).toFixed(1));

      const top3Count = results.filter((r) => r !== null && r <= 3).length;
      const top10Count = results.filter((r) => r !== null && r <= 10).length;

      return {
        keywordId,
        keywordText,
        avgRank,
        top3Count,
        top10Count,
        totalPoints: results.length,
      };
    }
  );

  return {
    runId: run.id,
    executedAt: run.executedAt,
    keywordStats,
  };
}
