# 365ボイス専用 グリッド順位計測システム 設計計画書 & アーキテクチャ仕様書

本書は、「365ボイス専用 グリッド順位計測システム」の全体設計、マスターアカウント認証、365ボイス本体DB双方向データフロー、GBP Place ID完全一致照合、初回計測比（累計成果）比較、店舗別計測ON/OFF制御、店舗別グリッド間隔カスタマイズ、API計測コスト体系、フルスタックNext.js構成、30日分散スケジュール、キーワード管理・上限・重複防止・ソート順ルール、および将来の再構築・本番移行手順をまとめた仕様書です。

---

## 1. システム概要・目的

* **概要**: 店舗周辺の 7×7 グリッド（計49地点）における指定キーワードのGoogle検索順位を計測し、マップ上への色分け表示・統計算出・初回/前回履歴比較・一括計測ができるWebシステム。
* **専用システム**: 本システムは「**365ボイス専用**」システムとして設計・運用されます。
* **マスターアカウント保護**: 関係者のみがアクセスできるよう、環境変数管理のマスターログイン認証画面（`/login`）とセキュアなCookieセッションを完備。
* **目標規模**: 最大10,000店舗（各店舗最大10キーワード ＝ 計490万地点計測/月）へのスケーリングを視野に入れたアーキテクチャ。

---

## 2. API計測コスト ＆ 料金体系シミュレーション

7×7グリッドでは、**「1キーワード ＝ 49地点（49回検索）」** を消費します。

### ① 【1キーワードあたり】の計測費用一覧

契約するSerpApiのプラン規模によって、1検索あたりの単価および1キーワードの費用が変動します：

| プラン規模 | 1検索の単価 | **1キーワード（49回）の費用** | 3キーワード（147回） | 10キーワード（490回） |
| :--- | :--- | :--- | :--- | :--- |
| **小規模プラン**（月5,000回 / $75） | 約 2.3 円（$0.015） | **約 113 円**（$0.74） | 約 338 円 | 約 1,127 円 |
| **標準プラン**（月15,000回 / $150） | 約 1.5 円（$0.010） | **約 74 円**（$0.49） | 約 220 円 | 約 735 円 |
| **中規模プラン**（月40,000回 / $300） | 約 1.1 円（$0.0075） | **約 55 円**（$0.37） | 約 165 円 | 約 550 円 |
| **大規模エンタープライズ**（月100万回〜） | 約 0.2〜0.3 円（$0.0015） | **約 11〜15 円**（$0.07〜0.10） | 約 33〜45 円 | 約 100〜150 円 |

※為替レート：1ドル＝約150円換算

### ② 店舗数ごとの月額コスト目安（月1回計測・3キーワードの場合）

* **10店舗**: 10店舗 × 147回 ＝ 1,470回/月 → **月額 約 11,250 円（$75プラン）**（1店舗あたり約 1,125円/月）
* **30店舗**: 30店舗 × 147回 ＝ 4,410回/月 → **月額 約 11,250 円（$75プランに収まる）**（1店舗あたり約 375円/月）
* **100店舗**: 100店舗 × 147回 ＝ 14,700回/月 → **月額 約 22,500 円（$150プラン）**（1店舗あたり約 225円/月）
* **1,000店舗〜**: 大口ボリューム割引（Bulk API）適用 → **1店舗あたり約 50〜100 円/月**

---

## 3. マスターアカウント認証 ＆ セキュリティ仕様

関係者のみが安全に利用できるように、**Next.js Middleware によるアクセス制御** を実装しています。

### ① マスターアカウント認証情報（環境変数管理）
* `ADMIN_EMAIL`: `admin@365voice.jp`
* `ADMIN_PASSWORD`: `silver-ringo-815-park`
* `AUTH_SECRET`: セッショントークン暗号化署名用キー
* ※パスワードを変更する際は、Vercelの環境変数を書き換えるだけでいつでも即時変更可能です。

