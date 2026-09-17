# 365ボイス専用 グリッド順位計測システム 設計計画書 & アーキテクチャ仕様書

本書は、「365ボイス専用 グリッド順位計測システム」の全体設計、365ボイス本体DB双方向データフロー、フルスタックNext.js構成、30日分散スケジュール、キーワード管理・上限・重複防止・ソート順ルール、および将来の再構築・本番移行手順をまとめた仕様書です。

---

## 1. システム概要・目的

* **概要**: 店舗周辺の 7×7 グリッド（計49地点）における指定キーワードのGoogle検索順位を計測し、マップ上への色分け表示・統計算出・過去履歴比較・一括計測ができるWebシステム。
* **専用システム**: 本システムは「**365ボイス専用**」システムとして設計・運用されます。
* **目標規模**: 最大10,000店舗（各店舗最大10キーワード ＝ 計490万地点計測/月）へのスケーリングを視野に入れたアーキテクチャ。
* **本番仕様の徹底**: 試作・デモ用のダミーフォールバックやシミュレーション係数は完全に撤廃され、365ボイス本体DBの実データのみを扱うクリーンな設計です。

---

## 2. 365ボイス本体DBとの完全双方向連携フロー ＆ マスタデータ所有権

### ① データフロー（取得 → 計測 → 返却・保管）

```text
┌──────────────────────────────────────────────────────────────────┐
│                   【365ボイス本体のデータベース】                    │
│   ・代理店マスタ (Agency)                                          │
│   ・店舗マスタ (Store: 緯度経度・住所・判定テキスト)                  │
│   ・キーワード情報 (Keyword: MAIN/SUB/EXCLUDED)                   │
│   ・過去の全計測履歴 (MeasurementRun, RankResult) 永続保管          │
└──────────────────┬───────────────────────────▲───────────────────┘
                   │ ① 店舗・キーワード取得     │ ③ 計測結果の返却・保存
                   ▼                           │   (過去履歴含め永続保管)
┌──────────────────────────────────────────────┴───────────────────┐
│              【本システム（フルスタック Next.js）】                  │
│   ・代理店アコーディオン・店舗一覧 (非同期遅延ロード ＆ 検索)          │
│   ・7×7 カラーグリッド順位マップ (エメラルド/ライム/オレンジ/グレー)    │
│   ・キーワード編集・管理 (上限枠数・重複防止・ソート順制御)           │
│   ・SerpApi（Googleマップ検索）との通信・49地点の順位計算            │
└──────────────────────────────────────────────────────────────────┘
```

1. **データの取得（入力）**:
   * 365ボイス本体のDBから「店舗情報（店舗名、住所、中心緯度経度）」「代理店名」「登録キーワード」を直接読み込んで計測対象とします。
2. **グリッド計測の実行**:
   * 本システムがGoogle検索（SerpApi）と通信し、49地点の順位を瞬時に算出・取得します。
3. **計測結果の返却 ＆ 過去履歴の永続保管（出力・保存）**:
   * 計測した最新の49地点の順位結果（`MeasurementRun`, `RankResult`）を、**「365ボイス本体のDB」に直接書き込んで返却・保存**します。
   * これまでの **「過去の全計測セッション履歴（先月、先々月...）」もすべて「365ボイスのDB」内に累積して永続保管（上書き・削除なし）** されます。

---

### ② マスタデータの所有権とUIの役割分担

* **365ボイス本体側がマスター管理**:
  * 「代理店（Agency）」および「店舗基本情報（Store）」の新規登録・契約管理・編集・削除は、**365ボイス本体側の管理画面・DB** で一元管理されます。
* **本グリッド計測システムのUI仕様**:
  * 本番運用において、本システム上の「代理店追加」「新規店舗登録」ボタンは不要（365ボイスDBからの自動同期・読み込みのみ）となります。
* **本システムが担当する機能**:
  * 365ボイスから読み込んだ店舗に対する **「キーワードの管理・編集（MAIN/SUB/EXCLUDEDのカテゴリ変更・追加・削除）」** および **「49地点の順位計測実行・7×7カラーグリッドマップ表示・過去履歴比較」** に特化します。

---

## 3. システム形態（フルスタック Next.js 完結構成）

* 別途バックエンド専用サーバー（LaravelやRails、Django等）を用意する必要はありません。
* Next.js単体でフロントエンド画面表示・API処理・SerpApi通信・365ボイスDB連携のすべてを完結させます。
* データベース接続URL（`DATABASE_URL`）やAPIキー（`SERPAPI_KEY`）は環境変数として安全に管理します（環境変数を保管するためのDBは一切不要で、ホスティング環境の設定欄で管理します）。

