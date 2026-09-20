'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Play,
  ExternalLink,
  Calendar,
  Layers,
  Search,
  CheckCircle,
  Building2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Power,
  PowerOff,
  X,
} from 'lucide-react';

interface Agency {
  id: string;
  name: string;
  _count?: {
    stores: number;
  };
}

interface StoreItem {
  id: string;
  name: string;
  targetName: string;
  centerLatitude: number;
  centerLongitude: number;
  address?: string | null;
  intervalMeters?: number;
  isMeasurementActive?: boolean;
  agencyId: string;
  agency?: {
    id: string;
    name: string;
  };
  keywords: { id: string; keywordText: string; category?: string }[];
  measurementRuns: { id: string; executedAt: string }[];
}

export default function MainStoreList({
  initialAgencies,
}: {
  initialAgencies: Agency[];
}) {
  const [agencies] = useState<Agency[]>(initialAgencies);
  const [openAgencies, setOpenAgencies] = useState<Record<string, boolean>>({});
  const [agencyStores, setAgencyStores] = useState<Record<string, StoreItem[]>>({});
  const [loadingAgency, setLoadingAgency] = useState<Record<string, boolean>>({});

  // 検索状態
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StoreItem[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [measuring, setMeasuring] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 代理店アコーディオンの開閉と遅延ロード
  const toggleAgency = async (agencyId: string) => {
    const isCurrentlyOpen = openAgencies[agencyId];
    setOpenAgencies((prev) => ({ ...prev, [agencyId]: !isCurrentlyOpen }));

    // 開く際、まだ店舗データがフェッチされていなければ非同期取得（遅延ロード）
    if (!isCurrentlyOpen && !agencyStores[agencyId]) {
      setLoadingAgency((prev) => ({ ...prev, [agencyId]: true }));
      try {
        const res = await fetch(`/api/stores?agencyId=${agencyId}`);
        if (!res.ok) throw new Error('店舗データの取得に失敗しました');
        const data = await res.json();
        setAgencyStores((prev) => ({ ...prev, [agencyId]: data.stores || [] }));
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoadingAgency((prev) => ({ ...prev, [agencyId]: false }));
      }
    }
  };

  // サーバーサイド検索の実行
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/stores?search=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.stores || []);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 店舗の計測ON/OFF切り替え
  const handleToggleStoreActive = async (
    e: React.MouseEvent,
    storeId: string,
    currentStatus: boolean,
    storeName: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const newStatus = !currentStatus;

    // 楽観的UI更新
    setAgencyStores((prev) => {
      const updated = { ...prev };
      for (const agencyId in updated) {
        updated[agencyId] = updated[agencyId].map((s) =>
          s.id === storeId ? { ...s, isMeasurementActive: newStatus } : s
        );
      }
      return updated;
    });

    if (searchResults) {
      setSearchResults((prev) =>
        prev ? prev.map((s) => (s.id === storeId ? { ...s, isMeasurementActive: newStatus } : s)) : null
      );
    }

    try {
      const res = await fetch(`/api/stores/${storeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isMeasurementActive: newStatus }),
      });
      if (!res.ok) throw new Error('ステータスの更新に失敗しました');
      setMessage(`「${storeName}」の計測を${newStatus ? '有効（ON）' : '停止（OFF）'}にしました！`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 全店舗一括計測実行
  const handleRunAllMeasurement = async () => {
    try {
      setMeasuring(true);
      setMessage(null);
      const res = await fetch('/api/measure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '一括計測に失敗しました');
      setMessage(data.message || '計測を完了しました！');
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setMeasuring(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ヘッダーセクション */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-indigo-600 text-sm font-semibold mb-1">
              <Layers className="w-4 h-4" />
              <span>365ボイス グリッド順位管理システム</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">代理店・店舗グリッド順位管理</h1>
            <p className="text-xs text-slate-500 mt-1">
              1万店舗スケール対応（非同期遅延ロード ＆ サーバーサイド検索 ＆ 店舗別ON/OFF制御）
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleRunAllMeasurement}
              disabled={measuring}
              className="inline-flex items-center bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              <Play className={`w-4 h-4 mr-1.5 ${measuring ? 'animate-spin' : ''}`} />
              {measuring ? '一括計測中...' : '全店舗 一括計測 (ON店舗のみ)'}
            </button>
          </div>
        </div>

        {message && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center text-sm font-medium">
            <CheckCircle className="w-4 h-4 mr-2 text-emerald-600 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {/* 検索バー (サーバーサイド検索) */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="店舗名、判定用テキスト、住所、またはキーワードで検索（1万店舗リアルタイム検索）..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 検索結果表示モード */}
        {searchResults !== null ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
              <span>検索結果: {searchResults.length} 件見つかりました</span>
              <button
                onClick={() => setSearchQuery('')}
                className="text-indigo-600 hover:underline cursor-pointer"
              >
                エリア・代理店一覧表示に戻る
              </button>
            </div>

            {isSearching ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 mx-auto mb-2" />
                <p className="text-sm text-slate-600">検索中...</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <Search className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-600 font-medium">条件に一致する店舗が見つかりませんでした。</p>
              </div>
            ) : (
              searchResults.map((store) => {
                const lastRun = store.measurementRuns?.[0];
                const isActive = store.isMeasurementActive !== false;

                return (
                  <div
                    key={store.id}
                    className={`bg-white rounded-2xl p-5 shadow-sm border transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isActive ? 'border-slate-200 hover:border-indigo-200' : 'border-slate-200/60 bg-slate-50/70 opacity-80'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="text-xs bg-slate-100 text-slate-700 font-bold px-2.5 py-0.5 rounded-md flex items-center">
                          <Building2 className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          {store.agency?.name || '（直営・未設定）'}
                        </span>
                        <h2 className="text-lg font-bold text-slate-900">{store.name}</h2>
                        <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-mono">
                          {store.targetName}
                        </span>

                        {/* 計測ON/OFFトグルボタン */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleStoreActive(e, store.id, isActive, store.name)}
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full border transition flex items-center cursor-pointer select-none ${
                            isActive
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                              : 'bg-slate-100 border-slate-300 text-slate-500 hover:bg-slate-200'
                          }`}
                          title="クリックして計測の有効/停止を切り替え"
                        >
                          {isActive ? (
                            <>
                              <Power className="w-3 h-3 mr-1 text-emerald-600" />
                              <span>計測中 (ON)</span>
                            </>
                          ) : (
                            <>
                              <PowerOff className="w-3 h-3 mr-1 text-slate-400" />
                              <span>計測停止中 (OFF)</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="flex items-center">
                          <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          ({store.centerLatitude}, {store.centerLongitude})
                        </span>
                        <span>•</span>
                        <span>間隔: {store.intervalMeters || 500}m</span>
                        <span>•</span>
                        <span className="flex items-center">
                          <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          最終計測: {lastRun ? new Date(lastRun.executedAt).toLocaleString('ja-JP') : '未計測'}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {store.keywords?.map((kw) => (
                          <span
                            key={kw.id}
                            className="bg-slate-100 text-slate-700 text-xs font-medium px-2 py-0.5 rounded-md border border-slate-200"
                          >
                            {kw.keywordText}
                          </span>
                        ))}
                      </div>
                    </div>

                    <Link
                      href={`/stores/${store.id}/grid`}
                      className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-sm transition shrink-0"
                    >
                      <span>順位グリッドを見る</span>
                      <ExternalLink className="w-4 h-4 ml-1.5" />
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* エリア・代理店アコーディオン一覧 */
          <div className="space-y-3">
            {agencies.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
                <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-700">登録された店舗がありません</h3>
              </div>
            ) : (
              agencies.map((agency) => {
                const isOpen = !!openAgencies[agency.id];
                const stores = agencyStores[agency.id] || [];
                const isLoading = !!loadingAgency[agency.id];
                const storeCount = agency._count?.stores ?? stores.length;

                return (
                  <div
                    key={agency.id}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition"
                  >
                    {/* アコーディオンヘッダー */}
                    <button
                      type="button"
                      onClick={() => toggleAgency(agency.id)}
                      className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-slate-50/70 transition cursor-pointer"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h2 className="text-base sm:text-lg font-bold text-slate-900">
                              {agency.name}
                            </h2>
                            <span className="text-xs bg-indigo-100 text-indigo-800 font-bold px-2.5 py-0.5 rounded-full">
                              {storeCount} 店舗
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            クリックして所属店舗を展開（非同期遅延ロード）
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 text-slate-400">
                        {isLoading && <RefreshCw className="w-4 h-4 animate-spin text-indigo-500 mr-1" />}
                        {isOpen ? (
                          <ChevronDown className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </button>

                    {/* アコーディオン配下の店舗リスト（遅延ロード） */}
                    {isOpen && (
                      <div className="border-t border-slate-100 bg-slate-50/40 p-4 sm:p-5 space-y-3">
                        {isLoading ? (
                          <div className="p-8 text-center text-indigo-600 flex items-center justify-center space-x-2">
                            <RefreshCw className="w-5 h-5 animate-spin" />
                            <span className="text-xs font-semibold">店舗一覧をロード中...</span>
                          </div>
                        ) : stores.length === 0 ? (
                          <div className="bg-white p-6 rounded-xl border border-dashed border-slate-200 text-center">
                            <p className="text-xs text-slate-500">このエリアに所属する店舗はありません。</p>
                          </div>
                        ) : (
                          stores.map((store) => {
                            const lastRun = store.measurementRuns?.[0];
                            const isActive = store.isMeasurementActive !== false;

                            return (
                              <div
                                key={store.id}
                                className={`bg-white rounded-xl p-4 sm:p-5 border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 transition ${
                                  isActive ? 'border-slate-200 hover:border-indigo-200' : 'border-slate-200/60 bg-slate-50/60 opacity-85'
                                }`}
                              >
                                <div className="space-y-1.5">
                                  <div className="flex items-center space-x-2 flex-wrap">
                                    <h3 className="text-base font-bold text-slate-900">{store.name}</h3>
                                    <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                                      {store.targetName}
                                    </span>

                                    {/* 計測ON/OFFトグルボタン */}
                                    <button
                                      type="button"
                                      onClick={(e) => handleToggleStoreActive(e, store.id, isActive, store.name)}
                                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full border transition flex items-center cursor-pointer select-none ${
                                        isActive
                                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                                          : 'bg-slate-100 border-slate-300 text-slate-500 hover:bg-slate-200'
                                      }`}
                                      title="クリックして計測の有効/停止を切り替え"
                                    >
                                      {isActive ? (
                                        <>
                                          <Power className="w-3 h-3 mr-1 text-emerald-600" />
                                          <span>計測中 (ON)</span>
                                        </>
                                      ) : (
                                        <>
                                          <PowerOff className="w-3 h-3 mr-1 text-slate-400" />
                                          <span>計測停止中 (OFF)</span>
                                        </>
                                      )}
                                    </button>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                    <span className="flex items-center">
                                      <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />
                                      ({store.centerLatitude}, {store.centerLongitude})
                                    </span>
                                    <span>•</span>
                                    <span>間隔: {store.intervalMeters || 500}m</span>
                                    <span>•</span>
                                    <span className="flex items-center">
                                      <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                                      最終計測: {lastRun ? new Date(lastRun.executedAt).toLocaleString('ja-JP') : '未計測'}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                                    {store.keywords?.map((kw) => (
                                      <span
                                        key={kw.id}
                                        className="bg-indigo-50 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded-md border border-indigo-100"
                                      >
                                        {kw.keywordText}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                <div className="pt-2 md:pt-0">
                                  <Link
                                    href={`/stores/${store.id}/grid`}
                                    className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm px-4 py-2 rounded-xl shadow-xs transition"
                                  >
                                    <span>独立結果画面を開く</span>
                                    <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                                  </Link>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>
    </div>
  );
}
