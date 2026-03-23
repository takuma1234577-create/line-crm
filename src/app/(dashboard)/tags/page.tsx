"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

const CHANNEL_ID = "00000000-0000-0000-0000-000000000010";

interface Tag {
  id: string;
  name: string;
  color: string;
  friend_tags: { count: number }[];
}

const colorOptions = [
  "#EF4444",
  "#F59E0B",
  "#06C755",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#6B7280",
];

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(colorOptions[0]);
  const [saving, setSaving] = useState(false);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tags")
      .select("*, friend_tags(count)")
      .eq("channel_id", CHANNEL_ID)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tags:", error);
    }
    setTags((data as Tag[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const handleAddTag = async () => {
    if (!newTagName.trim() || saving) return;
    setSaving(true);

    const { error } = await supabase.from("tags").insert({
      channel_id: CHANNEL_ID,
      name: newTagName.trim(),
      color: newTagColor,
    });

    if (error) {
      console.error("Error creating tag:", error);
      alert("タグの作成に失敗しました");
    } else {
      setNewTagName("");
      setNewTagColor(colorOptions[0]);
      setShowForm(false);
      await fetchTags();
    }
    setSaving(false);
  };

  const handleDeleteTag = async (id: string) => {
    if (!confirm("このタグを削除しますか？")) return;

    const { error } = await supabase.from("tags").delete().eq("id", id);

    if (error) {
      console.error("Error deleting tag:", error);
      alert("タグの削除に失敗しました");
    } else {
      await fetchTags();
    }
  };

  const getFriendCount = (tag: Tag): number => {
    if (tag.friend_tags && tag.friend_tags.length > 0) {
      return tag.friend_tags[0].count ?? 0;
    }
    return 0;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-60 animate-pulse rounded bg-gray-200" />
          <div className="h-9 w-28 animate-pulse rounded-lg bg-gray-200" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full bg-gray-200" />
                <div>
                  <div className="h-4 w-20 rounded bg-gray-200" />
                  <div className="mt-1 h-3 w-10 rounded bg-gray-200" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">タグを使って友だちを分類できます</p>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white hover:bg-[#05b34c] transition-colors"
        >
          + 新規タグ作成
        </button>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">新しいタグを作成</h3>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-600">
                タグ名
              </label>
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="タグ名を入力"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                カラー
              </label>
              <div className="flex gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewTagColor(color)}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${
                      newTagColor === color
                        ? "border-gray-900 scale-110"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddTag}
                disabled={saving}
                className="rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white hover:bg-[#05b34c] transition-colors disabled:opacity-50"
              >
                {saving ? "作成中..." : "作成"}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setNewTagName("");
                }}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag list */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tags.map((tag) => (
          <div
            key={tag.id}
            className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              <div>
                <p className="font-medium text-gray-900">{tag.name}</p>
                <p className="text-xs text-gray-500">{getFriendCount(tag)}人</p>
              </div>
            </div>
            <button
              onClick={() => handleDeleteTag(tag.id)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              title="削除"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {tags.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center">
          <p className="text-gray-400">タグがありません。新しいタグを作成してください。</p>
        </div>
      )}
    </div>
  );
}