### ② アクセス制御ルール（Middleware）
* **保護されたルート**: `/`（店舗一覧）、`/stores/[storeId]/grid`（ダッシュボード）、`/api/stores` などの全管理ルート。
  * 未ログイン状態でアクセスすると、自動的に `/login` 画面へリダイレクトされます。
  * ログイン成功時、30日間有効な `HttpOnly` セキュアクッキー（`365voice_grid_session`）が発行されます。
* **公開ルート（認証除外）**:
  * `/login`（ログイン画面）
  * `/api/auth/login`, `/api/auth/logout`（認証API）
  * **`/api/cron/measure`**（`cron-job.org` からの自動巡回計測を止めないため、認証ヘッダー `thanx_cron_secret_2026` で独立保護）
  * `/icon.svg`, `/_next`（静的アセット）

---

## 4. 比較分析・順位推移仕様（前回比 ＆ 初回比）

1. **前回比（直前セッション比較）**:
   * 直前の定期計測（前月等）からの改善・下落幅（`▲改善` / `▼下落` / `±0`）を算出。
2. **初回比（施策開始時ベースライン比較）**:
   * その店舗で **「一番最初に計測された初回計測ログ（最古セッション）」** と最新順位を自動照合。
   * **「初回 18.0位 → 今回 5.2位 (累計 ▲ 12.8 アップ！)」** のように、365ボイス導入・MEO対策開始時からの総合的な成果をサマリーカードや比較表に常時表示。
   * 平均順位だけでなく、**TOP3獲得地点数・TOP20獲得地点数の累計成果** も常時表示。

---

## 5. Googleビジネスプロフィール（GBP Place ID）完全一致照合仕様

Googleマップ検索結果から自店舗の順位（1〜20位）を特定する際、以下の優先順位で確実に判定します：

1. **【最優先】`Store.gbpPlaceId`（Place ID完全一致照合）**:
   * Googleマップの各検索結果が持つ固有の `place_id` / `data_id` と、365ボイスに連携されている `gbpPlaceId` を照合。
   * 店舗名に肩書きが付いていたり、英語表記・カタカナ表記が異なっていても、**IDの一致により100%確実に順位を特定** します。
2. **【フォールバック】店舗名照合（表記揺れ吸収）**:
   * まだGBP連携が完了していない店舗（`gbpPlaceId` が未設定）の場合、店舗名（`Store.name`）の空白や記号の揺らぎを自動除去して部分一致照合します。

---

## 6. コストコントロール：店舗別 計測ON/OFFスイッチ仕様

API費用を最適化するため、**店舗ごとに定期・一括計測のON/OFFを個別に切り替え可能** です。

* **`Store.isMeasurementActive`（BOOLEAN, 初期値: `false`）**:
  * **アカウント発行時の初期状態**: **OFF（`false`）**
    * アカウントが作成された直後や施策開始前の段階で、意図せず一括計測が走ってSerpApi費用が消費されるのを完全に防止します。
  * **計測ON（有効・緑色）**: 施策開始時にスイッチをONにすることで、定期巡回や「全店舗 一括計測」の対象となります。
  * **計測OFF（停止・グレー）**: 「全店舗 一括計測」から自動でスキップ・除外され、**API費用が一切発生しなくなります**（過去の履歴データはそのまま安全に閲覧・比較可能です）。

---

## 7. 店舗別グリッド計測範囲（間隔カスタマイズ）仕様

都心部（徒歩商圏）と地方・郊外ロードサイド（車移動商圏）では必要な計測範囲が異なるため、**店舗ごとにグリッド地点間隔（`intervalMeters`）を個別に設定可能** です。

| 商圏タイプ | 設定値（`intervalMeters`） | カバーする全体範囲（直径） | 移動手段の想定 |
| :--- | :--- | :--- | :--- |
| **都心・駅前密集地**（渋谷、銀座等） | **250m 〜 500m**（デフォルト: 500m） | **約 1.5km 〜 3.0km 四方** | 徒歩・自転車圏内 |
| **地方都市・一般住宅街** | **1,000m（1km）** | **約 6.0km 四方** | 自転車・車5分圏内 |
| **郊外・地方・ロードサイド**（国道沿い等） | **2,000m 〜 3,000m（2〜3km）** | **約 12.0km 〜 18.0km 四方** | 車15〜20分圏内 |

