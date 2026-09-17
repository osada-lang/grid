export interface GridPoint {
  pointX: number; // -3 to +3
  pointY: number; // -3 to +3
  latitude: number;
  longitude: number;
}

/**
 * 店舗の中心緯度・経度から grid_size x grid_size の緯度経度グリッドを算出
 * @param centerLat 中心緯度
 * @param centerLng 中心経度
 * @param gridSize グリッド一辺の要素数 (例: 7 -> 7x7=49地点)
 * @param intervalMeters 地点間の距離 (メートル、デフォルト 500m)
 */
export function calculateGridPoints(
  centerLat: number,
  centerLng: number,
  gridSize: number = 7,
  intervalMeters: number = 500
): GridPoint[] {
  const points: GridPoint[] = [];
  const half = Math.floor(gridSize / 2);

  // 1度あたりのメートル数近似値
  const metersPerLatDegree = 111000;
  const radLat = (centerLat * Math.PI) / 180;
  const metersPerLngDegree = 111000 * Math.cos(radLat);

  for (let y = half; y >= -half; y--) { // 上(北)から下(南)へ
    for (let x = -half; x <= half; x++) { // 左(西)から右(東)へ
      const latOffset = (y * intervalMeters) / metersPerLatDegree;
      const lngOffset = (x * intervalMeters) / metersPerLngDegree;

      points.push({
        pointX: x,
        pointY: y,
        latitude: Number((centerLat + latOffset).toFixed(6)),
        longitude: Number((centerLng + lngOffset).toFixed(6)),
      });
    }
  }

  return points;
}
