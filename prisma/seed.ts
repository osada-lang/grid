import 'dotenv/config';
import { prisma } from '../src/lib/db';
import { calculateGridPoints } from '../src/lib/grid';

async function main() {
  console.log('🌱 シードデータの投入を開始します...');

  // 既存データのクリーンアップ
  await prisma.rankResult.deleteMany();
  await prisma.measurementRun.deleteMany();
  await prisma.keyword.deleteMany();
  await prisma.store.deleteMany();
  await prisma.agency.deleteMany();

  // 0. 代理店の作成
  const directAgency = await prisma.agency.create({
    data: {
      id: 'agency-direct-001',
      name: '（直営店）',
    },
  });

  const agencyA = await prisma.agency.create({
    data: {
      id: 'agency-sample-002',
      name: '株式会社マーケティングエージェンシー',
    },
  });

  const agencyB = await prisma.agency.create({
    data: {
      id: 'agency-sample-003',
      name: 'MEOパートナーズ株式会社',
    },
  });

  // 1. 店舗の作成 (固定IDを指定してURLの不一致を防止)
  const store = await prisma.store.create({
    data: {
      id: '193cabe7-f4f4-4fb9-9ee3-9687aaa73480',
      agencyId: directAgency.id,
      name: 'ヘアサロン VOICE 表参道',
      targetName: 'VOICE 表参道',
      centerLatitude: 35.665245,
      centerLongitude: 139.712314,
      address: '東京都港区南青山3-1-1',
      keywords: {
        create: [
          // メインキーワード (3選) - 毎日投稿でガンガン上昇中！
          { keywordText: '子連れ 美容院', category: 'MAIN', isMain: true },
          { keywordText: 'キッズカット', category: 'MAIN', isMain: true },
          { keywordText: '個室 美容室', category: 'MAIN', isMain: true },
          // サブキーワード (5選) - ランダム投稿でじわじわ上昇中！
          { keywordText: '表参道 美容室', category: 'SUB', isMain: false },
          { keywordText: '髪質改善 表参道', category: 'SUB', isMain: false },
          { keywordText: '白髪ぼかし', category: 'SUB', isMain: false },
          { keywordText: 'ヘッドスパ おすすめ', category: 'SUB', isMain: false },
          { keywordText: '前髪カット', category: 'SUB', isMain: false },
          // メインから外したキーワード (2選) - 対策停止でじわじわ順位下落中！
          { keywordText: '表参道 ヘアサロン', category: 'EXCLUDED', isMain: false },
          { keywordText: '南青山 美容院', category: 'EXCLUDED', isMain: false },
        ],
      },
    },
    include: {
      keywords: true,
    },
  });

  // サンプル店舗2（代理店A所属）
  const store2 = await prisma.store.create({
    data: {
      id: 'store-sample-shibuya-002',
      agencyId: agencyA.id,
      name: '渋谷 骨盤整体院 リカバリー',
      targetName: '整体院 リカバリー',
      centerLatitude: 35.658034,
      centerLongitude: 139.701636,
      address: '東京都渋谷区道玄坂1-12-1',
      keywords: {
        create: [
          { keywordText: '渋谷 整体 おすすめ', category: 'MAIN', isMain: true },
          { keywordText: '骨盤矯正 渋谷', category: 'MAIN', isMain: true },
          { keywordText: '肩こり 腰痛 整体', category: 'SUB', isMain: false },
        ],
      },
    },
  });

  // サンプル店舗3（代理店B所属）
  const store3 = await prisma.store.create({
    data: {
      id: 'store-sample-shinjuku-003',
      agencyId: agencyB.id,
      name: '新宿 カフェ＆ワークスペース TERRACE',
      targetName: 'TERRACE 新宿',
      centerLatitude: 35.690921,
      centerLongitude: 139.700258,
      address: '東京都新宿区新宿3-20-1',
      keywords: {
        create: [
          { keywordText: '新宿 カフェ 個室', category: 'MAIN', isMain: true },
          { keywordText: '新宿 コワーキングスペース', category: 'MAIN', isMain: true },
          { keywordText: 'Wi-Fi 電源 カフェ', category: 'SUB', isMain: false },
        ],
      },
    },
  });

  const gridPoints = calculateGridPoints(store.centerLatitude, store.centerLongitude, 7, 500);

  // 2. 過去（前月）の計測データ
  const prevDate = new Date();
  prevDate.setMonth(prevDate.getMonth() - 1);

  const prevRun = await prisma.measurementRun.create({
    data: {
      storeId: store.id,
      executedAt: prevDate,
      gridSize: 7,
      intervalMeters: 500,
      status: 'COMPLETED',
      notes: '前月 定期計測',
    },
  });

  const prevResults: any[] = [];
  gridPoints.forEach((pt, index) => {
    store.keywords.forEach((kw: any) => {
      let rank: number | null = null;
      if (kw.category === 'MAIN') {
        // メイン: 前月は中位〜下位 (12〜16位中心)
        rank = (index % 2 === 0) ? Math.floor(Math.random() * 6) + 10 : Math.floor(Math.random() * 8) + 14;
      } else if (kw.category === 'SUB') {
        // サブ: 前月は16〜20位
        rank = (index % 3 === 0) ? 14 : Math.floor(Math.random() * 5) + 16;
      } else {
        // EXCLUDED (元メイン): 前月は超高順位 (1〜4位中心)
        rank = (index < 35) ? Math.floor(Math.random() * 3) + 1 : 6;
      }

      prevResults.push({
        measurementRunId: prevRun.id,
        keywordId: kw.id,
        pointX: pt.pointX,
        pointY: pt.pointY,
        latitude: pt.latitude,
        longitude: pt.longitude,
        rank,
        rawTitle: 'VOICE 表参道',
      });
    });
  });
  await prisma.rankResult.createMany({ data: prevResults });

  // 3. 今月（最新）の計測データ
  const currRun = await prisma.measurementRun.create({
    data: {
      storeId: store.id,
      executedAt: new Date(),
      gridSize: 7,
      intervalMeters: 500,
      status: 'COMPLETED',
      notes: '今月 最新計測',
    },
  });

  const currResults: any[] = [];
  gridPoints.forEach((pt, index) => {
    store.keywords.forEach((kw: any) => {
      let rank: number | null = null;
      if (kw.category === 'MAIN') {
        // メイン: ガンガン順位上昇！ (1〜5位のグリーン/ブルーが激増!)
        rank = (index < 30) ? Math.floor(Math.random() * 3) + 1 : Math.floor(Math.random() * 4) + 4;
      } else if (kw.category === 'SUB') {
        // サブ: じわじわ上昇！ (10〜14位に改善)
        rank = (index < 25) ? Math.floor(Math.random() * 5) + 9 : Math.floor(Math.random() * 6) + 14;
      } else {
        // EXCLUDED (外した元メイン): 対策停止で順位がじわじわ下落... (9〜15位へダウン)
        rank = (index < 15) ? Math.floor(Math.random() * 4) + 7 : Math.floor(Math.random() * 7) + 12;
      }

      currResults.push({
        measurementRunId: currRun.id,
        keywordId: kw.id,
        pointX: pt.pointX,
        pointY: pt.pointY,
        latitude: pt.latitude,
        longitude: pt.longitude,
        rank,
        rawTitle: 'VOICE 表参道',
      });
    });
  });
  await prisma.rankResult.createMany({ data: currResults });

  console.log(`✅ 店舗 「${store.name}」 と 2回分の計測履歴（前月・今月）を投入しました！`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
