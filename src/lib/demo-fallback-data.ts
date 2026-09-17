export const demoStoreData = {
  id: "193cabe7-f4f4-4fb9-9ee3-9687aaa73480",
  name: "ヘアサロン VOICE 表参道",
  targetName: "VOICE 表参道",
  centerLatitude: 35.665245,
  centerLongitude: 139.712314,
  address: "東京都港区南青山5-1-1 2F",
  keywords: [
    { id: "kw-1", keywordText: "子連れ 美容院", category: "MAIN", isMain: true },
    { id: "kw-2", keywordText: "キッズカット", category: "MAIN", isMain: true },
    { id: "kw-3", keywordText: "個室 美容室", category: "MAIN", isMain: true },
    { id: "kw-4", keywordText: "表参道 美容室", category: "SUB", isMain: false },
    { id: "kw-5", keywordText: "髪質改善 表参道", category: "SUB", isMain: false },
    { id: "kw-6", keywordText: "白髪ぼかし", category: "SUB", isMain: false },
    { id: "kw-7", keywordText: "ヘッドスパ おすすめ", category: "SUB", isMain: false },
    { id: "kw-8", keywordText: "前髪カット", category: "SUB", isMain: false },
    { id: "kw-9", keywordText: "表参道 ヘアサロン", category: "EXCLUDED", isMain: false },
    { id: "kw-10", keywordText: "南青山 美容院", category: "EXCLUDED", isMain: false },
  ],
  measurementRuns: [
    { id: "run-latest", executedAt: new Date("2026-08-31T10:32:35Z") },
    { id: "run-previous", executedAt: new Date("2026-07-31T10:00:00Z") },
  ],
};

function createGridMatrix(baseRank: number) {
  const points = [];
  for (let x = -3; x <= 3; x++) {
    for (let y = -3; y <= 3; y++) {
      const dist = Math.abs(x) + Math.abs(y);
      let rank: number | null = Math.min(20, Math.max(1, baseRank + dist));
      if (baseRank > 15 && dist > 3) rank = 21; // 圏外扱い
      points.push({
        pointX: x,
        pointY: y,
        latitude: 35.665245 + y * 0.0045,
        longitude: 139.712314 + x * 0.0055,
        rank: rank > 20 ? null : rank,
      });
    }
  }
  return points;
}

export function getDemoGridData() {
  const keywords = demoStoreData.keywords;

  const latestSummaries = keywords.map((kw, idx) => {
    let baseRank = 2;
    if (kw.category === 'SUB') baseRank = 5 + (idx % 3);
    if (kw.category === 'EXCLUDED') baseRank = 18;

    const matrix = createGridMatrix(baseRank);
    const ranks = matrix.map((r) => (r.rank === null ? 21 : r.rank));
    const avgRank = Number((ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(1));
    const top3Count = matrix.filter((r) => r.rank !== null && r.rank <= 3).length;
    const top20Count = matrix.filter((r) => r.rank !== null && r.rank <= 20).length;

    return {
      keywordId: kw.id,
      keywordText: kw.keywordText,
      category: kw.category,
      isMain: kw.isMain,
      avgRank,
      top3Count,
      top20Count,
      top10Count: top20Count,
      totalPoints: 49,
      gridMatrix: matrix,
    };
  });

  const previousSummaries = keywords.map((kw, idx) => {
    let baseRank = 3;
    if (kw.category === 'SUB') baseRank = 7 + (idx % 3);
    if (kw.category === 'EXCLUDED') baseRank = 14;

    const matrix = createGridMatrix(baseRank);
    const ranks = matrix.map((r) => (r.rank === null ? 21 : r.rank));
    const avgRank = Number((ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(1));
    const top3Count = matrix.filter((r) => r.rank !== null && r.rank <= 3).length;
    const top20Count = matrix.filter((r) => r.rank !== null && r.rank <= 20).length;

    return {
      keywordId: kw.id,
      keywordText: kw.keywordText,
      category: kw.category,
      isMain: kw.isMain,
      avgRank,
      top3Count,
      top20Count,
      top10Count: top20Count,
      totalPoints: 49,
      gridMatrix: matrix,
    };
  });

  return {
    store: {
      id: demoStoreData.id,
      name: demoStoreData.name,
      targetName: demoStoreData.targetName,
      centerLatitude: demoStoreData.centerLatitude,
      centerLongitude: demoStoreData.centerLongitude,
      address: demoStoreData.address,
    },
    latestRun: {
      runId: "run-latest",
      executedAt: "2026-08-31T10:32:35.000Z",
      summaries: latestSummaries,
    },
    previousRun: {
      runId: "run-previous",
      executedAt: "2026-07-31T10:00:00.000Z",
      summaries: previousSummaries,
    },
    historyRuns: [
      { id: "run-latest", executedAt: "2026-08-31T10:32:35.000Z", gridSize: 7, intervalMeters: 500 },
      { id: "run-previous", executedAt: "2026-07-31T10:00:00.000Z", gridSize: 7, intervalMeters: 500 },
    ],
  };
}
