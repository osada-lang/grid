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
 * （GBP Place IDがある場合はID完全一致で優先判定、未設定時は店舗名で自動照合）
 */
export async function fetchRankAtPoint(
  keyword: string,
  point: GridPoint,
  targetName: string,
  placeId?: string | null
): Promise<RankFetchResult> {
  const serpApiKey = process.env.SERPAPI_KEY;

  if (!serpApiKey) {
    throw new Error('SERPAPI_KEY が設定されていません。Vercelまたは環境変数に有効なAPIキーを設定してください。');
  }

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
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Googleマップ順位取得APIエラー (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const localResults: Array<{
    position: number;
    title: string;
    place_id?: string;
    data_id?: string;
    place_id_search?: string;
  }> = data.local_results || [];

  let match: { position: number; title: string } | undefined;

  // 1. 【最優先】Googleビジネスプロフィール Place ID で完全一致照合
  if (placeId && placeId.trim() !== '') {
    const cleanPlaceId = placeId.trim();
    match = localResults.find((item) =>
      item.place_id === cleanPlaceId ||
      item.data_id === cleanPlaceId ||
      item.place_id_search?.includes(cleanPlaceId)
    );
  }

  // 2. 【フォールバック】Place IDで未検出、または未設定時は店舗名（表記揺れ吸収）で照合
  if (!match) {
    const normTarget = normalizeText(targetName);
    match = localResults.find((item) => {
      const normTitle = normalizeText(item.title || '');
      return normTitle.includes(normTarget) || normTarget.includes(normTitle);
    });
  }

  return {
    latitude: point.latitude,
    longitude: point.longitude,
    pointX: point.pointX,
    pointY: point.pointY,
    rank: match ? match.position : null,
    rawTitle: match ? match.title : undefined,
  };
}
