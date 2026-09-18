import { prisma } from './db';
import { calculateGridPoints } from './grid';
import { fetchRankAtPoint, RankFetchResult } from './ranker';

export interface MeasurementSummary {
  runId: string;
  executedAt: Date;
  keywordStats: {
    keywordId: string;
    keywordText: string;
    avgRank: number; // 圏外は21位換算
    top3Count: number;
    top10Count: number;
    totalPoints: number;
  }[];
}

/**
 * 指定された店舗の7x7グリッド順位計測を実行し、完全な新規履歴として365ボイスDBに保存する
 */
export async function executeStoreMeasurement(
  storeId: string,
  options?: { intervalMeters?: number }
) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: {
      gridKeywords: {
        where: { isActive: true },
      },
    },
  });

  if (!store) {
    throw new Error(`Store with ID ${storeId} not found.`);
  }

  if (store.gridKeywords.length === 0) {
    throw new Error(`店舗「${store.name}」には有効なキーワードが登録されていません。先にキーワードを登録してください。`);
  }

  const intervalMeters = options?.intervalMeters ?? store.intervalMeters ?? 500;
  const gridSize = 7; // 7x7

  // 緯度経度（未設定時のデフォルト：東京駅周辺）
  const centerLat = store.centerLatitude ?? 35.681236;
  const centerLng = store.centerLongitude ?? 139.767125;
  const targetName = store.targetName || store.name;

  // 1. 7x7 グリッド地点（49地点）の算出
  const gridPoints = calculateGridPoints(
    centerLat,
    centerLng,
    gridSize,
    intervalMeters
  );

  // 2. 新規 GridMeasurementRun レコードを作成（履歴保存ヘッダー）
  const run = await prisma.gridMeasurementRun.create({
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
    for (const keyword of store.gridKeywords) {
      for (const point of gridPoints) {
        const result: RankFetchResult = await fetchRankAtPoint(
          keyword.keywordText,
          point,
          targetName
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

    // 4. GridRankResult に一括挿入
    await prisma.gridRankResult.createMany({
      data: rankResultData,
    });

    // 5. ステータス完了に更新
    await prisma.gridMeasurementRun.update({
      where: { id: run.id },
      data: { status: 'COMPLETED' },
    });

    return run;
  } catch (error) {
    await prisma.gridMeasurementRun.update({
      where: { id: run.id },
      data: { status: 'FAILED' },
    });
    throw error;
  }
}

/**
 * 指定された GridMeasurementRun のキーワード別サマリー（平均順位, TOP3地点数, TOP10地点数）を取得する
 */
export async function getRunSummary(runId: string): Promise<MeasurementSummary> {
  const run = await prisma.gridMeasurementRun.findUnique({
    where: { id: runId },
    include: {
      gridRankResults: {
        include: {
          gridKeyword: true,
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

  for (const res of run.gridRankResults) {
    if (!grouped.has(res.keywordId)) {
      grouped.set(res.keywordId, {
        keywordText: res.gridKeyword.keywordText,
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