---

## 4. 10,000店舗（月1回計測）スケール戦略

### ① 30日分散スケジュールの具体的な動作イメージ

1万店舗の月1回計測を同日に集中させず、30日間にわたって毎日均等に自動分散（1日あたり約333店舗のみ計測）して処理します。

* **1日目（毎月1日）**: 店舗 No. 1 〜 333 を自動計測
* **2日目（毎月2日）**: 店舗 No. 334 〜 666 を自動計測（334店舗目以降をここに分散）
* **3日目（毎月3日）**: 店舗 No. 667 〜 1,000 を自動計測
* …
* **30日目（毎月30日）**: 店舗 No. 9,668 〜 10,000 を自動計測

* **メリット**:
  * すべての店舗が **「毎月決まった日に月1回」** 確実に最新順位へ更新されます。
  * 1日の計測量が常に「約333店舗分」に固定されるため、サーバー負荷スパイクやデータベースロック（`SQLITE_BUSY`等）を完全に回避し、常に安定稼働します。

### ② 非同期遅延ロード（Lazy Loading） ＆ サーバーサイド検索
* トップ画面では1万店舗のデータを一括取得せず、代理店アコーディオンが開かれた時に該当代理店の店舗のみAPI（`/api/stores?agencyId=...`）から動的フェッチ。画面初期表示が 0.1秒未満 で完了。

### ③ 位置座標・クエリの重複排除（デデュプリケーション）
* 同一エリア（例：表参道、渋谷）の複数店舗が同じキーワードで計測される場合、1回のGoogle Maps API実行結果（上位20件リスト）から複数店舗の順位を同時に抽出して保存。APIリクエスト数と費用を最大 50%〜90% 削減可能。

---

## 5. キーワード枠数・重複防止・並び順仕様

### ① カテゴリ別枠数上限
店舗ごとに登録可能なキーワードには、カテゴリごとに厳格な上限数が設定されています：

| カテゴリ | 上限数 | 役割・特徴 | UI表示 |
| :--- | :--- | :--- | :--- |
| **★ メイン (MAIN)** | **最大 3 件** | 最重要キーワード。施策の中心として日々順位をトラッキング。 | `★ メイン (X/3)` |
| **サブ (SUB)** | **最大 5 件** | 関連キーワード。複合語や周辺ワードの順位をモニタリング。 | `サブ (X/5)` |
| **最近外したワード (EXCLUDED)** | **最大 2 件** | 過去に対策から外したワード。施策停止に伴う下落影響を観測。 | `最近外したワード (X/2)` |

### ② 同一店舗内の重複登録防止
* 同じ店舗内で全く同じキーワード（例: メインに「子連れ 美容院」がある状態で、サブに「子連れ 美容院」を追加）を登録・更新することはできません。
* 重複するキーワードを追加または変更しようとした場合、「キーワード『○○』は既に登録されています。重複して登録することはできません。」と明確なエラーメッセージを表示してブロックします。

### ③ 表示順序（並び順）の統一ルール
* カテゴリの変更（メイン→サブ、サブ→メイン、最近外したワードへの移動など）を行っても、画面上のキーワード一覧やテーブル、モーダル内の並び順は、常に **上から「★ メイン」→「サブ」→「最近外したワード」** の順序で美しく自動整理されて表示されます。

### ④ 新規追加時の案内ガイダンス
* 新規キーワードを追加した際、画面上部およびモーダル内に **「新規キーワード『○○』を追加しました。右上の『今すぐ計測実行』ボタンを押すと最新の順位グリッドが生成されます。」** と分かりやすい案内メッセージを表示します。

---

## 6. データベース構造（ER設計・インデックス）

### スキーマ定義 (`prisma/schema.prisma`)

