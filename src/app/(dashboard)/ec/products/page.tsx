"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

const CHANNEL_ID = "00000000-0000-0000-0000-000000000010";

interface Product {
  id: string;
  external_product_id: string;
  product_name: string;
  variant_name: string;
  sku: string;
  image_url: string | null;
  total_sold: number;
  total_revenue: number;
}

interface FollowupSetting {
  id: string;
  product_name: string;
  delivery_followup_days: number;
  product_followup_days: number;
  review_request_days: number;
  repeat_suggestion_days: number;
  enabled: boolean;
}

export default function ECProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [followupSettings, setFollowupSettings] = useState<Record<string, FollowupSetting>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    delivery_followup_days: 7,
    product_followup_days: 14,
    review_request_days: 21,
    repeat_suggestion_days: 30,
    enabled: true,
  });

  const fetchProducts = useCallback(async () => {
    setLoading(true);

    // Get product stats from order items
    const { data: items } = await supabase
      .from("ec_order_items")
      .select("external_product_id, product_name, variant_name, sku, image_url, quantity, total_price, order:ec_orders!inner(channel_id)")
      .eq("order.channel_id", CHANNEL_ID);

    if (items) {
      const productMap = new Map<string, Product>();

      for (const item of items as any[]) {
        const key = item.external_product_id;
        if (!productMap.has(key)) {
          productMap.set(key, {
            id: key,
            external_product_id: key,
            product_name: item.product_name,
            variant_name: item.variant_name,
            sku: item.sku,
            image_url: item.image_url,
            total_sold: 0,
            total_revenue: 0,
          });
        }
        const p = productMap.get(key)!;
        p.total_sold += item.quantity;
        p.total_revenue += parseFloat(item.total_price || 0);
      }

      let productList = Array.from(productMap.values()).sort((a, b) => b.total_revenue - a.total_revenue);

      if (search) {
        const s = search.toLowerCase();
        productList = productList.filter(
          (p) =>
            p.product_name.toLowerCase().includes(s) ||
            p.sku?.toLowerCase().includes(s)
        );
      }

      setProducts(productList);
    } else {
      setProducts([]);
    }

    // Fetch followup settings
    const { data: settings } = await supabase
      .from("ec_product_followup_settings")
      .select("*")
      .eq("channel_id", CHANNEL_ID);

    if (settings) {
      const settingsMap: Record<string, FollowupSetting> = {};
      for (const s of settings) {
        settingsMap[s.external_product_id] = s;
      }
      setFollowupSettings(settingsMap);
    }

    setLoading(false);
  }, [search]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  async function saveFollowupSettings(productId: string, productName: string) {
    const { error } = await supabase
      .from("ec_product_followup_settings")
      .upsert(
        {
          channel_id: CHANNEL_ID,
          external_product_id: productId,
          product_name: productName,
          delivery_followup_days: editForm.delivery_followup_days,
          product_followup_days: editForm.product_followup_days,
          review_request_days: editForm.review_request_days,
          repeat_suggestion_days: editForm.repeat_suggestion_days,
          enabled: editForm.enabled,
        },
        { onConflict: "channel_id,external_product_id" }
      );

    if (error) {
      alert("保存に失敗しました: " + error.message);
      return;
    }

    setEditingProduct(null);
    fetchProducts();
  }

  function openEdit(product: Product) {
    const existing = followupSettings[product.external_product_id];
    if (existing) {
      setEditForm({
        delivery_followup_days: existing.delivery_followup_days,
        product_followup_days: existing.product_followup_days,
        review_request_days: existing.review_request_days,
        repeat_suggestion_days: existing.repeat_suggestion_days,
        enabled: existing.enabled,
      });
    } else {
      setEditForm({
        delivery_followup_days: 7,
        product_followup_days: 14,
        review_request_days: 21,
        repeat_suggestion_days: 30,
        enabled: true,
      });
    }
    setEditingProduct(product.external_product_id);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/ec" className="hover:text-[#06C755]">EC連携</Link>
          <span>/</span>
          <span className="text-gray-900">商品管理</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">商品管理</h1>
        <p className="mt-1 text-sm text-gray-500">商品ごとのフォローアップ設定を管理</p>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="商品名、SKUで検索..."
          className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
        />
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#06C755] border-t-transparent" />
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">
            {search ? "条件に一致する商品がありません" : "まだ商品データがありません。ストアを同期して注文を取り込んでください。"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const setting = followupSettings[product.external_product_id];
            const isEditing = editingProduct === product.external_product_id;

            return (
              <div key={product.external_product_id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                {/* Product Info */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.product_name}
                        className="h-14 w-14 rounded-lg border border-gray-100 object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gray-100">
                        <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{product.product_name}</p>
                      {product.variant_name && (
                        <p className="truncate text-xs text-gray-500">{product.variant_name}</p>
                      )}
                      {product.sku && (
                        <p className="mt-0.5 text-xs text-gray-400 font-mono">SKU: {product.sku}</p>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="mt-3 flex gap-4">
                    <div>
                      <p className="text-xs text-gray-500">販売数</p>
                      <p className="text-sm font-semibold text-gray-900">{product.total_sold}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">売上</p>
                      <p className="text-sm font-semibold text-gray-900">¥{product.total_revenue.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Followup Status */}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {setting?.enabled !== false ? (
                        <>
                          <span className="h-2 w-2 rounded-full bg-[#06C755]" />
                          <span className="text-xs text-[#06C755] font-medium">フォローアップ有効</span>
                        </>
                      ) : (
                        <>
                          <span className="h-2 w-2 rounded-full bg-gray-300" />
                          <span className="text-xs text-gray-400">フォローアップ無効</span>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => isEditing ? setEditingProduct(null) : openEdit(product)}
                      className="text-xs font-medium text-[#06C755] hover:underline"
                    >
                      {isEditing ? "閉じる" : "設定"}
                    </button>
                  </div>
                </div>

                {/* Edit Followup Settings */}
                {isEditing && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4">
                    <p className="mb-3 text-xs font-semibold text-gray-700">フォローアップ設定</p>

                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-gray-600">配達確認</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={editForm.delivery_followup_days}
                            onChange={(e) => setEditForm({ ...editForm, delivery_followup_days: parseInt(e.target.value) || 0 })}
                            className="w-14 rounded border border-gray-300 px-2 py-1 text-center text-xs focus:border-[#06C755] focus:outline-none"
                          />
                          <span className="text-xs text-gray-500">日後</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="text-xs text-gray-600">使用感確認</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={editForm.product_followup_days}
                            onChange={(e) => setEditForm({ ...editForm, product_followup_days: parseInt(e.target.value) || 0 })}
                            className="w-14 rounded border border-gray-300 px-2 py-1 text-center text-xs focus:border-[#06C755] focus:outline-none"
                          />
                          <span className="text-xs text-gray-500">日後</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="text-xs text-gray-600">レビュー依頼</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={editForm.review_request_days}
                            onChange={(e) => setEditForm({ ...editForm, review_request_days: parseInt(e.target.value) || 0 })}
                            className="w-14 rounded border border-gray-300 px-2 py-1 text-center text-xs focus:border-[#06C755] focus:outline-none"
                          />
                          <span className="text-xs text-gray-500">日後</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="text-xs text-gray-600">リピート提案</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={editForm.repeat_suggestion_days}
                            onChange={(e) => setEditForm({ ...editForm, repeat_suggestion_days: parseInt(e.target.value) || 0 })}
                            className="w-14 rounded border border-gray-300 px-2 py-1 text-center text-xs focus:border-[#06C755] focus:outline-none"
                          />
                          <span className="text-xs text-gray-500">日後</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <label className="text-xs text-gray-600">有効/無効</label>
                        <button
                          onClick={() => setEditForm({ ...editForm, enabled: !editForm.enabled })}
                          className={`relative h-5 w-9 rounded-full transition-colors ${
                            editForm.enabled ? "bg-[#06C755]" : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                              editForm.enabled ? "left-[18px]" : "left-0.5"
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => saveFollowupSettings(product.external_product_id, product.product_name)}
                        className="flex-1 rounded-lg bg-[#06C755] py-1.5 text-xs font-medium text-white hover:bg-[#05b34c]"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditingProduct(null)}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
