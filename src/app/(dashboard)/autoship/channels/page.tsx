"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

interface ChannelStore {
  id: string;
  channel: string;
  store_name: string;
  shop_domain: string | null;
  shop_id: string | null;
  is_active: boolean;
  last_synced_at: string | null;
}

interface ChannelProduct {
  id: string;
  store_id: string;
  channel: string;
  channel_product_id: string;
  channel_sku: string | null;
  title: string;
  image_url: string | null;
  price: number | null;
  current_stock: number | null;
  amazon_product_id: string | null;
  amazon_asin: string | null;
  sync_inventory: boolean;
  last_inventory_sync: string | null;
}

interface AmazonProduct {
  id: string;
  asin: string;
  seller_sku: string;
  title: string;
  fulfillable_qty: number;
}

export default function AutoshipChannelsPage() {
  const [stores, setStores] = useState<ChannelStore[]>([]);
  const [products, setProducts] = useState<ChannelProduct[]>([]);
  const [amazonProducts, setAmazonProducts] = useState<AmazonProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showAddStore, setShowAddStore] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [mappingProduct, setMappingProduct] = useState<string | null>(null);
  const [searchAsin, setSearchAsin] = useState("");
  const [newStore, setNewStore] = useState({
    channel: "shopify" as "shopify" | "tiktok",
    store_name: "",
    shop_domain: "",
    access_token: "",
    app_key: "",
    app_secret: "",
    shop_id: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [storesRes, productsRes, amazonRes] = await Promise.all([
      supabase.from("channel_stores").select("*").order("created_at", { ascending: false }),
      supabase.from("channel_products").select("*").order("title"),
      supabase.from("amazon_products").select("id,asin,seller_sku,title,fulfillable_qty").order("title"),
    ]);
    setStores(storesRes.data ?? []);
    setProducts(productsRes.data ?? []);
    setAmazonProducts(amazonRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleAddStore() {
    if (!newStore.store_name) return;
    try {
      const res = await fetch("/api/autoship/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStore),
      });
      if (res.ok) {
        setShowAddStore(false);
        setNewStore({ channel: "shopify", store_name: "", shop_domain: "", access_token: "", app_key: "", app_secret: "", shop_id: "" });
        fetchData();
      } else {
        const result = await res.json();
        alert("エラー: " + (result.error || "不明なエラー"));
      }
    } catch {
      alert("追加に失敗しました");
    }
  }

  async function handleSyncProducts(storeId: string) {
    setSyncing(storeId);
    try {
      const res = await fetch("/api/autoship/channels/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_id: storeId }),
      });
      const result = await res.json();
      if (res.ok) {
        alert(`${result.synced}件の商品を同期しました`);
        fetchData();
      } else {
        alert("同期エラー: " + (result.error || "不明なエラー"));
      }
    } catch {
      alert("同期に失敗しました");
    }
    setSyncing(null);
  }

  async function handleMapAsin(channelProductId: string, amazonProductId: string, amazonAsin: string) {
    try {
      const res = await fetch("/api/autoship/channels/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel_product_id: channelProductId, amazon_product_id: amazonProductId, amazon_asin: amazonAsin }),
      });
      if (res.ok) {
        setMappingProduct(null);
        setSearchAsin("");
        fetchData();
      } else {
        alert("紐付けに失敗しました");
      }
    } catch {
      alert("紐付けに失敗しました");
    }
  }

  async function handleToggleSync(productId: string, currentVal: boolean) {
    await supabase.from("channel_products").update({ sync_inventory: !currentVal }).eq("id", productId);
    fetchData();
  }

  async function handleSyncInventory() {
    try {
      const res = await fetch("/api/autoship/inventory-sync", { method: "POST" });
      const result = await res.json();
      if (res.ok) {
        alert(`在庫同期完了: ${result.synced}件更新`);
        fetchData();
      } else {
        alert("同期エラー: " + (result.error || "不明なエラー"));
      }
    } catch {
      alert("在庫同期に失敗しました");
    }
  }

  const filteredProducts = selectedStore === "all" ? products : products.filter((p) => p.store_id === selectedStore);
  const filteredAmazon = searchAsin ? amazonProducts.filter((a) => a.asin.toLowerCase().includes(searchAsin.toLowerCase()) || a.title.toLowerCase().includes(searchAsin.toLowerCase()) || a.seller_sku.toLowerCase().includes(searchAsin.toLowerCase())) : amazonProducts;

  function channelIcon(channel: string) {
    if (channel === "shopify") return <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#96BF48] text-white text-xs font-bold">S</span>;
    if (channel === "tiktok") return <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white text-xs font-bold">T</span>;
    return <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-400 text-white text-xs font-bold">?</span>;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
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
          <h1 className="text-xl font-bold text-gray-900">チャネル連携</h1>
          <p className="mt-1 text-sm text-gray-500">Shopify・TikTokショップの商品をAmazon ASINと紐付け</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSyncInventory}
            className="flex items-center gap-1.5 rounded-lg border border-green-600 px-4 py-2 text-sm font-medium text-green-600 transition-colors hover:bg-green-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            在庫一括同期
          </button>
          <button
            onClick={() => setShowAddStore(true)}
            className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            チャネル追加
          </button>
        </div>
      </div>

      {/* Add Store Modal */}
      {showAddStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="font-semibold text-gray-900">販売チャネルを追加</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">プラットフォーム</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewStore({ ...newStore, channel: "shopify" })}
                    className={`flex-1 rounded-lg border-2 p-3 text-center text-sm font-medium transition-colors ${newStore.channel === "shopify" ? "border-[#96BF48] bg-[#96BF48]/5 text-[#96BF48]" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
                  >
                    Shopify
                  </button>
                  <button
                    onClick={() => setNewStore({ ...newStore, channel: "tiktok" })}
                    className={`flex-1 rounded-lg border-2 p-3 text-center text-sm font-medium transition-colors ${newStore.channel === "tiktok" ? "border-black bg-black/5 text-black" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
                  >
                    TikTokショップ
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">ストア名</label>
                <input
                  type="text"
                  value={newStore.store_name}
                  onChange={(e) => setNewStore({ ...newStore, store_name: e.target.value })}
                  placeholder="マイストア"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                />
              </div>
              {newStore.channel === "shopify" ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Shopifyドメイン</label>
                    <input
                      type="text"
                      value={newStore.shop_domain}
                      onChange={(e) => setNewStore({ ...newStore, shop_domain: e.target.value })}
                      placeholder="mystore.myshopify.com"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">アクセストークン</label>
                    <input
                      type="password"
                      value={newStore.access_token}
                      onChange={(e) => setNewStore({ ...newStore, access_token: e.target.value })}
                      placeholder="shpat_xxxxx"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">App Key</label>
                      <input
                        type="text"
                        value={newStore.app_key}
                        onChange={(e) => setNewStore({ ...newStore, app_key: e.target.value })}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">App Secret</label>
                      <input
                        type="password"
                        value={newStore.app_secret}
                        onChange={(e) => setNewStore({ ...newStore, app_secret: e.target.value })}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">Shop ID</label>
                      <input
                        type="text"
                        value={newStore.shop_id}
                        onChange={(e) => setNewStore({ ...newStore, shop_id: e.target.value })}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">アクセストークン</label>
                      <input
                        type="password"
                        value={newStore.access_token}
                        onChange={(e) => setNewStore({ ...newStore, access_token: e.target.value })}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="mt-6 flex gap-2">
              <button onClick={handleAddStore} className="flex-1 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800">
                追加する
              </button>
              <button onClick={() => setShowAddStore(false)} className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connected Stores */}
      <div className="grid gap-4 lg:grid-cols-3">
        {stores.map((store) => (
          <div key={store.id} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {channelIcon(store.channel)}
                <div>
                  <p className="font-medium text-gray-900">{store.store_name}</p>
                  <p className="text-xs text-gray-500">{store.shop_domain || store.shop_id || store.channel}</p>
                </div>
              </div>
              <span className={`inline-flex h-2 w-2 rounded-full ${store.is_active ? "bg-green-500" : "bg-gray-300"}`} />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {store.last_synced_at ? `最終同期: ${new Date(store.last_synced_at).toLocaleString("ja-JP")}` : "未同期"}
              </p>
              <button
                onClick={() => handleSyncProducts(store.id)}
                disabled={syncing === store.id}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {syncing === store.id ? "同期中..." : "商品同期"}
              </button>
            </div>
          </div>
        ))}
        {stores.length === 0 && (
          <div className="col-span-3 rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
            <p className="text-sm text-gray-500">販売チャネルがまだ連携されていません</p>
            <button onClick={() => setShowAddStore(true)} className="mt-3 text-sm font-medium text-gray-900 hover:underline">
              チャネルを追加する
            </button>
          </div>
        )}
      </div>

      {/* Product Mapping */}
      {products.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h2 className="font-semibold text-gray-900">商品ASIN紐付け</h2>
            <div className="flex items-center gap-2">
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600"
              >
                <option value="all">すべてのストア</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.store_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50 text-left text-xs font-medium text-gray-500">
                  <th className="px-6 py-3">チャネル</th>
                  <th className="px-6 py-3">商品名</th>
                  <th className="px-6 py-3">SKU</th>
                  <th className="px-6 py-3">Amazon ASIN</th>
                  <th className="px-6 py-3">在庫同期</th>
                  <th className="px-6 py-3">FBA在庫</th>
                  <th className="px-6 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredProducts.map((product) => {
                  const linkedAmazon = product.amazon_product_id ? amazonProducts.find((a) => a.id === product.amazon_product_id) : null;
                  return (
                    <tr key={product.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-3">{channelIcon(product.channel)}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          {product.image_url ? (
                            <img src={product.image_url} alt="" className="h-8 w-8 rounded object-cover" />
                          ) : (
                            <div className="h-8 w-8 rounded bg-gray-100" />
                          )}
                          <p className="max-w-xs truncate text-sm font-medium text-gray-900">{product.title}</p>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">{product.channel_sku || "-"}</td>
                      <td className="px-6 py-3">
                        {product.amazon_asin ? (
                          <code className="rounded bg-[#FF9900]/10 px-1.5 py-0.5 text-xs font-medium text-[#FF9900]">{product.amazon_asin}</code>
                        ) : (
                          <span className="text-xs text-gray-400">未紐付け</span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        {product.amazon_product_id && (
                          <button
                            onClick={() => handleToggleSync(product.id, product.sync_inventory)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${product.sync_inventory ? "bg-green-500" : "bg-gray-200"}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${product.sync_inventory ? "translate-x-4" : "translate-x-0.5"}`} />
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        {linkedAmazon ? (
                          <span className={`text-sm font-medium ${linkedAmazon.fulfillable_qty === 0 ? "text-red-600" : linkedAmazon.fulfillable_qty <= 5 ? "text-yellow-600" : "text-green-600"}`}>
                            {linkedAmazon.fulfillable_qty}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        {mappingProduct === product.id ? (
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <input
                                type="text"
                                value={searchAsin}
                                onChange={(e) => setSearchAsin(e.target.value)}
                                placeholder="ASINまたはSKUで検索"
                                className="w-48 rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-[#FF9900] focus:outline-none focus:ring-2 focus:ring-[#FF9900]/20"
                                autoFocus
                              />
                              {searchAsin && filteredAmazon.length > 0 && (
                                <div className="absolute z-10 mt-1 max-h-48 w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                                  {filteredAmazon.slice(0, 10).map((ap) => (
                                    <button
                                      key={ap.id}
                                      onClick={() => handleMapAsin(product.id, ap.id, ap.asin)}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50"
                                    >
                                      <code className="rounded bg-[#FF9900]/10 px-1 text-[#FF9900]">{ap.asin}</code>
                                      <span className="truncate text-gray-600">{ap.title}</span>
                                      <span className="ml-auto text-gray-400">({ap.fulfillable_qty})</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <button onClick={() => { setMappingProduct(null); setSearchAsin(""); }} className="text-xs text-gray-400 hover:text-gray-600">
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setMappingProduct(product.id)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                              product.amazon_asin
                                ? "border border-gray-200 text-gray-500 hover:bg-gray-50"
                                : "bg-[#FF9900] text-white hover:bg-[#E88B00]"
                            }`}
                          >
                            {product.amazon_asin ? "変更" : "ASIN紐付け"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
