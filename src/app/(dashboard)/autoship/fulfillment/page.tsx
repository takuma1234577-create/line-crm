"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

interface PendingOrder {
  id: string;
  external_order_id: string;
  platform: string;
  customer_name: string;
  total_amount: number;
  currency: string;
  order_status: string;
  ordered_at: string;
  store_name?: string;
  items: OrderItem[];
}

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  sku: string;
  asin: string | null;
}

interface FulfillmentLog {
  id: string;
  order_id: string;
  event: string;
  message: string;
  payload: any;
  created_at: string;
}

interface Stats {
  pendingFulfillment: number;
  processing: number;
  shipped: number;
  todayFulfilled: number;
}

export default function AutoshipFulfillmentPage() {
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [logs, setLogs] = useState<FulfillmentLog[]>([]);
  const [stats, setStats] = useState<Stats>({ pendingFulfillment: 0, processing: 0, shipped: 0, todayFulfilled: 0 });
  const [loading, setLoading] = useState(true);
  const [fulfilling, setFulfilling] = useState<string | null>(null);
  const [autoMode, setAutoMode] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Get orders that are confirmed (paid) but not yet fulfilled
    const { data: orders } = await supabase
      .from("autoship_orders")
      .select(`
        *,
        autoship_order_items (*)
      `)
      .in("order_status", ["confirmed", "processing"])
      .order("ordered_at", { ascending: false })
      .limit(50);

    // Get channel store names
    const storeIds = [...new Set((orders ?? []).map((o: any) => o.store_id).filter(Boolean))];
    const { data: storeData } = storeIds.length > 0
      ? await supabase.from("channel_stores").select("id,store_name").in("id", storeIds)
      : { data: [] };
    const storeMap = new Map((storeData ?? []).map((s: any) => [s.id, s.store_name]));

    // Get ASIN mappings for order items
    const formatted: PendingOrder[] = (orders ?? []).map((o: any) => ({
      id: o.id,
      external_order_id: o.external_order_id,
      platform: o.platform,
      customer_name: o.customer_name,
      total_amount: o.total_amount,
      currency: o.currency,
      order_status: o.order_status,
      ordered_at: o.ordered_at,
      store_name: storeMap.get(o.store_id) || "",
      items: (o.autoship_order_items ?? []).map((item: any) => ({
        id: item.id,
        product_name: item.product_name,
        quantity: item.quantity,
        sku: item.sku,
        asin: item.asin,
      })),
    }));

    setPendingOrders(formatted);

    // Get fulfillment logs
    const { data: logData } = await supabase
      .from("fulfillment_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setLogs(logData ?? []);

    // Compute stats
    const today = new Date().toISOString().slice(0, 10);
    const todayLogs = (logData ?? []).filter((l: any) => l.created_at.startsWith(today) && l.event === "mcf_created");

    setStats({
      pendingFulfillment: formatted.filter((o) => o.order_status === "confirmed").length,
      processing: formatted.filter((o) => o.order_status === "processing").length,
      shipped: (logData ?? []).filter((l: any) => l.event === "shipped").length,
      todayFulfilled: todayLogs.length,
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleFulfill(orderId: string) {
    setFulfilling(orderId);
    try {
      const res = await fetch("/api/autoship/fulfillment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId }),
      });
      const result = await res.json();
      if (res.ok) {
        alert("MCF配送を作成しました");
        fetchData();
      } else {
        alert("配送エラー: " + (result.error || "不明なエラー"));
      }
    } catch {
      alert("配送に失敗しました");
    }
    setFulfilling(null);
  }

  function platformBadge(platform: string) {
    if (platform === "shopify") return <span className="inline-flex items-center rounded-full bg-[#96BF48]/10 px-2 py-0.5 text-xs font-medium text-[#96BF48]">Shopify</span>;
    if (platform === "tiktok") return <span className="inline-flex items-center rounded-full bg-black/10 px-2 py-0.5 text-xs font-medium text-black">TikTok</span>;
    return <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{platform}</span>;
  }

  function eventBadge(event: string) {
    const config: Record<string, { label: string; className: string }> = {
      mcf_created: { label: "MCF作成", className: "bg-blue-50 text-blue-700" },
      mcf_submitted: { label: "送信済", className: "bg-indigo-50 text-indigo-700" },
      processing: { label: "処理中", className: "bg-yellow-50 text-yellow-700" },
      shipped: { label: "発送済", className: "bg-green-50 text-green-700" },
      delivered: { label: "配達完了", className: "bg-green-50 text-green-700" },
      tracking_updated: { label: "追跡更新", className: "bg-purple-50 text-purple-700" },
      error: { label: "エラー", className: "bg-red-50 text-red-700" },
    };
    const c = config[event] || { label: event, className: "bg-gray-100 text-gray-600" };
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${c.className}`}>{c.label}</span>;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-gray-200 bg-white" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-xl border border-gray-200 bg-white" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">自動配送管理</h1>
          <p className="mt-1 text-sm text-gray-500">Amazon MCFマルチチャネル配送</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">自動配送</span>
            <button
              onClick={() => setAutoMode(!autoMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoMode ? "bg-green-500" : "bg-gray-200"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoMode ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-orange-50 p-2">
              <svg className="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-500">配送待ち</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-orange-600">{stats.pendingFulfillment}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-blue-50 p-2">
              <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-500">処理中</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-blue-600">{stats.processing}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-green-50 p-2">
              <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-500">発送完了</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-green-600">{stats.shipped}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-purple-50 p-2">
              <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-500">本日配送</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-purple-600">{stats.todayFulfilled}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pending Orders */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="font-semibold text-gray-900">配送待ち注文</h2>
          </div>
          {pendingOrders.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
                <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">配送待ちの注文はありません</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {pendingOrders.map((order) => {
                const hasAsin = order.items.some((item) => item.asin);
                return (
                  <div key={order.id} className="px-6 py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{platformBadge(order.platform)}</div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">#{order.external_order_id}</p>
                            {order.store_name && <span className="text-xs text-gray-400">{order.store_name}</span>}
                          </div>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {order.customer_name} · {order.currency === "JPY" ? "¥" : "$"}{order.total_amount?.toLocaleString()} · {new Date(order.ordered_at).toLocaleString("ja-JP")}
                          </p>
                          <div className="mt-2 space-y-1">
                            {order.items.map((item) => (
                              <div key={item.id} className="flex items-center gap-2 text-xs text-gray-600">
                                <span>{item.product_name} x{item.quantity}</span>
                                {item.asin ? (
                                  <code className="rounded bg-[#FF9900]/10 px-1 text-[10px] text-[#FF9900]">{item.asin}</code>
                                ) : (
                                  <span className="rounded bg-red-50 px-1 text-[10px] text-red-500">ASIN未設定</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleFulfill(order.id)}
                        disabled={fulfilling === order.id || !hasAsin}
                        className={`rounded-lg px-4 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                          hasAsin
                            ? "bg-[#FF9900] text-white hover:bg-[#E88B00]"
                            : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        }`}
                        title={!hasAsin ? "ASIN紐付けが必要です" : ""}
                      >
                        {fulfilling === order.id ? "処理中..." : "MCF配送"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fulfillment Logs */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="font-semibold text-gray-900">配送ログ</h2>
          </div>
          {logs.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-gray-500">まだ配送ログがありません</p>
            </div>
          ) : (
            <div className="max-h-[600px] divide-y divide-gray-50 overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    {eventBadge(log.event)}
                    <span className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString("ja-JP")}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">{log.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