```prisma
datasource db {
  provider = "sqlite" // 本番環境では "postgresql" に変更
}

generator client {
  provider = "prisma-client-js"
}

// 代理店グループ
model Agency {
  id        String   @id @default(uuid())
  name      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  stores    Store[]
}

// 店舗情報
model Store {
  id               String           @id @default(uuid())
  agencyId         String
  name             String
  centerLatitude   Float
  centerLongitude  Float
  targetName       String           // Googleマップ検索判定用店舗名
  address          String?
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt
  agency           Agency           @relation(fields: [agencyId], references: [id], onDelete: Cascade)
  keywords         Keyword[]
  measurementRuns MeasurementRun[]

  @@index([agencyId])
}

// 計測キーワード
model Keyword {
  id          String       @id @default(uuid())
  storeId     String
  keywordText String
  category    String       @default("SUB") // MAIN, SUB, EXCLUDED
  isMain      Boolean      @default(false)
  isActive    Boolean      @default(true)
  createdAt   DateTime     @default(now())
  store       Store        @relation(fields: [storeId], references: [id], onDelete: Cascade)
  rankResults RankResult[]

  @@index([storeId])
}

// 計測セッションヘッダー（履歴保持）
model MeasurementRun {
  id             String       @id @default(uuid())
  storeId        String
  executedAt     DateTime     @default(now())
  gridSize       Int          @default(7) // 7x7
  intervalMeters Int          @default(500) // 500m
  status         String       @default("COMPLETED") // COMPLETED, FAILED, IN_PROGRESS
  notes          String?
  store          Store        @relation(fields: [storeId], references: [id], onDelete: Cascade)
  rankResults    RankResult[]

  @@index([storeId])
}

// 地点別順位結果
model RankResult {
  id               String         @id @default(uuid())
  measurementRunId String
  keywordId        String
  pointX           Int            // -3 ~ +3
  pointY           Int            // -3 ~ +3
  latitude         Float
  longitude        Float
  rank             Int?           // 順位 1~20 (nullは圏外/21位以上)
  rawTitle         String?
  createdAt        DateTime       @default(now())
  measurementRun   MeasurementRun @relation(fields: [measurementRunId], references: [id], onDelete: Cascade)
  keyword          Keyword        @relation(fields: [keywordId], references: [id], onDelete: Cascade)

  @@index([measurementRunId])
  @@index([keywordId])
}
```

---

## 7. UI/UX 仕様・カラーコード規則

### グリッド順位マップ色分け規則
* **1〜3位**: エメラルドグリーン (`bg-emerald-500 text-white font-extrabold`)
* **4〜10位**: ライトグリーン / イエロー (`bg-lime-400 text-slate-900 font-bold`)
* **11〜20位**: オレンジ (`bg-orange-500 text-white font-bold`)
* **21位以上 / 圏外**: グレー (`bg-slate-300 text-slate-600`)

### 画面一覧 & 操作機能
1. **トップ画面 (`/`)**:
   * 代理店一覧（アコーディオン形式）
   * 展開時の「非同期・遅延ロード（Lazy Loading）」による店舗一覧表示
   * リアルタイム サーバーサイド検索バー（店舗名・判定名・住所・キーワード）
   * 全店舗 一括計測実行ボタン
2. **店舗グリッドダッシュボード (`/stores/[storeId]/grid`)**:
   * 店舗ヘッダー ＆ 「今すぐ計測実行」ボタン
   * **キーワード編集・管理モーダル**: 全キーワードの追加・テキスト編集・削除・カテゴリ変更（上限バッジ ＆ 重複防止 ＆ 自動ソート）
   * **ワンクリック移動ボタン**: 「このワードを『最近外したワード』に移す」「★ メインに戻す」
   * キーワード切替タブ（★MAIN / サブ / 最近外したワード）
   * 統計サマリーカード（平均順位, TOP3地点数, TOP20地点数, 前回比 ▲/▼ 改善差分）
   * 7×7 グリッドマップ（色分け・中心ピン・ホバー詳細）
   * ワード別 比較レポートテーブル（PC・スマホ対応）
   * 過去計測セッションの履歴切り替えドロップダウン

---

## 8. セットアップ & 本番移行手順

### 開発環境のセットアップ
```bash
# 1. 依存関係のインストール
npm install

# 2. データベースの初期化・同期
npx prisma db push --accept-data-loss

# 3. 初期シードデータの投入（直営店・代理店・サンプル店舗・前月/今月計測データ）
npx tsx prisma/seed.ts

# 4. 開発サーバーの起動
npm run dev
```

### 本番環境（365ボイス本体 PostgreSQL DB 共有）への移行手順
1. `prisma/schema.prisma` の `datasource db` を以下のように変更：
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Netlify / Vercel などのホスティング管理画面の環境変数（Environment Variables）に設定：
   ```env
   DATABASE_URL="postgresql://user:password@365voice-db.com:5432/main?schema=public"
   SERPAPI_KEY="your_serpapi_key"
   ```
3. 365ボイス本体DBへテーブル同期（マイグレーション）：
   ```bash
   npx prisma db push
   ```
   これで、365ボイス本体のDBから店舗情報が自動取得され、計測結果や過去ログがすべて365ボイス本体DBに保存されるようになります。
