"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

const CHANNEL_ID = "00000000-0000-0000-0000-000000000010";

interface DashboardStats {
  totalFriends: number;
  newFriendsThisMonth: number;
  unreadMessages: number;
  broadcastsThisMonth: number;
}

interface AILogEntry {
  id: string;
  friend_name: string;
  user_message: string;
  ai_response: string;
  created_at: string;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}日前`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [aiLogs, setAiLogs] = useState<AILogEntry[]>([]);
  const [aiAutoReplyOn, setAiAutoReplyOn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      const now = new Date();
      const startOfMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      ).toISOString();

      const [totalRes, newRes, unreadRes, broadcastRes, settingsRes, logsRes] =
        await Promise.all([
          supabase
            .from("friends")
            .select("*", { count: "exact", head: true })
            .eq("channel_id", CHANNEL_ID),
          supabase
            .from("friends")
            .select("*", { count: "exact", head: true })
            .eq("channel_id", CHANNEL_ID)
            .gte("followed_at", startOfMonth),
          supabase
            .from("chat_messages")
            .select("*", { count: "exact", head: true })
            .eq("channel_id", CHANNEL_ID)
            .eq("direction", "inbound")
            .is("read_at", null),
          supabase
            .from("broadcasts")
            .select("*", { count: "exact", head: true })
            .eq("channel_id", CHANNEL_ID)
            .eq("status", "sent")
            .gte("sent_at", startOfMonth),
          supabase
            .from("ai_auto_reply_settings")
            .select("is_enabled")
            .eq("channel_id", CHANNEL_ID)
            .single(),
          supabase
            .from("ai_reply_logs")
            .select("id, user_message, ai_response, created_at, friends(display_name)")
            .eq("channel_id", CHANNEL_ID)
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

      setStats({
        totalFriends: totalRes.count ?? 0,
        newFriendsThisMonth: newRes.count ?? 0,
        unreadMessages: unreadRes.count ?? 0,
        broadcastsThisMonth: broadcastRes.count ?? 0,
      });

      setAiAutoReplyOn(settingsRes.data?.is_enabled ?? false);

      setAiLogs(
        (logsRes.data ?? []).map((log: any) => ({
          id: log.id,
          friend_name: log.friends?.display_name ?? "不明",
          user_message: log.user_message ?? "",
          ai_response: log.ai_response ?? "",
          created_at: log.created_at,
        }))
      );

      setLoading(false);
    }

    fetchData();
  }, []);

  const statCards = stats
    ? [
        {
          label: "友だち数",
          value: stats.totalFriends.toLocaleString(),
          icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          ),
          color: "text-blue-600 bg-blue-50",
        },
        {
          label: "今月の新規",
          value: stats.newFriendsThisMonth.toLocaleString(),
          icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
          ),
          color: "text-green-600 bg-green-50",
        },
        {
          label: "未読メッセージ",
          value: stats.unreadMessages.toLocaleString(),
          icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          ),
          color: "text-orange-600 bg-orange-50",
        },
        {
          label: "今月の配信",
          value: stats.broadcastsThisMonth.toLocaleString(),
          icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
            </svg>
          ),
          color: "text-purple-600 bg-purple-50",
        },
      ]
    : [];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="h-5 w-10 rounded bg-gray-200" />
              <div className="mt-3 h-7 w-16 rounded bg-gray-200" />
              <div className="mt-2 h-4 w-24 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* AI CTA + Auto Reply Status */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/ai"
          className="inline-flex items-center gap-2 rounded-xl bg-[#06C755] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#05a649] hover:shadow-md"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          AIアシスタントに聞く
        </Link>
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm">
          <span className="text-gray-500">AI自動返信</span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              aiAutoReplyOn
                ? "bg-green-50 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                aiAutoReplyOn ? "bg-green-500" : "bg-gray-400"
              }`}
            />
            {aiAutoReplyOn ? "ON" : "OFF"}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className={`inline-flex rounded-lg p-2 ${stat.color}`}>
              {stat.icon}
            </div>
            <p className="mt-3 text-2xl font-bold text-gray-900">
              {stat.value}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent AI Reply Logs */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-gray-900">
            AI返信ログ（最新）
          </h2>
          <Link
            href="/ai/logs"
            className="text-xs text-[#06C755] hover:underline"
          >
            すべて見る
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {aiLogs.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-gray-400">
              AI返信ログはまだありません
            </div>
          )}
          {aiLogs.map((log) => (
            <div key={log.id} className="px-5 py-3.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700">
                  {log.friend_name}
                </span>
                <span className="text-[10px] text-gray-400">
                  {timeAgo(log.created_at)}
                </span>
              </div>
              <p className="text-xs text-gray-500 truncate">
                Q: {log.user_message}
              </p>
              <p className="text-xs text-gray-400 truncate mt-0.5">
                A: {log.ai_response}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
