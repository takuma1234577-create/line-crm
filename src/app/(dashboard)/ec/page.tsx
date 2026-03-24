"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

const CHANNEL_ID = "00000000-0000-0000-0000-000000000010";

interface Store {
  id: string;
  platform: string;
  store_name: string;
  shopify_domain?: string;
  last_synced_at?: string;
  created_at: string;
}

interface Order {
  id: string;
  external_order_id: string;
  platform: string;
  customer_name: string;
  customer_email: string;
  total_amount: number;
  currency: string;
  order_status: string;
  friend_id: string | null;
  ordered_at: string;
}

interface FollowupStats {
  scheduled: number;
  sent: number;
  failed: number;
}

interface LinkStats {
  linked: number;
  unlinked: number;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "保留中", className: "bg-gray-100 text-gray-700" },
  confirmed: { label: "確認済", className: "bg-blue-50 text-blue-700" },
  shipped: { label: "発送済", className: "bg-yellow-50 text-yellow-700" },
  delivered: { label: "配達済", className: "bg-[#06C755]/10 text-[#06C755]" },
  cancelled: { label: "キャンセル", className: "bg-red-50 text-red-600" },
  returned: { label: "返品", className: "bg-red-50 text-red-600" },
};

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === "shopify") {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#96BF48] text-white text-xs font-bold">
        S
      </span>
    );
  }
  if (platform === "amazon") {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF9900] text-white text-xs font-bold">
        A
      </span>
    );
  }
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-400 text-white text-xs font-bold">
      ?
    </span>
  );
}

