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

  function statusBadge(status: string) {
    const map: Record<string, { label: string; color: string }> = {
      pending: { label: "保留中", color: "bg-gray-100 text-gray-700" },
      confirmed: { label: "確認済", color: "bg-blue-100 text-blue-700" },
      shipped: { label: "発送済", color: "bg-yellow-100 text-yellow-700" },
      delivered: { label: "配達済", color: "bg-green-100 text-green-700" },
      cancelled: { label: "キャンセル", color: "bg-red-100 text-red-700" },
      returned: { label: "返品", color: "bg-red-100 text-red-700" },
    };
    const s = map[status] ?? { label: status, color: "bg-gray-100 text-gray-700" };
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}>{s.label}</span>;
  }

  function platformIcon(platform: string) {
    if (platform === "shopify") {
      return (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#96BF48] text-white text-xs font-bold">S</span>
      );
    }
    if (platform === "amazon") {
      return (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#FF9900] text-white text-xs font-bold">A</span>
      );
    }
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-gray-400 text-white text-xs font-bold">?</span>
    );
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#06C755] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">EC連携</h1>
          <p className="mt-1 text-sm text-gray-500">ECストアの注文をLINE友だちと紐付けて管理</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/ec/orders"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            注文一覧
          </Link>
          <Link
            href="/ec/products"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            商品管理
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">総注文数</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{linkStats.linked + linkStats.unlinked}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">LINE紐付け済</p>
          <p className="mt-1 text-2xl font-bold text-[#06C755]">{linkStats.linked}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">未紐付け</p>
          <p className="mt-1 text-2xl font-bold text-orange-500">{linkStats.unlinked}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">連携ストア数</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{stores.length}</p>
        </div>
      </div>

      {/* Store Connections */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">ストア連携</h2>
          <button
            onClick={() => setShowAddStore(true)}
            className="rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white hover:bg-[#05b34c] transition-colors"
          >
            + ストア追加
          </button>
        </div>

        {showAddStore && (
          <div className="border-b border-gray-100 bg-gray-50 px-6 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">プラットフォーム</label>
                <select
                  value={newStore.platform}
                  onChange={(e) => setNewStore({ ...newStore, platform: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
                >
                  <option value="shopify">Shopify</option>
                  <option value="amazon">Amazon</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">ストア名</label>
                <input
                  type="text"
                  value={newStore.store_name}
                  onChange={(e) => setNewStore({ ...newStore, store_name: e.target.value })}
                  placeholder="マイショップ"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
                />
              </div>
              {newStore.platform === "shopify" && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Shopifyドメイン</label>
                    <input
                      type="text"
                      value={newStore.shopify_domain}
                      onChange={(e) => setNewStore({ ...newStore, shopify_domain: e.target.value })}
                      placeholder="myshop.myshopify.com"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">アクセストークン</label>
                    <input
                      type="password"
                      value={newStore.shopify_access_token}
                      onChange={(e) => setNewStore({ ...newStore, shopify_access_token: e.target.value })}
                      placeholder="shpat_xxxxx"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleAddStore}
                className="rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white hover:bg-[#05b34c]"
              >
                追加
              </button>
              <button
                onClick={() => setShowAddStore(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {stores.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016A3.001 3.001 0 0021 9.349m-18 0V4.125C3 3.504 3.504 3 4.125 3h15.75c.621 0 1.125.504 1.125 1.125V9.35" />
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
          <div className="divide-y divide-gray-100">
            {stores.map((store) => (
              <div key={store.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  {platformIcon(store.platform)}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{store.store_name}</p>
                    <p className="text-xs text-gray-500">
                      {store.platform === "shopify" ? store.shopify_domain : store.platform.toUpperCase()}
                      {store.last_synced_at && (
                        <span className="ml-2">最終同期: {new Date(store.last_synced_at).toLocaleString("ja-JP")}</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleSync(store.id)}
                  disabled={syncing === store.id}
                  className="rounded-lg border border-[#06C755] px-3 py-1.5 text-xs font-medium text-[#06C755] hover:bg-[#06C755]/5 disabled:opacity-50 transition-colors"
                >
                  {syncing === store.id ? (
                    <span className="flex items-center gap-1">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#06C755] border-t-transparent" />
                      同期中...
                    </span>
                  ) : (
                    "同期"
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
          <h2 className="text-base font-semibold text-gray-900">最近の注文</h2>
          <Link href="/ec/orders" className="text-sm font-medium text-[#06C755] hover:underline">
            すべて表示
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-gray-500">まだ注文がありません</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500">
                  <th className="px-6 py-3">注文ID</th>
                  <th className="px-6 py-3">プラットフォーム</th>
                  <th className="px-6 py-3">顧客名</th>
                  <th className="px-6 py-3">金額</th>
                  <th className="px-6 py-3">ステータス</th>
                  <th className="px-6 py-3">LINE紐付け</th>
                  <th className="px-6 py-3">注文日</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm font-mono text-gray-700">
                      {order.external_order_id.slice(0, 12)}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        {platformIcon(order.platform)}
                        <span className="text-sm text-gray-700 capitalize">{order.platform}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700">{order.customer_name || order.customer_email || "-"}</td>
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">
                      {order.currency === "JPY" ? "¥" : "$"}{order.total_amount?.toLocaleString()}
                    </td>
                    <td className="px-6 py-3">{statusBadge(order.order_status)}</td>
                    <td className="px-6 py-3">
                      {order.friend_id ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#06C755]/10 px-2 py-0.5 text-xs font-medium text-[#06C755]">
                          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 5.58 2 10c0 2.24 1.12 4.27 2.94 5.76-.17.62-.94 3.31-.97 3.54 0 0-.02.17.09.24.11.06.24.01.24.01.33-.05 3.82-2.5 4.36-2.87.43.06.87.1 1.34.1 5.52 0 10-3.58 10-8 0-4.42-4.48-8-10-8z" />
                          </svg>
                          紐付済
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          未紐付
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">
                      {order.ordered_at ? new Date(order.ordered_at).toLocaleDateString("ja-JP") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom Row: Link Stats + Followup Stats */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Customer Link Stats */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">顧客紐付け</h2>
          </div>
          <div className="p-6">
            <div className="mb-4 flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-[#06C755]">{linkStats.linked}</p>
                <p className="text-xs text-gray-500">紐付け済み</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-500">{linkStats.unlinked}</p>
                <p className="text-xs text-gray-500">未紐付け</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">
                  {linkStats.linked + linkStats.unlinked > 0
                    ? Math.round((linkStats.linked / (linkStats.linked + linkStats.unlinked)) * 100)
                    : 0}%
                </p>
                <p className="text-xs text-gray-500">紐付け率</p>
              </div>
            </div>
            {linkStats.linked + linkStats.unlinked > 0 && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-[#06C755] transition-all"
                  style={{
                    width: `${(linkStats.linked / (linkStats.linked + linkStats.unlinked)) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Followup Stats */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">フォローアップ状況</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-blue-50 p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{followupStats.scheduled}</p>
                <p className="mt-1 text-xs font-medium text-blue-600">予定</p>
              </div>
              <div className="rounded-lg bg-green-50 p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{followupStats.sent}</p>
                <p className="mt-1 text-xs font-medium text-green-600">送信済み</p>
              </div>
              <div className="rounded-lg bg-red-50 p-4 text-center">
                <p className="text-2xl font-bold text-red-600">{followupStats.failed}</p>
                <p className="mt-1 text-xs font-medium text-red-600">失敗</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
