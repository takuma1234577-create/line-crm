"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

const CHANNEL_ID = "00000000-0000-0000-0000-000000000010";
const PAGE_SIZE = 20;

interface Order {
  id: string;
  external_order_id: string;
  platform: string;
  store_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total_amount: number;
  currency: string;
  order_status: string;
  payment_status: string;
  friend_id: string | null;
  tracking_number: string | null;
  carrier: string | null;
  ordered_at: string;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "すべてのステータス" },
  { value: "pending", label: "保留中" },
  { value: "confirmed", label: "確認済" },
  { value: "shipped", label: "発送済" },
  { value: "delivered", label: "配達済" },
  { value: "cancelled", label: "キャンセル" },
  { value: "returned", label: "返品" },
];

const PLATFORM_OPTIONS = [
  { value: "", label: "すべてのプラットフォーム" },
  { value: "shopify", label: "Shopify" },
  { value: "amazon", label: "Amazon" },
];

export default function ECOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const fetchOrders = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("ec_orders")
      .select("*", { count: "exact" })
      .eq("channel_id", CHANNEL_ID)
      .order("ordered_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (statusFilter) {
      query = query.eq("order_status", statusFilter);
    }
    if (platformFilter) {
      query = query.eq("platform", platformFilter);
    }
    if (search) {
      query = query.or(`customer_name.ilike.%${search}%,customer_email.ilike.%${search}%,external_order_id.ilike.%${search}%`);
    }

    const { data, count } = await query;
    setOrders(data ?? []);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [page, statusFilter, platformFilter, search]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    setPage(0);
  }, [search, statusFilter, platformFilter]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

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

  function paymentBadge(status: string) {
    if (status === "paid") {
      return <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">支払済</span>;
    }
    return <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">未払い</span>;
  }

  function platformIcon(platform: string) {
    if (platform === "shopify") {
      return <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[#96BF48] text-white text-[10px] font-bold">S</span>;
    }
    if (platform === "amazon") {
      return <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[#FF9900] text-white text-[10px] font-bold">A</span>;
    }
    return <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-gray-400 text-white text-[10px] font-bold">?</span>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link href="/ec" className="hover:text-[#06C755]">EC連携</Link>
            <span>/</span>
            <span className="text-gray-900">注文一覧</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">注文一覧</h1>
        </div>
        <p className="text-sm text-gray-500">{totalCount}件の注文</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="顧客名、メール、注文IDで検索..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
        >
          {PLATFORM_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#06C755] border-t-transparent" />
          </div>
        ) : orders.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-gray-500">条件に一致する注文がありません</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium text-gray-500">
                  <th className="px-4 py-3">注文ID</th>
                  <th className="px-4 py-3">PF</th>
                  <th className="px-4 py-3">顧客名</th>
                  <th className="px-4 py-3">メール</th>
                  <th className="px-4 py-3">金額</th>
                  <th className="px-4 py-3">注文ステータス</th>
                  <th className="px-4 py-3">支払い</th>
                  <th className="px-4 py-3">LINE</th>
                  <th className="px-4 py-3">追跡番号</th>
                  <th className="px-4 py-3">注文日</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-gray-600">
                      {order.external_order_id.length > 12 ? order.external_order_id.slice(0, 12) + "..." : order.external_order_id}
                    </td>
                    <td className="px-4 py-3">{platformIcon(order.platform)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{order.customer_name || "-"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{order.customer_email || "-"}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {order.currency === "JPY" ? "¥" : "$"}{order.total_amount?.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">{statusBadge(order.order_status)}</td>
                    <td className="px-4 py-3">{paymentBadge(order.payment_status)}</td>
                    <td className="px-4 py-3">
                      {order.friend_id ? (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#06C755]">
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </span>
                      ) : (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-200">
                          <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {order.tracking_number ? (
                        <span className="font-mono">{order.tracking_number}</span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {order.ordered_at ? new Date(order.ordered_at).toLocaleDateString("ja-JP") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
            <p className="text-xs text-gray-500">
              {page * PAGE_SIZE + 1} - {Math.min((page + 1) * PAGE_SIZE, totalCount)} / {totalCount}件
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                前へ
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const pageNum = page < 3 ? i : page - 2 + i;
                if (pageNum >= totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      pageNum === page
                        ? "bg-[#06C755] text-white"
                        : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                次へ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
