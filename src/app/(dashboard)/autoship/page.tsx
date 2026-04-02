"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

interface AmazonAccount {
  id: string;
  account_name: string;
  seller_id: string;
  marketplace_id: string;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
}

interface AmazonProduct {
  id: string;
  asin: string;
  seller_sku: string;
  title: string;
  image_url: string | null;
  price: number | null;
  currency: string | null;
  fulfillable_qty: number;
  inbound_qty: number;
  reserved_qty: number;
  total_qty: number;
  status: string;
  last_inventory_sync: string | null;
}

interface Stats {
  totalProducts: number;
  totalStock: number;
  lowStock: number;
  outOfStock: number;
  channelsMapped: number;
}

export default function AutoshipDashboardPage() {
  const [accounts, setAccounts] = useState<AmazonAccount[]>([]);
  const [products, setProducts] = useState<AmazonProduct[]>([]);
  const [stats, setStats] = useState<Stats>({ totalProducts: 0, totalStock: 0, lowStock: 0, outOfStock: 0, channelsMapped: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [connectForm, setConnectForm] = useState({
    account_name: "",
    seller_id: "",
    marketplace_id: "A1VC38T7YXB528",
    refresh_token: "",
    client_id: "",
    client_secret: "",
  });
  const [connecting, setConnecting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [accountsRes, productsRes, mappedRes] = await Promise.all([
      supabase.from("amazon_sp_accounts").select("*").order("created_at", { ascending: false }),
      supabase.from("amazon_products").select("*").order("title"),
      supabase.from("channel_products").select("*", { count: "exact", head: true }).not("amazon_product_id", "is", null),
    ]);

    const accts = accountsRes.data ?? [];
    const prods = productsRes.data ?? [];

    setAccounts(accts);
    setProducts(prods);
    setStats({
      totalProducts: prods.length,
      totalStock: prods.reduce((sum, p) => sum + (p.fulfillable_qty || 0), 0),
      lowStock: prods.filter((p) => p.fulfillable_qty > 0 && p.fulfillable_qty <= 5).length,
      outOfStock: prods.filter((p) => p.fulfillable_qty === 0).length,
      channelsMapped: mappedRes.count ?? 0,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleConnect() {
    if (!connectForm.account_name || !connectForm.seller_id || !connectForm.refresh_token || !connectForm.client_id || !connectForm.client_secret) {
      alert("すべての項目を入力してください");
      return;
    }
    setConnecting(true);
    try {
      const res = await fetch("/api/autoship/amazon/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(connectForm),
      });
      const result = await res.json();
      if (res.ok) {
        alert("Amazon SP-APIアカウントを接続しました");
        setShowConnect(false);
        setConnectForm({ account_name: "", seller_id: "", marketplace_id: "A1VC38T7YXB528", refresh_token: "", client_id: "", client_secret: "" });
        fetchData();
      } else {
        alert("接続エラー: " + (result.error || "不明なエラー"));
      }
    } catch {
      alert("接続に失敗しました");
    }
    setConnecting(false);
  }

  async function handleSyncProducts() {
    if (accounts.length === 0) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/autoship/amazon/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sp_account_id: accounts[0].id }),
      });
      const result = await res.json();
      if (res.ok) {
        alert(`同期完了: ${result.synced}件の商品を更新しました`);
        fetchData();
      } else {
        alert("同期エラー: " + (result.error || "不明なエラー"));
      }
    } catch {
      alert("同期に失敗しました");
    }
    setSyncing(false);
  }

  function stockBadge(qty: number) {
    if (qty === 0) return <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">在庫切れ</span>;
    if (qty <= 5) return <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">残少 ({qty})</span>;
    return <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">{qty}</span>;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
              <div className="mt-2 h-8 w-16 animate-pulse rounded bg-gray-200" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
          <div className="mt-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Amazon配送自動化</h1>
          <p className="mt-1 text-sm text-gray-500">FBA在庫管理・マルチチャネル配送</p>
        </div>
        <div className="flex gap-2">
          {accounts.length > 0 && (
            <button
              onClick={handleSyncProducts}
              disabled={syncing}
              className="flex items-center gap-1.5 rounded-lg border border-[#FF9900] px-4 py-2 text-sm font-medium text-[#FF9900] transition-colors hover:bg-[#FF9900]/5 disabled:opacity-50"
            >
              {syncing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#FF9900] border-t-transparent" />
                  同期中...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  在庫同期
                </>
              )}
            </button>
          )}
          <button
            onClick={() => setShowConnect(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#FF9900] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E88B00]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Amazon連携
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-[#FF9900]/10 p-2">
              <svg className="h-4 w-4 text-[#FF9900]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-500">商品数</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900">{stats.totalProducts}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-green-50 p-2">
              <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L12 12.75 6.429 9.75m11.142 0l4.179 2.25L12 17.25 2.25 12l4.179-2.25" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-500">総在庫数</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-green-600">{stats.totalStock.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-yellow-50 p-2">
              <svg className="h-4 w-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-500">残少</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-yellow-600">{stats.lowStock}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-red-50 p-2">
              <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-500">在庫切れ</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-red-600">{stats.outOfStock}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-blue-50 p-2">
              <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-500">ASIN紐付済</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-blue-600">{stats.channelsMapped}</p>
        </div>
      </div>

      {/* Amazon Connection Modal */}
      {showConnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF9900]">
                <span className="text-lg font-bold text-white">A</span>
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Amazon SP-API連携</h2>
                <p className="text-xs text-gray-500">セラーセントラルのAPI認証情報を入力</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">アカウント名</label>
                <input
                  type="text"
                  value={connectForm.account_name}
                  onChange={(e) => setConnectForm({ ...connectForm, account_name: e.target.value })}
                  placeholder="例: メインアカウント"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#FF9900] focus:outline-none focus:ring-2 focus:ring-[#FF9900]/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">セラーID</label>
                  <input
                    type="text"
                    value={connectForm.seller_id}
                    onChange={(e) => setConnectForm({ ...connectForm, seller_id: e.target.value })}
                    placeholder="A1B2C3D4E5F6G7"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#FF9900] focus:outline-none focus:ring-2 focus:ring-[#FF9900]/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">マーケットプレイスID</label>
                  <input
                    type="text"
                    value={connectForm.marketplace_id}
                    onChange={(e) => setConnectForm({ ...connectForm, marketplace_id: e.target.value })}
                    placeholder="A1VC38T7YXB528"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#FF9900] focus:outline-none focus:ring-2 focus:ring-[#FF9900]/20"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">LWA Client ID</label>
                <input
                  type="text"
                  value={connectForm.client_id}
                  onChange={(e) => setConnectForm({ ...connectForm, client_id: e.target.value })}
                  placeholder="amzn1.application-oa2-client.xxxxx"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#FF9900] focus:outline-none focus:ring-2 focus:ring-[#FF9900]/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">LWA Client Secret</label>
                <input
                  type="password"
                  value={connectForm.client_secret}
                  onChange={(e) => setConnectForm({ ...connectForm, client_secret: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#FF9900] focus:outline-none focus:ring-2 focus:ring-[#FF9900]/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">リフレッシュトークン</label>
                <input
                  type="password"
                  value={connectForm.refresh_token}
                  onChange={(e) => setConnectForm({ ...connectForm, refresh_token: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#FF9900] focus:outline-none focus:ring-2 focus:ring-[#FF9900]/20"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="flex-1 rounded-lg bg-[#FF9900] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#E88B00] disabled:opacity-50"
              >
                {connecting ? "接続確認中..." : "接続する"}
              </button>
              <button
                onClick={() => setShowConnect(false)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connected Accounts */}
      {accounts.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="font-semibold text-gray-900">接続済みアカウント</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {accounts.map((acct) => (
              <div key={acct.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF9900]">
                    <span className="text-sm font-bold text-white">A</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{acct.account_name}</p>
                    <p className="text-xs text-gray-500">
                      セラーID: {acct.seller_id}
                      {acct.last_synced_at && (
                        <span className="ml-2 text-gray-400">最終同期: {new Date(acct.last_synced_at).toLocaleString("ja-JP")}</span>
                      )}
                    </p>
                  </div>
                </div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${acct.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {acct.is_active ? "接続中" : "無効"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Products with no account */}
      {accounts.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FF9900]/10">
            <span className="text-3xl font-bold text-[#FF9900]">A</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Amazonアカウントを連携しましょう</h3>
          <p className="mt-2 text-sm text-gray-500">SP-APIの認証情報を入力して、FBA在庫管理とマルチチャネル配送を開始</p>
          <button
            onClick={() => setShowConnect(true)}
            className="mt-4 rounded-lg bg-[#FF9900] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#E88B00]"
          >
            Amazonと連携する
          </button>
        </div>
      )}

      {/* Product List */}
      {products.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h2 className="font-semibold text-gray-900">FBA商品一覧</h2>
            <Link href="/autoship/channels" className="text-sm font-medium text-[#FF9900] hover:underline">
              チャネル紐付け →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50 text-left text-xs font-medium text-gray-500">
                  <th className="px-6 py-3">商品</th>
                  <th className="px-6 py-3">ASIN</th>
                  <th className="px-6 py-3">SKU</th>
                  <th className="px-6 py-3 text-right">出荷可能</th>
                  <th className="px-6 py-3 text-right">入庫中</th>
                  <th className="px-6 py-3 text-right">予約済</th>
                  <th className="px-6 py-3">ステータス</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        {product.image_url ? (
                          <img src={product.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M18 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75z" />
                            </svg>
                          </div>
                        )}
                        <p className="max-w-xs truncate text-sm font-medium text-gray-900">{product.title || "タイトル未取得"}</p>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">{product.asin}</code>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">{product.seller_sku}</td>
                    <td className="px-6 py-3 text-right">{stockBadge(product.fulfillable_qty)}</td>
                    <td className="px-6 py-3 text-right text-sm text-gray-600">{product.inbound_qty}</td>
                    <td className="px-6 py-3 text-right text-sm text-gray-600">{product.reserved_qty}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        product.status === "Active" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {product.status || "-"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
