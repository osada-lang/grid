'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  MapPin,
  RefreshCw,
  Award,
  Target,
  BarChart2,
  ChevronDown,
  Info,
  CheckCircle,
  Clock,
  Edit3,
  Trash2,
  Plus,
  X,
  Tag,
  ArrowRightLeft,
} from 'lucide-react';

interface GridPointResult {
  pointX: number;
  pointY: number;
  latitude: number;
  longitude: number;
  rank: number | null;
}

interface KeywordSummary {
  keywordId: string;
  keywordText: string;
  category?: string;
  isMain?: boolean;
  avgRank: number;
  top3Count: number;
  top20Count: number;
  top10Count?: number;
  totalPoints: number;
  gridMatrix: GridPointResult[];
}

interface RunData {
  runId: string;
  executedAt: string;
  summaries: KeywordSummary[];
}

interface HistoryRun {
  id: string;
  executedAt: string;
  gridSize: number;
  intervalMeters: number;
}

interface StoreData {
  id: string;
  name: string;
  targetName: string;
  centerLatitude: number;
  centerLongitude: number;
  address?: string | null;
}

interface KeywordItem {
  id: string;
  keywordText: string;
  category: string;
  isMain: boolean;
  isActive: boolean;
}

export default function GridDashboard({
  storeId,
  initialData,
}: {
  storeId: string;
  initialData?: {
    store: StoreData;
    latestRun: RunData | null;
    previousRun: RunData | null;
    historyRuns: HistoryRun[];
  } | null;
}) {
  const router = useRouter();

  const [data, setData] = useState<{
    store: StoreData;
    latestRun: RunData | null;
    previousRun: RunData | null;
    historyRuns: HistoryRun[];
  } | null>(initialData || null);

  const [loading, setLoading] = useState(!initialData);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [selectedKeywordIndex, setSelectedKeywordIndex] = useState<number>(0);
  const [keywordFilter, setKeywordFilter] = useState<'main' | 'sub' | 'excluded'>('main');
  const [showHistory, setShowHistory] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // キーワード編集モーダル状態
  const [isEditingKeywords, setIsEditingKeywords] = useState(false);
  const [storeKeywords, setStoreKeywords] = useState<KeywordItem[]>([]);
  const [loadingKeywords, setLoadingKeywords] = useState(false);
  const [newKeywordText, setNewKeywordText] = useState('');
  const [newKeywordCategory, setNewKeywordCategory] = useState<'MAIN' | 'SUB' | 'EXCLUDED'>('MAIN');
  const [keywordSaving, setKeywordSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);

  const handleSetKeywordFilter = (filter: 'main' | 'sub' | 'excluded') => {
    setKeywordFilter(filter);
    if (!latestRun) return;
    const currentKw = latestRun.summaries[selectedKeywordIndex];
    if (!currentKw) return;
    const currentCat = getCat(currentKw, selectedKeywordIndex);
    let isMatch = false;
    if (filter === 'main' && currentCat === 'MAIN') isMatch = true;
    if (filter === 'sub' && currentCat === 'SUB') isMatch = true;
    if (filter === 'excluded' && currentCat === 'EXCLUDED') isMatch = true;

    if (!isMatch) {
      const firstIdx = latestRun.summaries.findIndex((kw, idx) => {
        const cat = getCat(kw, idx);
        if (filter === 'main') return cat === 'MAIN';
        if (filter === 'sub') return cat === 'SUB';
        if (filter === 'excluded') return cat === 'EXCLUDED';
        return false;
      });
      if (firstIdx !== -1) {
        setSelectedKeywordIndex(firstIdx);
      }
    }
  };

  const [activeRunId, setActiveRunId] = useState<string | null>(
    initialData?.latestRun?.runId || null
  );

  const handleSelectKeyword = (idx: number) => {
    setSelectedKeywordIndex(idx);
    const element = document.getElementById('grid-map-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const getCat = (k: { category?: string; isMain?: boolean }, i: number): 'MAIN' | 'SUB' | 'EXCLUDED' => {
    if (k.category === 'MAIN') return 'MAIN';
    if (k.category === 'SUB') return 'SUB';
    if (k.category === 'EXCLUDED') return 'EXCLUDED';
    if (k.isMain) return 'MAIN';
    // フォールバック（インデックスで確定判別）
    if (i < 3) return 'MAIN';
    if (i < 8) return 'SUB';
    return 'EXCLUDED';
  };

  const fetchData = async (targetRunId?: string) => {
    try {
      if (!data) setLoading(true);
      setFetchError(null);
      const url = targetRunId
        ? `/api/stores/${storeId}/grid-results?runId=${targetRunId}&t=${Date.now()}`
        : `/api/stores/${storeId}/grid-results?t=${Date.now()}`;

      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || `HTTPエラー: ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      if (json.latestRun) {
        setActiveRunId(json.latestRun.runId);
      }
    } catch (err: any) {
      console.error(err);
      if (!data) setFetchError(err.message || 'データ取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [storeId]);

  // 店舗のキーワード一覧を取得
  const fetchStoreKeywords = async () => {
    try {
      setLoadingKeywords(true);
      setModalError(null);
      const res = await fetch(`/api/stores/${storeId}/keywords?t=${Date.now()}`);
      if (!res.ok) throw new Error('キーワードの取得に失敗しました');
      const json = await res.json();
      const list: KeywordItem[] = json.keywords || [];
      const getOrder = (cat: string) => (cat === 'MAIN' ? 1 : cat === 'SUB' ? 2 : cat === 'EXCLUDED' ? 3 : 4);
      list.sort((a, b) => getOrder(a.category) - getOrder(b.category));
      setStoreKeywords(list);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingKeywords(false);
    }
  };

  // ワンクリックでカテゴリーを変更（最近外したワードへの移動など）
  const handleQuickMoveCategory = async (keywordId: string, newCategory: 'MAIN' | 'SUB' | 'EXCLUDED') => {
    try {
      setKeywordSaving(true);
      setModalError(null);
      const res = await fetch(`/api/stores/${storeId}/keywords`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywordId, category: newCategory }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'カテゴリーの変更に失敗しました');
      }
      const catLabel =
        newCategory === 'EXCLUDED'
          ? '「最近外したワード」'
          : newCategory === 'MAIN'
          ? '「★ メイン」'
          : '「サブ」';
      setMessage(`キーワードのカテゴリを${catLabel}に変更しました！`);
      await fetchData();
      if (isEditingKeywords) {
        await fetchStoreKeywords();
      }
      router.refresh();
    } catch (err: any) {
      setModalError(err.message);
      alert(err.message);
    } finally {
      setKeywordSaving(false);
    }
  };

  // キーワードの新規追加
  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeywordText.trim()) return;

    try {
      setKeywordSaving(true);
      setModalError(null);
      const res = await fetch(`/api/stores/${storeId}/keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywordText: newKeywordText.trim(),
          category: newKeywordCategory,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'キーワードの追加に失敗しました');
      }
      const addedText = newKeywordText.trim();
      setNewKeywordText('');
      const successNotice = `新規キーワード「${addedText}」を追加しました。右上の『今すぐ計測実行』ボタンを押すと最新の順位グリッドが生成されます。`;
      setMessage(successNotice);
      setModalSuccess(successNotice);
      await fetchStoreKeywords();
      await fetchData();
      router.refresh();
    } catch (err: any) {
      setModalError(err.message);
      alert(err.message);
    } finally {
      setKeywordSaving(false);
    }
  };

  // キーワードの削除
  const handleDeleteKeyword = async (keywordId: string, text: string) => {
    if (!confirm(`キーワード「${text}」を削除しますか？`)) return;

    try {
      setKeywordSaving(true);
      const res = await fetch(`/api/stores/${storeId}/keywords?keywordId=${keywordId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('キーワードの削除に失敗しました');
      setMessage(`キーワード「${text}」を削除しました。`);
      await fetchStoreKeywords();
      await fetchData();
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setKeywordSaving(false);
    }
  };

  // 今すぐ計測実行
  const handleManualMeasure = async () => {
    try {
      setMeasuring(true);
      setMessage(null);
      const res = await fetch('/api/measure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, mockTrendFactor: 1.15 }),
      });

      if (!res.ok) throw new Error('計測の実行に失敗しました');
      setMessage('新しい計測を実行し、データベースに新規履歴として追加保存しました！');
      
      await fetchData();
      router.refresh();
    } catch (err: any) {
      setMessage(`エラー: ${err.message}`);
    } finally {
      setMeasuring(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="flex items-center space-x-3 text-indigo-600 font-medium">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span>グリッド順位計測データを読み込み中...</span>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center max-w-md space-y-4">
          <p className="text-rose-600 font-semibold">{fetchError}</p>
          <button
            onClick={() => fetchData()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer"
          >
            再読み込みする
          </button>
        </div>
      </div>
    );
  }

  if (!data || !data.store) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center max-w-md">
          <p className="text-gray-600">店舗データが見つかりませんでした。</p>
        </div>
      </div>
    );
  }

  const { store, latestRun, previousRun, historyRuns } = data;

  const currentRun = latestRun;
  const currentKeyword =
    currentRun?.summaries[selectedKeywordIndex] ||
    currentRun?.summaries[0];

  const currentCat = currentKeyword ? getCat(currentKeyword, selectedKeywordIndex) : 'MAIN';

  const previousKeyword = previousRun?.summaries.find(
    (s) => s.keywordText === currentKeyword?.keywordText || s.keywordId === currentKeyword?.keywordId
  );

  const calcDiff = (curr?: number, prev?: number, isLowerBetter = true) => {
    if (curr === undefined || prev === undefined) return null;
    const diff = Number((curr - prev).toFixed(1));
    if (diff === 0) return { diff: 0, status: 'neutral', text: '±0' };

    const isImproved = isLowerBetter ? diff < 0 : diff > 0;
    return {
      diff: Math.abs(diff),
      status: isImproved ? 'improved' : 'worsened',
      text: `${isImproved ? '▲' : '▼'} ${Math.abs(diff)}`,
    };
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ヘッダーセクション */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-indigo-600 text-sm font-semibold mb-1">
              <MapPin className="w-4 h-4" />
              <span>365ボイス グリッド順位レポート</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{store.name}</h1>
            <p className="text-xs text-slate-500 mt-1">
              検索対象店舗名: <span className="font-mono text-slate-700 font-semibold">{store.targetName}</span> | 7×7 (49地点)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {latestRun && (
              <div className="text-right text-xs bg-slate-100 py-2 px-3.5 rounded-lg border border-slate-200">
                <div className="flex items-center text-slate-500 font-medium">
                  <Calendar className="w-3.5 h-3.5 mr-1" />
                  最新計測日時
                </div>
                <div className="font-bold text-slate-800 mt-0.5">
                  {new Date(latestRun.executedAt).toLocaleString('ja-JP')}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setIsEditingKeywords(true);
                fetchStoreKeywords();
              }}
              className="inline-flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold px-4 py-2.5 rounded-xl border border-slate-200 transition duration-150 cursor-pointer"
            >
              <Edit3 className="w-4 h-4 mr-1.5 text-indigo-600" />
              キーワード編集・管理
            </button>

            <button
              onClick={handleManualMeasure}
              disabled={measuring}
              className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm transition duration-150 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${measuring ? 'animate-spin' : ''}`} />
              {measuring ? '計測実行中...' : '今すぐ計測実行'}
            </button>
          </div>
        </div>

        {message && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center text-sm font-medium">
            <CheckCircle className="w-4 h-4 mr-2 text-emerald-600 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {/* キーワード編集・管理モーダル */}
        {isEditingKeywords && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <Tag className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-lg font-bold text-slate-900">店舗キーワードの編集・管理</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingKeywords(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* カテゴリー上限数インジケーター */}
              {(() => {
                const mainCount = storeKeywords.filter((k) => k.category === 'MAIN').length;
                const subCount = storeKeywords.filter((k) => k.category === 'SUB').length;
                const excludedCount = storeKeywords.filter((k) => k.category === 'EXCLUDED').length;

                return (
                  <div className="grid grid-cols-3 gap-2 bg-slate-100 p-2.5 rounded-xl text-center text-xs">
                    <div className={`p-2 rounded-lg font-semibold transition ${mainCount >= 3 ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-white text-slate-700'}`}>
                      <div className="text-[10px] text-slate-500">★ メイン (上限3件)</div>
                      <div className="font-extrabold text-sm mt-0.5">{mainCount} / 3 件</div>
                    </div>
                    <div className={`p-2 rounded-lg font-semibold transition ${subCount >= 5 ? 'bg-blue-100 text-blue-900 border border-blue-300' : 'bg-white text-slate-700'}`}>
                      <div className="text-[10px] text-slate-500">サブ (上限5件)</div>
                      <div className="font-extrabold text-sm mt-0.5">{subCount} / 5 件</div>
                    </div>
                    <div className={`p-2 rounded-lg font-semibold transition ${excludedCount >= 2 ? 'bg-rose-100 text-rose-900 border border-rose-300' : 'bg-white text-slate-700'}`}>
                      <div className="text-[10px] text-slate-500">最近外したワード (上限2件)</div>
                      <div className="font-extrabold text-sm mt-0.5">{excludedCount} / 2 件</div>
                    </div>
                  </div>
                );
              })()}

              {modalSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3.5 py-2.5 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold">{modalSuccess}</span>
                  </div>
                  <button type="button" onClick={() => setModalSuccess(null)} className="text-emerald-500 hover:text-emerald-700 ml-2">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {modalError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-3.5 py-2.5 rounded-xl flex items-center justify-between">
                  <span className="font-semibold">{modalError}</span>
                  <button type="button" onClick={() => setModalError(null)} className="text-rose-500 hover:text-rose-700 ml-2">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* 新規キーワード追加セクション */}
              <form onSubmit={handleAddKeyword} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-700 flex items-center">
                  <Plus className="w-4 h-4 mr-1 text-indigo-600" />
                  新規キーワードの追加
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    required
                    placeholder="例: 子連れ 美容院"
                    value={newKeywordText}
                    onChange={(e) => setNewKeywordText(e.target.value)}
                    className="flex-1 p-2.5 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <select
                    value={newKeywordCategory}
                    onChange={(e) => setNewKeywordCategory(e.target.value as any)}
                    className="p-2.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 outline-none"
                  >
                    <option value="MAIN">★ メイン</option>
                    <option value="SUB">サブ</option>
                    <option value="EXCLUDED">最近外したワード</option>
                  </select>
                  <button
                    type="submit"
                    disabled={keywordSaving}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 shrink-0 cursor-pointer"
                  >
                    追加する
                  </button>
                </div>
              </form>

              {/* 登録済みキーワード一覧 */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
                  <span>登録済みキーワード ({storeKeywords.length} 件)</span>
                  <span className="text-[11px] text-slate-400">ワンクリックでカテゴリーを変更・移動できます</span>
                </div>

                {loadingKeywords ? (
                  <div className="p-8 text-center text-slate-500 flex items-center justify-center space-x-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
                    <span className="text-xs">キーワード読み込み中...</span>
                  </div>
                ) : storeKeywords.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">登録されたキーワードがありません。</p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {storeKeywords.map((kw) => {
                      const isMain = kw.category === 'MAIN';
                      const isSub = kw.category === 'SUB';
                      const isExcluded = kw.category === 'EXCLUDED';

                      return (
                        <div
                          key={kw.id}
                          className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white hover:bg-slate-50/70 transition"
                        >
                          <div className="flex items-center space-x-2.5">
                            <span className="font-bold text-sm text-slate-900">{kw.keywordText}</span>
                            {isMain && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-full border border-amber-200">
                                ★ メイン
                              </span>
                            )}
                            {isSub && (
                              <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full border border-slate-200">
                                サブ
                              </span>
                            )}
                            {isExcluded && (
                              <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full border border-rose-200">
                                最近外したワード
                              </span>
                            )}
                          </div>

                          <div className="flex items-center flex-wrap gap-1.5">
                            {/* カテゴリ変更ボタングループ */}
                            {!isMain && (
                              <button
                                type="button"
                                onClick={() => handleQuickMoveCategory(kw.id, 'MAIN')}
                                disabled={keywordSaving}
                                className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition cursor-pointer"
                              >
                                ★ メインへ
                              </button>
                            )}
                            {!isSub && (
                              <button
                                type="button"
                                onClick={() => handleQuickMoveCategory(kw.id, 'SUB')}
                                disabled={keywordSaving}
                                className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition cursor-pointer"
                              >
                                サブへ
                              </button>
                            )}
                            {!isExcluded && (
                              <button
                                type="button"
                                onClick={() => handleQuickMoveCategory(kw.id, 'EXCLUDED')}
                                disabled={keywordSaving}
                                className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition cursor-pointer flex items-center"
                              >
                                <ArrowRightLeft className="w-3 h-3 mr-1" />
                                最近外したワードに移す
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteKeyword(kw.id, kw.keywordText)}
                              disabled={keywordSaving}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition ml-1"
                              title="キーワードを削除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditingKeywords(false)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}

        {!latestRun ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
            <Info className="w-12 h-12 text-indigo-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-800 mb-1">計測データがまだありません</h3>
            <p className="text-sm text-slate-500 mb-6">
              右上「今すぐ計測実行」ボタンを押すと、初回計測を実行して履歴に保存されます。
            </p>
          </div>
        ) : (
          <>
            {/* ② 【キーワード切替タブ】明示的なキーワード選択ボタン群（メイン/サブ対応） */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3 relative z-20">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    測定ワード切替 (全 {latestRun.summaries.length} 件):
                  </span>
                  <span className="text-xs bg-indigo-100 text-indigo-800 font-bold px-2.5 py-0.5 rounded-full">
                    現在: 「{currentKeyword?.keywordText}」
                  </span>

                  {/* 現在選択中のキーワードに対するワンクリック移動ボタン */}
                  {currentKeyword && (
                    <div className="ml-2 inline-flex items-center">
                      {currentCat !== 'EXCLUDED' ? (
                        <button
                          type="button"
                          onClick={() => handleQuickMoveCategory(currentKeyword.keywordId, 'EXCLUDED')}
                          disabled={keywordSaving}
                          className="px-2.5 py-0.5 text-[11px] font-bold rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition flex items-center space-x-1 cursor-pointer select-none"
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                          <span>このワードを「最近外したワード」に移す</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleQuickMoveCategory(currentKeyword.keywordId, 'MAIN')}
                          disabled={keywordSaving}
                          className="px-2.5 py-0.5 text-[11px] font-bold rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition flex items-center space-x-1 cursor-pointer select-none"
                        >
                          <span>★ メインに戻す</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* フィルターボタン (メイン/サブ グループ + 独立「最近外したワード」ボタン) */}
                <div className="flex items-center flex-wrap gap-2 sm:gap-3">
                  {/* メイン / サブ タブグループ */}
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600 gap-1">
                    <button
                      type="button"
                      onClick={() => handleSetKeywordFilter('main')}
                      className={`px-3 py-1.5 rounded-lg transition flex items-center space-x-1 cursor-pointer select-none ${
                        keywordFilter === 'main'
                          ? 'bg-white text-indigo-600 shadow-xs font-extrabold'
                          : 'hover:text-slate-900'
                      }`}
                    >
                      <span>★ メイン</span>
                      <span className="text-[11px] opacity-80">
                        ({latestRun.summaries.filter((k, i) => getCat(k, i) === 'MAIN').length})
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetKeywordFilter('sub')}
                      className={`px-3 py-1.5 rounded-lg transition flex items-center space-x-1 cursor-pointer select-none ${
                        keywordFilter === 'sub'
                          ? 'bg-white text-slate-800 shadow-xs font-extrabold'
                          : 'hover:text-slate-900'
                      }`}
                    >
                      <span>サブ</span>
                      <span className="text-[11px] opacity-80">
                        ({latestRun.summaries.filter((k, i) => getCat(k, i) === 'SUB').length})
                      </span>
                    </button>
                  </div>

                  {/* 区切り線 */}
                  <div className="hidden sm:block w-px h-5 bg-slate-200 my-auto" />

                  {/* 独立配置された「最近外したワード」ボタン */}
                  <button
                    type="button"
                    onClick={() => handleSetKeywordFilter('excluded')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border cursor-pointer select-none ${
                      keywordFilter === 'excluded'
                        ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-xs ring-2 ring-rose-200'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <span>最近外したワード</span>
                    <span className="text-[11px] opacity-80">
                      ({latestRun.summaries.filter((k, i) => getCat(k, i) === 'EXCLUDED').length})
                    </span>
                  </button>
                </div>
              </div>

              {/* 最近外したワード選択時の注意バナー */}
              {keywordFilter === 'excluded' && (
                <div className="bg-rose-50/80 border border-rose-200 text-rose-800 text-xs px-3.5 py-2 rounded-xl flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                  <span className="font-semibold">
                    ※ 過去に施策対象から除外・変更したキーワードです（施策停止に伴う順位変化のモニタリングにご活用いただけます）。
                  </span>
                </div>
              )}

              {/* タブ一覧 */}
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
                {latestRun.summaries.map((kw, idx) => {
                  const isSelected = selectedKeywordIndex === idx;
                  const cat = getCat(kw, idx);
                  const isMain = cat === 'MAIN';
                  const isExcluded = cat === 'EXCLUDED';

                  if (keywordFilter === 'main' && !isMain) return null;
                  if (keywordFilter === 'sub' && cat !== 'SUB') return null;
                  if (keywordFilter === 'excluded' && !isExcluded) return null;

                  return (
                    <button
                      key={kw.keywordId || idx}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSelectKeyword(idx);
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 border shadow-xs cursor-pointer select-none ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-300'
                          : isMain
                          ? 'bg-amber-50/70 border-amber-200 text-amber-900 hover:bg-amber-100/80'
                          : isExcluded
                          ? 'bg-rose-50/70 border-rose-200 text-rose-900 hover:bg-rose-100/80'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="pointer-events-none flex items-center space-x-1">
                        {isMain && <span className={isSelected ? 'text-amber-300' : 'text-amber-500'}>★</span>}
                        <span>{kw.keywordText}</span>
                      </span>
                      <span
                        className={`pointer-events-none px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          isSelected
                            ? 'bg-indigo-700 text-white'
                            : isMain
                            ? 'bg-amber-200 text-amber-900'
                            : isExcluded
                            ? 'bg-rose-200 text-rose-900'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {kw.avgRank}位
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* サマリーカード */}
            {currentKeyword && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* 平均順位 */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      平均順位 ({currentKeyword.keywordText})
                    </span>
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                      <BarChart2 className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <div>
                      <span className="text-3xl font-extrabold text-slate-900">
                        {currentKeyword.avgRank}
                      </span>
                      <span className="text-sm text-slate-500 font-normal ml-1">位</span>
                    </div>

                    {previousKeyword && (() => {
                      const res = calcDiff(currentKeyword.avgRank, previousKeyword.avgRank, true);
                      if (!res) return null;
                      return (
                        <div
                          className={`flex items-center text-xs font-bold px-2.5 py-1 rounded-full ${
                            res.status === 'improved'
                              ? 'bg-emerald-100 text-emerald-700'
                              : res.status === 'worsened'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {res.status === 'improved' && <TrendingUp className="w-3.5 h-3.5 mr-1" />}
                          {res.status === 'worsened' && <TrendingDown className="w-3.5 h-3.5 mr-1" />}
                          {res.status === 'neutral' && <Minus className="w-3.5 h-3.5 mr-1" />}
                          <span>{previousKeyword.avgRank}位 → {currentKeyword.avgRank}位 ({res.text})</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* TOP3 地点数 */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      TOP3 地点数
                    </span>
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                      <Award className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <div>
                      <span className="text-3xl font-extrabold text-slate-900">
                        {currentKeyword.top3Count}
                      </span>
                      <span className="text-sm text-slate-500 font-normal ml-1">
                        / 49地点 ({Math.round((currentKeyword.top3Count / 49) * 100)}%)
                      </span>
                    </div>

                    {previousKeyword && (() => {
                      const res = calcDiff(currentKeyword.top3Count, previousKeyword.top3Count, false);
                      if (!res) return null;
                      return (
                        <div
                          className={`flex items-center text-xs font-bold px-2.5 py-1 rounded-full ${
                            res.status === 'improved'
                              ? 'bg-emerald-100 text-emerald-700'
                              : res.status === 'worsened'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {previousKeyword.top3Count}地点 → {currentKeyword.top3Count}地点
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* TOP20 地点数 */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        TOP20 地点数
                      </span>
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <Target className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between">
                      <div>
                        <span className="text-3xl font-extrabold text-slate-900">
                          {currentKeyword.top20Count}
                        </span>
                        <span className="text-sm text-slate-500 font-normal ml-1">
                          / 49地点 ({Math.round((currentKeyword.top20Count / 49) * 100)}%)
                        </span>
                      </div>

                      {previousKeyword && (() => {
                        const res = calcDiff(currentKeyword.top20Count, previousKeyword.top20Count, false);
                        if (!res) return null;
                        return (
                          <div
                            className={`flex items-center text-xs font-bold px-2.5 py-1 rounded-full ${
                              res.status === 'improved'
                                ? 'bg-emerald-100 text-emerald-700'
                                : res.status === 'worsened'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {previousKeyword.top20Count}地点 → {currentKeyword.top20Count}地点
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* モニタリング状態に応じた注記メッセージ */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs font-semibold flex items-center">
                    {getCat(currentKeyword, selectedKeywordIndex) === 'EXCLUDED' ? (
                      <span className="text-rose-600">
                        21位以下でマップにピンが立たなくなります
                      </span>
                    ) : (
                      <span className="text-indigo-600">
                        20位以内でマップにピンが立ちます
                      </span>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* 7×7 グリッド順位マトリックス (カラー表示) */}
            {currentKeyword && (
              <div
                id="grid-map-section"
                className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border-2 border-indigo-100 ring-4 ring-indigo-50/50 space-y-4 transition-all scroll-mt-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-[10px] font-extrabold bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                        順位マップ画面
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>7×7 (49地点) 順位マップ:</span>
                      <span className="text-indigo-600 font-extrabold break-all">「{currentKeyword.keywordText}」</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      店舗中心から 500m 間隔のGoogleマップ順位マトリックス
                    </p>
                  </div>

                  {/* 凡例 */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-medium">
                    <span className="flex items-center">
                      <span className="w-3 h-3 rounded bg-emerald-500 inline-block mr-1"></span> 1〜3位
                    </span>
                    <span className="flex items-center">
                      <span className="w-3 h-3 rounded bg-lime-400 inline-block mr-1"></span> 4〜10位
                    </span>
                    <span className="flex items-center">
                      <span className="w-3 h-3 rounded bg-orange-500 inline-block mr-1"></span> 11〜20位
                    </span>
                    <span className="flex items-center">
                      <span className="w-3 h-3 rounded bg-slate-300 inline-block mr-1"></span> 圏外
                    </span>
                  </div>
                </div>

                {/* 49地点グリッド表示 */}
                <div className="pt-2 flex justify-center">
                  <div className="grid grid-cols-7 gap-1.5 md:gap-2 max-w-lg w-full bg-slate-100 p-3.5 rounded-2xl border border-slate-200">
                    {currentKeyword.gridMatrix.map((pt, idx) => {
                      const isCenter = pt.pointX === 0 && pt.pointY === 0;
                      let bgClass = 'bg-slate-300 text-slate-600';
                      if (pt.rank !== null) {
                        if (pt.rank <= 3) bgClass = 'bg-emerald-500 text-white font-extrabold';
                        else if (pt.rank <= 10) bgClass = 'bg-lime-400 text-slate-900 font-bold';
                        else if (pt.rank <= 20) bgClass = 'bg-orange-500 text-white font-bold';
                      }

                      return (
                        <div
                          key={idx}
                          title={`座標: (${pt.pointX}, ${pt.pointY}) / 緯度経度: ${pt.latitude}, ${pt.longitude}`}
                          className={`aspect-square rounded-xl flex flex-col items-center justify-center text-xs md:text-sm shadow-sm transition hover:scale-105 relative cursor-pointer ${bgClass} ${
                            isCenter ? 'ring-2 ring-indigo-600 ring-offset-2' : ''
                          }`}
                        >
                          {isCenter && (
                            <span className="absolute top-1 text-[8px] opacity-90 uppercase tracking-tighter font-extrabold">
                              中心
                            </span>
                          )}
                          <span className={isCenter ? 'mt-2' : ''}>
                            {pt.rank !== null ? `${pt.rank}位` : '-'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* キーワード一覧 & 前回比較レポート */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <h2 className="text-lg font-bold text-slate-900 flex flex-wrap items-center gap-2">
                  <span>測定ワード別 比較レポート</span>
                  {previousRun ? (
                    <span className="text-xs font-normal text-slate-500 bg-slate-100 py-1 px-2.5 rounded-full">
                      前回 ({new Date(previousRun.executedAt).toLocaleDateString('ja-JP')}) との比較
                    </span>
                  ) : (
                    <span className="text-xs font-normal text-slate-400">
                      (初回計測データ)
                    </span>
                  )}
                </h2>
              </div>

              {/* PC表示用: テーブル */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">測定ワード</th>
                      <th className="py-3 px-4 text-center">平均順位</th>
                      <th className="py-3 px-4 text-center">TOP3地点数</th>
                      <th className="py-3 px-4 text-center">TOP20地点数</th>
                      <th className="py-3 px-4 text-right">マップ選択</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {latestRun.summaries.map((kw, idx) => {
                      const prevKw = previousRun?.summaries.find((p) => p.keywordText === kw.keywordText || p.keywordId === kw.keywordId);
                      const isSelected = selectedKeywordIndex === idx;

                      const rankDiff = calcDiff(kw.avgRank, prevKw?.avgRank, true);
                      const top3Diff = calcDiff(kw.top3Count, prevKw?.top3Count, false);
                      const top20Diff = calcDiff(kw.top20Count, prevKw?.top20Count, false);

                      return (
                        <tr
                          key={kw.keywordId || idx}
                          className={`hover:bg-slate-50/80 transition cursor-pointer ${
                            isSelected ? 'bg-indigo-50/50 font-medium' : ''
                          }`}
                          onClick={() => handleSelectKeyword(idx)}
                        >
                          <td className="py-4 px-4 font-semibold text-slate-900">
                            <div className="flex items-center space-x-2">
                              <span>{kw.keywordText}</span>
                              {(() => {
                                const cat = getCat(kw, idx);
                                if (cat === 'MAIN') {
                                  return (
                                    <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-200">
                                      ★ メイン
                                    </span>
                                  );
                                }
                                if (cat === 'EXCLUDED') {
                                  return (
                                    <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-200">
                                      最近外したワード
                                    </span>
                                  );
                                }
                                return (
                                  <span className="bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5 rounded-full">
                                    サブ
                                  </span>
                                );
                              })()}
                            </div>
                          </td>

                          <td className="py-4 px-4 text-center">
                            <div className="font-bold text-slate-900">
                              {prevKw ? `${prevKw.avgRank}位 → ` : ''}
                              <span className="text-indigo-600">{kw.avgRank}位</span>
                            </div>
                            {rankDiff && (
                              <div
                                className={`text-xs font-bold mt-0.5 inline-block px-2 py-0.5 rounded-full ${
                                  rankDiff.status === 'improved'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : rankDiff.status === 'worsened'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'text-slate-500'
                                }`}
                              >
                                {rankDiff.text}
                              </div>
                            )}
                          </td>

                          <td className="py-4 px-4 text-center">
                            <div>
                              {prevKw ? `${prevKw.top3Count}地点 → ` : ''}
                              <span className="font-bold text-slate-900">{kw.top3Count}地点</span>
                            </div>
                            {top3Diff && (
                              <div
                                className={`text-xs font-bold mt-0.5 inline-block px-2 py-0.5 rounded-full ${
                                  top3Diff.status === 'improved'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : top3Diff.status === 'worsened'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'text-slate-500'
                                }`}
                              >
                                {top3Diff.text}
                              </div>
                            )}
                          </td>

                          <td className="py-4 px-4 text-center">
                            <div>
                              {prevKw ? `${prevKw.top20Count}地点 → ` : ''}
                              <span className="font-bold text-slate-900">{kw.top20Count}地点</span>
                            </div>
                            {top20Diff && (
                              <div
                                className={`text-xs font-bold mt-0.5 inline-block px-2 py-0.5 rounded-full ${
                                  top20Diff.status === 'improved'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : top20Diff.status === 'worsened'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'text-slate-500'
                                }`}
                              >
                                {top20Diff.text}
                              </div>
                            )}
                          </td>

                          <td className="py-4 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectKeyword(idx);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                            >
                              {isSelected ? 'マップ選択中' : '選択する'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* スマホ表示用: 各キーワードごとの見やすいカードデザイン */}
              <div className="block md:hidden space-y-3">
                <div className="text-xs font-bold text-slate-500 mb-1 flex items-center space-x-1">
                  <span>📊 各ワードの比較レポートカード (タップでマップ表示へ移動)</span>
                </div>
                {latestRun.summaries.map((kw, idx) => {
                  const prevKw = previousRun?.summaries.find((p) => p.keywordText === kw.keywordText || p.keywordId === kw.keywordId);
                  const isSelected = selectedKeywordIndex === idx;

                  const rankDiff = calcDiff(kw.avgRank, prevKw?.avgRank, true);
                  const top3Diff = calcDiff(kw.top3Count, prevKw?.top3Count, false);
                  const top20Diff = calcDiff(kw.top20Count, prevKw?.top20Count, false);

                  return (
                    <div
                      key={kw.keywordId || idx}
                      onClick={() => handleSelectKeyword(idx)}
                      className={`p-4 rounded-xl border transition cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50/50 border-indigo-300 ring-2 ring-indigo-200 shadow-sm'
                          : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/80'
                      }`}
                    >
                      {/* ワード名 ＆ 選択ボタン */}
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900 text-base">
                            {kw.keywordText}
                          </span>
                          {(() => {
                            const cat = getCat(kw, idx);
                            if (cat === 'MAIN') {
                              return (
                                <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-200">
                                  ★ メイン
                                </span>
                              );
                            }
                            if (cat === 'EXCLUDED') {
                              return (
                                <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-200">
                                  最近外したワード
                                </span>
                              );
                            }
                            return (
                              <span className="bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5 rounded-full">
                                サブ
                              </span>
                            );
                          })()}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectKeyword(idx);
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white border border-slate-300 text-slate-700'
                          }`}
                        >
                          {isSelected ? 'マップ選択中' : '選択する'}
                        </button>
                      </div>

                      {/* 数値変析グリッド */}
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        {/* 平均順位 */}
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200/60">
                          <div className="text-[10px] font-semibold text-slate-500 mb-1">平均順位</div>
                          <div className="font-bold text-slate-800 text-xs">
                            {prevKw ? `${prevKw.avgRank}位→` : ''}
                          </div>
                          <div className="font-extrabold text-indigo-600 text-sm">
                            {kw.avgRank}位
                          </div>
                          {rankDiff && (
                            <span
                              className={`mt-1 inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                rankDiff.status === 'improved'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : rankDiff.status === 'worsened'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'text-slate-500'
                              }`}
                            >
                              {rankDiff.text}
                            </span>
                          )}
                        </div>

                        {/* TOP3地点数 */}
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200/60">
                          <div className="text-[10px] font-semibold text-slate-500 mb-1">TOP3地点</div>
                          <div className="font-bold text-slate-800 text-xs">
                            {prevKw ? `${prevKw.top3Count}→` : ''}
                          </div>
                          <div className="font-extrabold text-slate-900 text-sm">
                            {kw.top3Count}地点
                          </div>
                          {top3Diff && (
                            <span
                              className={`mt-1 inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                top3Diff.status === 'improved'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : top3Diff.status === 'worsened'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'text-slate-500'
                              }`}
                            >
                              {top3Diff.text}
                            </span>
                          )}
                        </div>

                        {/* TOP20地点数 */}
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200/60">
                          <div className="text-[10px] font-semibold text-slate-500 mb-1">TOP20地点</div>
                          <div className="font-bold text-slate-800 text-xs">
                            {prevKw ? `${prevKw.top20Count}→` : ''}
                          </div>
                          <div className="font-extrabold text-slate-900 text-sm">
                            {kw.top20Count}地点
                          </div>
                          {top20Diff && (
                            <span
                              className={`mt-1 inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                top20Diff.status === 'improved'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : top20Diff.status === 'worsened'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'text-slate-500'
                              }`}
                            >
                              {top20Diff.text}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ⑤ 【過去履歴アーカイブ】過去データの参照・履歴保持の確認 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between text-left font-bold text-slate-800 hover:text-indigo-600 transition cursor-pointer"
              >
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-indigo-500" />
                  <span>過去の全計測セッション履歴 (全 {historyRuns.length} 件の記録が削除されずに保存中)</span>
                </div>
                <ChevronDown
                  className={`w-5 h-5 transition-transform ${showHistory ? 'rotate-180' : ''}`}
                />
              </button>

              {showHistory && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                  <p className="text-xs text-slate-500 mb-3">
                    すべての計測結果は個別のスナップショットとして永続保存されています。上書き・削除されることは一切ありません。
                  </p>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {historyRuns.map((run, i) => {
                      const isCurrentActive = latestRun?.runId === run.id;
                      return (
                        <div
                          key={run.id}
                          className={`p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between text-sm transition ${
                            isCurrentActive ? 'bg-indigo-50/60 font-semibold' : 'bg-slate-50/50 hover:bg-slate-100/70'
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-0">
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                              ログ #{historyRuns.length - i}
                            </span>
                            <span className="font-bold text-slate-800">
                              {new Date(run.executedAt).toLocaleString('ja-JP')}
                            </span>
                            <span className="text-xs text-slate-500">
                              (7×7 49地点 / {run.intervalMeters}m間隔)
                            </span>
                          </div>

                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center">
                              <CheckCircle className="w-3.5 h-3.5 mr-1" />
                              永続保存済み
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                fetchData(run.id);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer ${
                                isCurrentActive
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <span>{isCurrentActive ? '表示中' : 'この時点のレポートを見る'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
