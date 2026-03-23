"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

const CHANNEL_ID = "00000000-0000-0000-0000-000000000010";

type BroadcastStatus = "draft" | "scheduled" | "sent" | "sending";

interface Broadcast {
  id: string;
  message: string;
  status: BroadcastStatus;
  target_tag_id: string | null;
  sent_at: string | null;
  sent_count: number | null;
  created_at: string;
  tags?: { name: string } | null;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

const statusLabels: Record<BroadcastStatus, { label: string; className: string }> = {
  draft: { label: "下書き", className: "bg-gray-100 text-gray-700" },
  scheduled: { label: "予約済み", className: "bg-blue-100 text-blue-700" },
  sending: { label: "送信中", className: "bg-yellow-100 text-yellow-700" },
  sent: { label: "送信済み", className: "bg-green-100 text-green-700" },
};

export default function BroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<string>("");
  const [sending, setSending] = useState(false);

  const fetchBroadcasts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("broadcasts")
      .select("*, tags(name)")
      .eq("channel_id", CHANNEL_ID)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching broadcasts:", error);
    }
    setBroadcasts((data as Broadcast[]) ?? []);
    setLoading(false);
  }, []);

  const fetchTags = useCallback(async () => {
    const { data } = await supabase
      .from("tags")
      .select("id, name, color")
      .eq("channel_id", CHANNEL_ID)
      .order("name");
    setTags((data as Tag[]) ?? []);
  }, []);

  useEffect(() => {
    fetchBroadcasts();
    fetchTags();
  }, [fetchBroadcasts, fetchTags]);

  const handleSendBroadcast = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);

    try {
      const res = await fetch("/api/broadcasts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: newMessage.trim(),
          tagId: selectedTagId || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error("Broadcast error:", err);
        alert("配信に失敗しました: " + (err.error ?? "不明なエラー"));
      } else {
        setNewMessage("");
        setSelectedTagId("");
        setShowModal(false);
        await fetchBroadcasts();
      }
    } catch (err) {
      console.error("Broadcast error:", err);
      alert("配信に失敗しました");
    }

    setSending(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">メッセージの一斉配信を管理します</p>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white hover:bg-[#05b34c] transition-colors"
        >
          + 新規配信
        </button>
      </div>

      {/* New Broadcast Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              新規配信
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  メッセージ
                </label>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="配信メッセージを入力..."
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  配信先 (タグフィルター)
                </label>
                <select
                  value={selectedTagId}
                  onChange={(e) => setSelectedTagId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
                >
                  <option value="">全ての友だち</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setNewMessage("");
                    setSelectedTagId("");
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSendBroadcast}
                  disabled={sending || !newMessage.trim()}
                  className="rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white hover:bg-[#05b34c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? "送信中..." : "配信する"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-3 font-semibold text-gray-600">メッセージ</th>
              <th className="px-6 py-3 font-semibold text-gray-600">ステータス</th>
              <th className="px-6 py-3 font-semibold text-gray-600">配信先</th>
              <th className="px-6 py-3 font-semibold text-gray-600">送信日時</th>
              <th className="px-6 py-3 font-semibold text-gray-600">送信数</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i}>
                  <td className="px-6 py-4">
                    <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 w-12 animate-pulse rounded bg-gray-200" />
                  </td>
                </tr>
              ))
            ) : (
              <>
                {broadcasts.map((broadcast) => {
                  const statusInfo =
                    statusLabels[broadcast.status] ?? statusLabels.draft;
                  return (
                    <tr
                      key={broadcast.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 font-medium text-gray-900 max-w-xs truncate">
                        {broadcast.message}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.className}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {broadcast.tags?.name
                          ? `${broadcast.tags.name}タグ`
                          : "全ての友だち"}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {broadcast.sent_at
                          ? new Date(broadcast.sent_at).toLocaleString("ja-JP")
                          : "-"}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {broadcast.sent_count !== null
                          ? `${broadcast.sent_count}通`
                          : "-"}
                      </td>
                    </tr>
                  );
                })}
                {broadcasts.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-gray-400"
                    >
                      まだ配信がありません
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
