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
 * 空白や大文字小文字を正規化して比較するヘルパー関数
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s\u3000\-_・]/g, '') // 半角・全角スペースやハイフン、中黒を除去
    .trim();
}

/**
 * 1地点におけるキーワードでのGoogleマップ/ローカル検索順位を取得
 */
export async function fetchRankAtPoint(
  keyword: string,
  point: GridPoint,
  targetName: string,
  options?: { mockTrendFactor?: number }
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
        throw new Error(`SerpApi HTTP error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      const localResults: Array<{ position: number; title: string }> = data.local_results || [];

      // targetName に部分一致する店舗を検索（空白・記号の揺らぎを吸収）
      const normTarget = normalizeText(targetName);
      const match = localResults.find((item) => {
        const normTitle = normalizeText(item.title || '');
        return normTitle.includes(normTarget) || normTarget.includes(normTitle);
      });

      return {
        latitude: point.latitude,
        longitude: point.longitude,
        pointX: point.pointX,
        pointY: point.pointY,
        rank: match ? match.position : null,
        rawTitle: match ? match.title : undefined,
      };
    } catch (error: any) {
      console.warn(`SerpApi rank fetch error for "${keyword}" at (${point.latitude}, ${point.longitude}):`, error.message);
    }
  }

  // モックモード（APIキー未設定時またはエラー時の自動フォールバック）
  const dist = Math.sqrt(point.pointX * point.pointX + point.pointY * point.pointY);
  const trend = options?.mockTrendFactor ?? 1.0;
  const baseRank = Math.round(dist * 3.5 + 1);
  
  let hash = 0;
  for (let i = 0; i < keyword.length; i++) {
    hash += keyword.charCodeAt(i);
  }
  const kwOffset = (hash % 5) - 2;
  const noise = Math.floor(Math.random() * 3) - 1;

  let calculatedRank = Math.round((baseRank + kwOffset + noise) / trend);
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
