"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

const CHANNEL_ID = "00000000-0000-0000-0000-000000000010";

const CATEGORY_PRESETS = [
  "基本情報",
  "サービス・商品",
  "料金",
  "営業時間・アクセス",
  "よくある質問",
  "キャンペーン",
  "ポリシー",
  "その他",
];

const CATEGORY_COLORS: Record<string, string> = {
  基本情報: "bg-blue-100 text-blue-700",
  "サービス・商品": "bg-purple-100 text-purple-700",
  料金: "bg-yellow-100 text-yellow-700",
  "営業時間・アクセス": "bg-green-100 text-green-700",
  よくある質問: "bg-orange-100 text-orange-700",
  キャンペーン: "bg-pink-100 text-pink-700",
  ポリシー: "bg-red-100 text-red-700",
  その他: "bg-gray-100 text-gray-700",
};

interface KnowledgeItem {
  id: string;
  channel_id: string;
  category: string;
  title: string;
  content: string;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface FormData {
  category: string;
  custom_category: string;
  title: string;
  content: string;
  priority: number;
  is_active: boolean;
}

const defaultForm: FormData = {
  category: "基本情報",
  custom_category: "",
  title: "",
  content: "",
  priority: 0,
  is_active: true,
};

export default function KnowledgePage() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("すべて");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [useCustomCategory, setUseCustomCategory] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("knowledge_base")
      .select("*")
      .eq("channel_id", CHANNEL_ID)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });

    setItems((data ?? []) as KnowledgeItem[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const categories = [
    "すべて",
    ...Array.from(new Set(items.map((item) => item.category))),
  ];

  const filteredItems =
    activeCategory === "すべて"
      ? items
      : items.filter((item) => item.category === activeCategory);

  function openAdd() {
    setEditingId(null);
    setForm(defaultForm);
    setUseCustomCategory(false);
    setShowModal(true);
  }

  function openEdit(item: KnowledgeItem) {
    setEditingId(item.id);
    const isPreset = CATEGORY_PRESETS.includes(item.category);
    setForm({
      category: isPreset ? item.category : "その他",
      custom_category: isPreset ? "" : item.category,
      title: item.title,
      content: item.content,
      priority: item.priority,
      is_active: item.is_active,
    });
    setUseCustomCategory(!isPreset);
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    const category = useCustomCategory
      ? form.custom_category.trim() || "その他"
      : form.category;

    const payload = {
      channel_id: CHANNEL_ID,
      category,
      title: form.title.trim(),
      content: form.content,
      priority: form.priority,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      await supabase
        .from("knowledge_base")
        .update(payload)
        .eq("id", editingId);
    } else {
      await supabase.from("knowledge_base").insert({
        ...payload,
        created_at: new Date().toISOString(),
      });
    }

    setSaving(false);
    setShowModal(false);
    fetchItems();
  }

  async function handleDelete(id: string) {
    if (!confirm("このナレッジを削除しますか？")) return;
    await supabase.from("knowledge_base").delete().eq("id", id);
    fetchItems();
  }

  async function handleToggleActive(item: KnowledgeItem) {
    await supabase
      .from("knowledge_base")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    fetchItems();
  }

  function getCategoryColor(category: string) {
    return CATEGORY_COLORS[category] ?? "bg-gray-100 text-gray-700";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#06C755] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ナレッジベース</h1>
          <p className="mt-1 text-sm text-gray-500">
            AIが回答に使用する情報を管理します。カテゴリごとに整理して追加してください。
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 rounded-lg bg-[#06C755] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#05b34c] transition-colors"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          新規ナレッジ追加
        </button>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeCategory === cat
                ? "bg-[#06C755] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Knowledge list */}
      {filteredItems.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-400">ナレッジがまだありません</p>
          <button
            onClick={openAdd}
            className="mt-4 text-sm font-medium text-[#06C755] hover:underline"
          >
            最初のナレッジを追加する
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border bg-white p-5 shadow-sm transition-opacity ${
                item.is_active
                  ? "border-gray-200"
                  : "border-gray-100 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${getCategoryColor(
                        item.category
                      )}`}
                    >
                      {item.category}
                    </span>
                    {item.priority > 0 && (
                      <span className="text-xs text-gray-400">
                        優先度: {item.priority}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                    {item.content}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {/* Active toggle */}
                  <button
                    onClick={() => handleToggleActive(item)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
                      item.is_active ? "bg-[#06C755]" : "bg-gray-300"
                    }`}
                    title={item.is_active ? "有効" : "無効"}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                        item.is_active ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                  {/* Edit */}
                  <button
                    onClick={() => openEdit(item)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    title="編集"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    title="削除"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-6 text-lg font-bold text-gray-900">
              {editingId ? "ナレッジ編集" : "新規ナレッジ追加"}
            </h2>
            <div className="space-y-4">
              {/* Category */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  カテゴリ
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <label className="flex items-center gap-1 text-sm text-gray-600">
                    <input
                      type="radio"
                      checked={!useCustomCategory}
                      onChange={() => setUseCustomCategory(false)}
                      className="accent-[#06C755]"
                    />
                    プリセット
                  </label>
                  <label className="flex items-center gap-1 text-sm text-gray-600">
                    <input
                      type="radio"
                      checked={useCustomCategory}
                      onChange={() => setUseCustomCategory(true)}
                      className="accent-[#06C755]"
                    />
                    カスタム
                  </label>
                </div>
                {useCustomCategory ? (
                  <input
                    type="text"
                    value={form.custom_category}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        custom_category: e.target.value,
                      }))
                    }
                    placeholder="カテゴリ名を入力"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
                  />
                ) : (
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        category: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
                  >
                    {CATEGORY_PRESETS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  タイトル
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="ナレッジのタイトル"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
                />
              </div>

              {/* Content */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  内容
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, content: e.target.value }))
                  }
                  rows={12}
                  placeholder="AIが参照する情報を入力してください"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  優先度
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.priority}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      priority: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="w-32 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
                />
                <p className="mt-1 text-xs text-gray-400">
                  数値が高いほど優先的に参照されます
                </p>
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">
                  有効/無効
                </label>
                <button
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      is_active: !prev.is_active,
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
                    form.is_active ? "bg-[#06C755]" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                      form.is_active ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-sm text-gray-500">
                  {form.is_active ? "有効" : "無効"}
                </span>
              </div>
            </div>

            {/* Modal actions */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim()}
                className="rounded-lg bg-[#06C755] px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#05b34c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "保存中..." : editingId ? "更新" : "追加"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