* **動作ロジック**: 計測実行時、本システムは `Store.intervalMeters` を自動参照し、店舗ごとの最適範囲で49地点の経緯度を計算して順位を取得・保存します。

---

## 8. 365ボイス本体DBとの完全双方向連携フロー ＆ マスタデータ所有権

### ① データフロー（取得 → 計測 → 返却・保管）

```text
┌──────────────────────────────────────────────────────────────────┐
│                   【365ボイス本体のデータベース】                    │
│   ・代理店マスタ (Agency)                                          │
│   ・店舗マスタ (Store: 緯度経度・住所・gbpPlaceId・ON/OFF)          │
│   ・キーワード情報 (GridKeyword: MAIN/SUB/EXCLUDED)               │
│   ・過去の全計測履歴 (GridMeasurementRun, GridRankResult) 永続保管 │
└──────────────────┬───────────────────────────▲───────────────────┘
                   │ ① 店舗・キーワード取得     │ ③ 計測結果の返却・保存
                   ▼                           │   (過去履歴含め永続保管)
┌──────────────────────────────────────────────┴───────────────────┐
│              【本システム（フルスタック Next.js）】                  │
│   ・マスターログイン画面（/login: 認証セッション保護）               │
│   ・代理店アコーディオン・店舗一覧 (遅延ロード・検索・ON/OFF制御)       │
│   ・7×7 カラーグリッド順位マップ (エメラルド/ライム/オレンジ/グレー)    │
│   ・キーワード編集・管理 (上限枠数・重複防止・ソート順制御)           │
│   ・SerpApi（Googleマップ検索）との通信・49地点の順位計算            │
└──────────────────────────────────────────────────────────────────┘
```

1. **データの取得（入力）**:
   * 365ボイス本体のDBから「店舗情報（店舗名、住所、中心緯度経度、`gbpPlaceId`、計測間隔 `intervalMeters`、計測状態 `isMeasurementActive`）」「登録キーワード」を直接読み込んで計測対象とします。
2. **グリッド計測の実行**:
   * 本システムがGoogle検索（SerpApi）と通信し、49地点の順位を瞬時に算出・取得します（10並列バッチ処理で約10〜15秒で完了）。
3. **計測結果の返却 ＆ 過去履歴の永続保管（出力・保存）**:
   * 計測した最新の49地点の順位結果（`GridMeasurementRun`, `GridRankResult`）を、**「365ボイス本体のDB」に直接書き込んで返却・保存**します。
   * これまでの **「過去の全計測セッション履歴」もすべて「365ボイスのDB」内に累積して永続保管（上書き・削除なし）** されます。

---

### ② 365ボイス側アカウント発行画面での必要項目（3項目のみ）

アカウント発行画面で必要な項目は以下の **3項目のみ** です：

1. **住所**（入力時に自動で経緯度 `centerLatitude` / `centerLongitude` に変換・保存）
2. **グリッド計測の幅**（`intervalMeters`: デフォルト 500m）
3. **初期計測キーワード**（`GridKeyword`: メイン最大3件 / サブ最大5件）

※ `isMeasurementActive` はアカウント発行時に自動で `false`（OFF）で保存されます。
※ `gbpPlaceId` はGBP連携完了時に自動で保存されます。

---

## 9. 10,000店舗（月1回計測）スケール戦略

1. **30日分散スケジュール**: 1万店舗の月1回計測を30日間に分散（1日あたり約333店舗のみ計測）。
2. **非同期遅延ロード（Lazy Loading） ＆ サーバーサイド検索**: 代理店アコーディオン展開時に店舗データを動的取得。画面初期表示が 0.1秒未満 で完了。
3. **位置座標・クエリの重複排除（デデュプリケーション）**: 同一エリアの複数店舗が同じキーワードで計測される場合、1回のGoogle Maps API実行結果を共有。