export default function ECDashboardPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [followupStats, setFollowupStats] = useState<FollowupStats>({ scheduled: 0, sent: 0, failed: 0 });
  const [linkStats, setLinkStats] = useState<LinkStats>({ linked: 0, unlinked: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showAddStore, setShowAddStore] = useState(false);
  const [newStore, setNewStore] = useState({ platform: "shopify", store_name: "", shopify_domain: "", shopify_access_token: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [storesRes, ordersRes, followupScheduled, followupSent, followupFailed, linkedRes, unlinkedRes] = await Promise.all([
      supabase.from("ec_stores").select("*").eq("channel_id", CHANNEL_ID).order("created_at", { ascending: false }),
      supabase.from("ec_orders").select("*").eq("channel_id", CHANNEL_ID).order("ordered_at", { ascending: false }).limit(10),
      supabase.from("ec_followup_jobs").select("*", { count: "exact", head: true }).eq("channel_id", CHANNEL_ID).eq("status", "scheduled"),
      supabase.from("ec_followup_jobs").select("*", { count: "exact", head: true }).eq("channel_id", CHANNEL_ID).eq("status", "sent"),
      supabase.from("ec_followup_jobs").select("*", { count: "exact", head: true }).eq("channel_id", CHANNEL_ID).eq("status", "failed"),
      supabase.from("ec_orders").select("*", { count: "exact", head: true }).eq("channel_id", CHANNEL_ID).not("friend_id", "is", null),
      supabase.from("ec_orders").select("*", { count: "exact", head: true }).eq("channel_id", CHANNEL_ID).is("friend_id", null),
    ]);

    setStores(storesRes.data ?? []);
    setOrders(ordersRes.data ?? []);
    setFollowupStats({
      scheduled: followupScheduled.count ?? 0,
      sent: followupSent.count ?? 0,
      failed: followupFailed.count ?? 0,
    });
    setLinkStats({
      linked: linkedRes.count ?? 0,
      unlinked: unlinkedRes.count ?? 0,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSync(storeId: string) {
    setSyncing(storeId);
    try {
      const res = await fetch("/api/ec/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId }),
      });
      const result = await res.json();
      if (res.ok) {
        alert(`同期完了: ${result.synced}件同期、${result.errors}件エラー`);
        fetchData();
      } else {
        alert(`同期エラー: ${result.error}`);
      }
    } catch {
      alert("同期に失敗しました");
    }
    setSyncing(null);
  }

  async function handleAddStore() {
    if (!newStore.store_name) return;

    const { error } = await supabase.from("ec_stores").insert({
      channel_id: CHANNEL_ID,
      platform: newStore.platform,
      store_name: newStore.store_name,
      shopify_domain: newStore.shopify_domain || null,
      shopify_access_token: newStore.shopify_access_token || null,
    });

    if (error) {
      alert("ストア追加に失敗しました: " + error.message);
      return;
    }

    setNewStore({ platform: "shopify", store_name: "", shopify_domain: "", shopify_access_token: "" });
    setShowAddStore(false);
    fetchData();
  }

  const linkRate = linkStats.linked + linkStats.unlinked > 0
    ? Math.round((linkStats.linked / (linkStats.linked + linkStats.unlinked)) * 100)
    : 0;

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
              <div className="mt-2 h-8 w-16 animate-pulse rounded bg-gray-200" />
            </div>
          ))}
        </div>

        {/* Content skeleton */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-6">
            <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
            <div className="mt-4 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="h-6 w-24 animate-pulse rounded bg-gray-200" />
            <div className="mt-4 h-40 animate-pulse rounded-lg bg-gray-100" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-indigo-50 p-2">
              <svg className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-500">総注文数</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900">{(linkStats.linked + linkStats.unlinked).toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-[#06C755]/10 p-2">
              <svg className="h-4 w-4 text-[#06C755]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-500">LINE紐付け率</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-[#06C755]">{linkRate}%</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-blue-50 p-2">
              <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-500">待機フォローアップ</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900">{followupStats.scheduled}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-orange-50 p-2">
              <svg className="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-500">連携ストア数</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900">{stores.length}</p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Store Connections + Orders */}
        <div className="lg:col-span-2 space-y-6">
          {/* Store Connections */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="font-semibold text-gray-900">ストア連携</h2>
              <button
                onClick={() => setShowAddStore(true)}
                className="flex items-center gap-1.5 rounded-lg bg-[#06C755] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#05A649]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                ストア追加
              </button>
            </div>

            {showAddStore && (
              <div className="border-b border-gray-100 bg-gray-50 p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-700">プラットフォーム</label>
                    <select
                      value={newStore.platform}
                      onChange={(e) => setNewStore({ ...newStore, platform: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#06C755] focus:outline-none focus:ring-2 focus:ring-[#06C755]/20"
                    >
                      <option value="shopify">Shopify</option>
                      <option value="amazon">Amazon</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-700">ストア名</label>
                    <input
                      type="text"
                      value={newStore.store_name}
                      onChange={(e) => setNewStore({ ...newStore, store_name: e.target.value })}
                      placeholder="マイショップ"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#06C755] focus:outline-none focus:ring-2 focus:ring-[#06C755]/20"
                    />
                  </div>
                  {newStore.platform === "shopify" && (
                    <>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-700">Shopifyドメイン</label>
                        <input
                          type="text"
                          value={newStore.shopify_domain}
                          onChange={(e) => setNewStore({ ...newStore, shopify_domain: e.target.value })}
                          placeholder="myshop.myshopify.com"
                          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#06C755] focus:outline-none focus:ring-2 focus:ring-[#06C755]/20"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-700">アクセストークン</label>
                        <input
                          type="password"
                          value={newStore.shopify_access_token}
                          onChange={(e) => setNewStore({ ...newStore, shopify_access_token: e.target.value })}
                          placeholder="shpat_xxxxx"
                          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#06C755] focus:outline-none focus:ring-2 focus:ring-[#06C755]/20"
                        />
                      </div>
                    </>
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleAddStore}
                    className="rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white hover:bg-[#05A649]"
                  >
                    追加
                  </button>
                  <button
                    onClick={() => setShowAddStore(false)}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}

            {stores.length === 0 ? (
              <div className="p-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500">まだストアが連携されていません</p>
                <button
                  onClick={() => setShowAddStore(true)}
                  className="mt-3 text-sm font-medium text-[#06C755] hover:underline"
                >
                  ストアを追加する
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {stores.map((store) => (
                  <div key={store.id} className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4">
                      <PlatformIcon platform={store.platform} />
                      <div>
                        <p className="font-medium text-gray-900">{store.store_name}</p>
                        <p className="text-xs text-gray-500">
                          {store.platform === "shopify" ? store.shopify_domain : store.platform.toUpperCase()}
                          {store.last_synced_at && (
                            <span className="ml-2 text-gray-400">
                              最終同期: {new Date(store.last_synced_at).toLocaleString("ja-JP")}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSync(store.id)}
                      disabled={syncing === store.id}
                      className="flex items-center gap-1.5 rounded-lg border border-[#06C755] px-3 py-1.5 text-sm font-medium text-[#06C755] transition-colors hover:bg-[#06C755]/5 disabled:opacity-50"
                    >
                      {syncing === store.id ? (
                        <>
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#06C755] border-t-transparent" />
                          同期中...
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                          </svg>
                          同期
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Orders */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="font-semibold text-gray-900">最近の注文</h2>
              <Link href="/ec/orders" className="text-sm font-medium text-[#06C755] hover:underline">
                すべて表示
              </Link>
            </div>

            {orders.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm text-gray-500">まだ注文がありません</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-50 text-left text-xs font-medium text-gray-500">
                      <th className="px-6 py-3">PF</th>
                      <th className="px-6 py-3">顧客</th>
                      <th className="px-6 py-3">金額</th>
                      <th className="px-6 py-3">ステータス</th>
                      <th className="px-6 py-3">LINE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {orders.slice(0, 5).map((order) => {
                      const statusInfo = statusConfig[order.order_status] ?? statusConfig.pending;
                      return (
                        <tr key={order.id} className="hover:bg-gray-50/50">
                          <td className="px-6 py-3">
                            <PlatformIcon platform={order.platform} />
                          </td>
                          <td className="px-6 py-3">
                            <p className="text-sm font-medium text-gray-900">{order.customer_name || order.customer_email || "-"}</p>
                          </td>
                          <td className="px-6 py-3 text-sm font-medium text-gray-900">
                            {order.currency === "JPY" ? "¥" : "$"}{order.total_amount?.toLocaleString()}
                          </td>
                          <td className="px-6 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.className}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            {order.friend_id ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#06C755]">
                                <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              </span>
                            ) : (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-200">
                                <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Link Stats + Followup Stats */}
        <div className="space-y-6">
          {/* Customer Link Stats */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="font-semibold text-gray-900">顧客紐付け状況</h2>
            
            <div className="mt-6">
              {/* Donut chart placeholder */}
              <div className="relative mx-auto h-32 w-32">
                <svg className="h-32 w-32 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#E2E8F0" strokeWidth="12" />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#06C755"
                    strokeWidth="12"
                    strokeDasharray={`${linkRate * 2.51} 251`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{linkRate}%</p>
                    <p className="text-xs text-gray-500">紐付け率</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-[#06C755]" />
                    <span className="text-sm text-gray-600">紐付け済み</span>
                  </div>
                  <span className="font-semibold text-gray-900">{linkStats.linked}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-gray-200" />
                    <span className="text-sm text-gray-600">未紐付け</span>
                  </div>
                  <span className="font-semibold text-gray-900">{linkStats.unlinked}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Followup Pipeline */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="font-semibold text-gray-900">フォローアップ状況</h2>
            
            <div className="mt-6 space-y-4">
              <div className="rounded-lg bg-blue-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-700">予定</span>
                  <span className="text-2xl font-bold text-blue-700">{followupStats.scheduled}</span>
                </div>
              </div>
              <div className="rounded-lg bg-[#06C755]/10 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#06C755]">送信済み</span>
                  <span className="text-2xl font-bold text-[#06C755]">{followupStats.sent}</span>
                </div>
              </div>
              <div className="rounded-lg bg-red-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-red-600">失敗</span>
                  <span className="text-2xl font-bold text-red-600">{followupStats.failed}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
