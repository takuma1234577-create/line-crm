"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

const CHANNEL_ID = "00000000-0000-0000-0000-000000000010";

type BroadcastStatus = "draft" | "scheduled" | "sent" | "sending";

interface Broadcast {
  id: string;
  messages: { type: string; text?: string }[];
  status: BroadcastStatus;
  segment_id: string | null;
  sent_at: string | null;
  scheduled_at: string | null;
  total_recipients: number;
  success_count: number;
  created_at: string;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface BroadcastStats {
  total: number;
  thisMonth: number;
  avgOpenRate: number;
  totalReach: number;
}

const statusConfig: Record<BroadcastStatus, { label: string; className: string; dotColor: string }> = {
  draft: { label: "下書き", className: "bg-gray-100 text-gray-700", dotColor: "bg-gray-400" },
  scheduled: { label: "予約済み", className: "bg-blue-50 text-blue-700", dotColor: "bg-blue-500" },
  sending: { label: "送信中", className: "bg-yellow-50 text-yellow-700", dotColor: "bg-yellow-500" },
  sent: { label: "送信済み", className: "bg-[#06C755]/10 text-[#06C755]", dotColor: "bg-[#06C755]" },
};

export default function BroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [stats, setStats] = useState<BroadcastStats>({ total: 0, thisMonth: 0, avgOpenRate: 0, totalReach: 0 });

  const fetchBroadcasts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("broadcasts")
      .select("*")
      .eq("channel_id", CHANNEL_ID)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching broadcasts:", error);
    }
    const broadcastsData = (data as Broadcast[]) ?? [];
    setBroadcasts(broadcastsData);

    // Calculate stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const thisMonthBroadcasts = broadcastsData.filter(
      (b) => b.status === "sent" && b.sent_at && b.sent_at >= startOfMonth
    );
    const totalReach = broadcastsData.reduce((sum, b) => sum + (b.success_count || 0), 0);

    setStats({
      total: broadcastsData.length,
      thisMonth: thisMonthBroadcasts.length,
      avgOpenRate: 0, // Would need additional data
      totalReach,
    });

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
        setShowDrawer(false);
        await fetchBroadcasts();
      }
    } catch (err) {
      console.error("Broadcast error:", err);
      alert("配信に失敗しました");
    }

    setSending(false);
  };

  // Skeleton loading
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

        {/* Table skeleton */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 bg-gray-50 px-6 py-3">
            <div className="flex gap-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 w-20 animate-pulse rounded bg-gray-200" />
              ))}
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <div className="h-4 w-48 animate-pulse rounded bg-gray-200" />
                <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200" />
                <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-indigo-50 p-2">
              <svg className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-500">総配信数</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-[#06C755]/10 p-2">
              <svg className="h-4 w-4 text-[#06C755]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-500">今月の配信</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900">{stats.thisMonth}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-blue-50 p-2">
              <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-500">平均開封率</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900">--%</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-orange-50 p-2">
              <svg className="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-500">総リーチ</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900">{stats.totalReach.toLocaleString()}</p>
        </div>
      </div>

      {/* Header with action */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">メッセージの一斉配信を管理します</p>
        <button
          onClick={() => setShowDrawer(true)}
          className="flex items-center gap-2 rounded-lg bg-[#06C755] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#05A649] hover:shadow"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          新規配信
        </button>
      </div>

      {/* Broadcasts Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/50">
              <tr>
                <th className="px-6 py-3 font-medium text-gray-600">メッセージ</th>
                <th className="px-6 py-3 font-medium text-gray-600">ステータス</th>
                <th className="px-6 py-3 font-medium text-gray-600">配信先</th>
                <th className="px-6 py-3 font-medium text-gray-600">送信日時</th>
                <th className="px-6 py-3 font-medium text-gray-600">送信数</th>
                <th className="px-6 py-3 font-medium text-gray-600">成功率</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {broadcasts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                        <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09" />
                        </svg>
                      </div>
                      <p className="mt-3 text-sm font-medium text-gray-900">まだ配信がありません</p>
                      <p className="mt-1 text-xs text-gray-500">新規配信を作成してください</p>
                      <button
                        onClick={() => setShowDrawer(true)}
                        className="mt-4 text-sm font-medium text-[#06C755] hover:underline"
                      >
                        最初の配信を作成
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                broadcasts.map((broadcast) => {
                  const statusInfo = statusConfig[broadcast.status] ?? statusConfig.draft;
                  const successRate = broadcast.total_recipients > 0
                    ? Math.round((broadcast.success_count / broadcast.total_recipients) * 100)
                    : 0;
                  
                  return (
                    <tr
                      key={broadcast.id}
                      className="cursor-pointer transition-colors hover:bg-gray-50/50"
                    >
                      <td className="px-6 py-4">
                        <p className="max-w-xs truncate font-medium text-gray-900">
                          {broadcast.messages?.[0]?.text ?? "(メッセージ)"}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusInfo.className}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dotColor}`} />
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {broadcast.segment_id
                          ? "セグメント指定"
                          : "全ての友だち"}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {broadcast.sent_at
                          ? new Date(broadcast.sent_at).toLocaleString("ja-JP", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : broadcast.scheduled_at
                          ? new Date(broadcast.scheduled_at).toLocaleString("ja-JP", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </td>
                      <td className="px-6 py-4">
                        {broadcast.success_count > 0 ? (
                          <span className="font-medium text-gray-900">
                            {broadcast.success_count.toLocaleString()}
                            <span className="text-gray-400">/{broadcast.total_recipients.toLocaleString()}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {broadcast.total_recipients > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className="h-full rounded-full bg-[#06C755] transition-all"
                                style={{ width: `${successRate}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">{successRate}%</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-in Drawer */}
      {showDrawer && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowDrawer(false)}
          />

          {/* Drawer */}
          <div className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-md animate-slide-in-right bg-white shadow-2xl">
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-gray-900">新規配信</h2>
                <button
                  onClick={() => setShowDrawer(false)}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  {/* Message input */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      メッセージ
                    </label>
                    <div className="relative">
                      <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="配信メッセージを入力..."
                        rows={6}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-[#06C755] focus:outline-none focus:ring-2 focus:ring-[#06C755]/20"
                      />
                      <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                        {newMessage.length}/500
                      </div>
                    </div>
                  </div>

                  {/* Tag selector */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      配信先
                    </label>
                    <select
                      value={selectedTagId}
                      onChange={(e) => setSelectedTagId(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-[#06C755] focus:outline-none focus:ring-2 focus:ring-[#06C755]/20"
                    >
                      <option value="">全ての友だち</option>
                      {tags.map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-gray-500">
                      タグを選択すると、そのタグが付いた友だちにのみ配信されます
                    </p>
                  </div>

                  {/* Schedule (placeholder) */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      配信タイミング
                    </label>
                    <div className="flex gap-2">
                      <button className="flex-1 rounded-xl border-2 border-[#06C755] bg-[#06C755]/5 px-4 py-3 text-sm font-medium text-[#06C755]">
                        今すぐ配信
                      </button>
                      <button className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50">
                        予約配信
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 p-6">
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDrawer(false);
                      setNewMessage("");
                      setSelectedTagId("");
                    }}
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSendBroadcast}
                    disabled={sending || !newMessage.trim()}
                    className="flex-1 rounded-xl bg-[#06C755] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#05A649] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sending ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        送信中...
                      </span>
                    ) : (
                      "配信する"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