---

## 10. キーワード枠数・重複防止・並び順仕様

* **★ メイン (MAIN)**: 最大 3 件
* **サブ (SUB)**: 最大 5 件
* **最近外したワード (EXCLUDED)**: 最大 2 件
* 同一店舗内での重複キーワード登録・更新を完全ブロック。
* 並び順は常に上から「★ メイン」→「サブ」→「最近外したワード」の順に自動整列。

---

## 11. データベース構造（ER設計・インデックス）

### スキーマ定義 (`prisma/schema.prisma`)

```prisma
datasource db {
  provider = "postgresql"
}

generator client {
  provider = "prisma-client-js"
}

// 代理店グループ
model Agency {
  id           String    @id
  name         String
  contactEmail String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime?
  stores       Store[]
}

// 店舗情報
model Store {
  id                  String               @id
  name                String
  storeSlug           String
  area                String?
  industry            String?
  targetName          String?              // マッチング判定用店舗名
  centerLatitude      Float?
  centerLongitude     Float?
  gbpPlaceId          String?              // Googleビジネスプロフィール Place ID
  intervalMeters      Int                  @default(500) // グリッド間隔（メートル）
  isMeasurementActive Boolean              @default(false) // 計測ON/OFF（初期値: OFF）
  agencyId            String?
  agency              Agency?              @relation(fields: [agencyId], references: [id])
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt
  gridKeywords        GridKeyword[]
  gridMeasurementRuns GridMeasurementRun[]

  @@index([agencyId])
}

// 計測キーワード
model GridKeyword {
  id              String           @id @default(uuid())
  storeId         String
  keywordText     String
  category        String           @default("SUB") // MAIN, SUB, EXCLUDED
  isMain          Boolean          @default(false)
  isActive        Boolean          @default(true)
  createdAt       DateTime         @default(now())
  store           Store            @relation(fields: [storeId], references: [id], onDelete: Cascade)
  gridRankResults GridRankResult[]

  @@index([storeId])
}

// 計測セッションヘッダー（履歴保持）
model GridMeasurementRun {
  id              String           @id @default(uuid())
  storeId         String
  executedAt      DateTime         @default(now())
  gridSize        Int              @default(7) // 7x7
  intervalMeters  Int              @default(500) // 500m
  status          String           @default("COMPLETED") // COMPLETED, FAILED, IN_PROGRESS
  notes           String?
  store           Store            @relation(fields: [storeId], references: [id], onDelete: Cascade)
  gridRankResults GridRankResult[]

  @@index([storeId])
}

// 地点別順位結果
model GridRankResult {
  id                 String             @id @default(uuid())
  measurementRunId   String
  keywordId          String
  pointX             Int                // -3 ~ +3
  pointY             Int                // -3 ~ +3
  latitude           Float
  longitude          Float
  rank               Int?               // 順位 1~20 (nullは圏外)
  rawTitle           String?
  createdAt          DateTime           @default(now())
  gridMeasurementRun GridMeasurementRun @relation(fields: [measurementRunId], references: [id], onDelete: Cascade)
  gridKeyword        GridKeyword        @relation(fields: [keywordId], references: [id], onDelete: Cascade)

  @@index([measurementRunId])
  @@index([keywordId])
}
```

---

## 12. UI/UX 仕様・カラーコード規則

* **1〜3位**: エメラルドグリーン (`bg-emerald-500 text-white font-extrabold`)
* **4〜10位**: ライトグリーン / イエロー (`bg-lime-400 text-slate-900 font-bold`)
* **11〜20位**: オレンジ (`bg-orange-500 text-white font-bold`)
* **21位以上 / 圏外**: グレー (`bg-slate-300 text-slate-600`)
* **平均順位表示ルール**: 圏外時は「21位」ではなく「**21位以下**」と明確に表示。
