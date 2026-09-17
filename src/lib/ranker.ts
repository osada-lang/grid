import { GridPoint } from './grid';

export interface RankFetchResult {
  latitude: number;
  longitude: number;
  pointX: number;
  pointY: number;
  rank: number | null; // 1~20, 21以上/未検出は null
  rawTitle?: string;
}

/**
 * 1地点におけるキーワードでのGoogleマップ/ローカル検索順位を取得
 */
export async function fetchRankAtPoint(
  keyword: string,
  point: GridPoint,
  targetName: string,
  options?: { mockTrendFactor?: number } // モック時の改善幅調整 (例: 1.0 = 通常, 1.2 = 前より良くなる)
): Promise<RankFetchResult> {
  const serpApiKey = process.env.SERPAPI_KEY;

  if (serpApiKey) {
    try {
      // SerpApi Google Maps Local Search API
      const url = new URL('https://serpapi.com/search.json');
      url.searchParams.set('engine', 'google_maps');
      url.searchParams.set('q', keyword);
      url.searchParams.set('ll', `@${point.latitude},${point.longitude},15z`);
      url.searchParams.set('google_domain', 'google.co.jp');
      url.searchParams.set('hl', 'ja');
      url.searchParams.set('gl', 'jp');
      url.searchParams.set('api_key', serpApiKey);

      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new Error(`SerpApi error: ${res.statusText}`);
      }

      const data = await res.json();
      const localResults: Array<{ position: number; title: string }> = data.local_results || [];

      // targetName に部分一致する店舗を検索
      const match = localResults.find((item) =>
        item.title.toLowerCase().includes(targetName.toLowerCase())
      );

      return {
        latitude: point.latitude,
        longitude: point.longitude,
        pointX: point.pointX,
        pointY: point.pointY,
        rank: match ? match.position : null,
        rawTitle: match ? match.title : undefined,
      };
    } catch (error) {
      console.error('SerpApi Error, fallback to mock generation:', error);
    }
  }

  // モックモード（APIキー未設定時）
  // 中心 (0,0) からの距離（グリッド上の距離）
  const dist = Math.sqrt(point.pointX * point.pointX + point.pointY * point.pointY);
  
  // トレンド因子 (モック時に前回計測からの改善などをシミュレート)
  const trend = options?.mockTrendFactor ?? 1.0;

  // 基本順位の決定 (中心に近いほど上位)
  const baseRank = Math.round(dist * 3.5 + 1); // 0km = 1位, 離れるほどダウン
  
  // キーワード文字列によるハッシュ的ばらつきを加算
  let hash = 0;
  for (let i = 0; i < keyword.length; i++) {
    hash += keyword.charCodeAt(i);
  }
  const kwOffset = (hash % 5) - 2; // -2 ~ +2
  
  // ノイズ（±1）
  const noise = Math.floor(Math.random() * 3) - 1;

  let calculatedRank = Math.round((baseRank + kwOffset + noise) / trend);

  // 範囲制限: 1位〜20位。それ以上は圏外(null)
  if (calculatedRank < 1) calculatedRank = 1;
  const finalRank = calculatedRank > 20 ? null : calculatedRank;

  return {
    latitude: point.latitude,
    longitude: point.longitude,
    pointX: point.pointX,
    pointY: point.pointY,
    rank: finalRank,
    rawTitle: `${targetName} (モック表示)`,
  };
}
