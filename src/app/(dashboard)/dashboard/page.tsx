"use client";

import { useState, useEffect, useRef } from "react";
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
  friend_picture_url: string | null;
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

// Animated counter component
function AnimatedNumber({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const startTime = useRef<number | null>(null);
  const startValue = useRef(0);

  useEffect(() => {
    startValue.current = displayValue;
    startTime.current = null;

    const animate = (currentTime: number) => {
      if (!startTime.current) startTime.current = currentTime;
      const elapsed = currentTime - startTime.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out quad
      const easeProgress = 1 - (1 - progress) * (1 - progress);
      const current = Math.floor(startValue.current + (value - startValue.current) * easeProgress);

      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{displayValue.toLocaleString()}</span>;
}

// Quick action buttons
const quickActions = [
  { label: "今日のメッセージ", href: "/chat", icon: "message" },
  { label: "配信を作成", href: "/broadcasts", icon: "broadcast" },
  { label: "友だち追加", href: "/friends", icon: "add-user" },
  { label: "AIに聞く", href: "/ai", icon: "ai" },
];

function QuickActionIcon({ name }: { name: string }) {
  switch (name) {
    case "message":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
      );
    case "broadcast":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
        </svg>
      );
    case "add-user":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
        </svg>
      );
    case "ai":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      );
    default:
      return null;
  }
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
            .select("id, user_message, ai_response, created_at, friends(display_name, picture_url)")
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
          friend_picture_url: log.friends?.picture_url ?? null,
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
          label: "友だち総数",
          value: stats.totalFriends,
          trend: "+12%",
          trendUp: true,
          icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          ),
          iconBg: "bg-blue-50",
          iconColor: "text-blue-600",
        },
        {
          label: "今月の新規",
          value: stats.newFriendsThisMonth,
          trend: "+8%",
          trendUp: true,
          icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
          ),
          iconBg: "bg-[#06C755]/10",
          iconColor: "text-[#06C755]",
        },
        {
          label: "未読メッセージ",
          value: stats.unreadMessages,
          trend: stats.unreadMessages > 0 ? "要対応" : "",
          trendUp: false,
          icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          ),
          iconBg: "bg-orange-50",
          iconColor: "text-orange-600",
        },
        {
          label: "今月の配信",
          value: stats.broadcastsThisMonth,
          trend: "+3件",
          trendUp: true,
          icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
            </svg>
          ),
          iconBg: "bg-indigo-50",
          iconColor: "text-indigo-600",
        },
      ]
    : [];

  // Skeleton loading
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Stats skeleton */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-200 bg-white p-5"
            >
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 animate-pulse rounded-lg bg-gray-100" />
                <div className="h-5 w-12 animate-pulse rounded-full bg-gray-100" />
              </div>
              <div className="mt-4 h-8 w-20 animate-pulse rounded bg-gray-100" />
              <div className="mt-1 h-4 w-16 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>

        {/* Quick actions skeleton */}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 w-32 animate-pulse rounded-full bg-gray-200" />
          ))}
        </div>

        {/* AI logs skeleton */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div className="h-5 w-32 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="divide-y divide-gray-50">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-4">
                <div className="h-10 w-10 animate-pulse rounded-full bg-gray-100" />
                <div className="flex-1">
                  <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
                  <div className="mt-2 h-3 w-full animate-pulse rounded bg-gray-100" />
                  <div className="mt-1 h-3 w-3/4 animate-pulse rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* AI Auto-Reply Status Banner */}
      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#06C755] to-[#05A649]">
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">AI自動返信</h3>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  aiAutoReplyOn
                    ? "bg-[#06C755]/10 text-[#06C755]"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {aiAutoReplyOn && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#06C755] opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#06C755]"></span>
                  </span>
                )}
                {aiAutoReplyOn ? "稼働中" : "停止中"}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-gray-500">
              {aiAutoReplyOn ? "AIが自動的にメッセージに返信しています" : "自動返信は現在オフです"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/ai"
            className="inline-flex items-center gap-2 rounded-lg bg-[#06C755] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#05A649] hover:shadow"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            AIに聞く
          </Link>
          <Link
            href="/ai/settings"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
          >
            設定
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <div
            key={stat.label}
            className="group rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-gray-300 hover:shadow-sm"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start justify-between">
              <div className={`rounded-lg p-2.5 ${stat.iconBg}`}>
                <span className={stat.iconColor}>{stat.icon}</span>
              </div>
              {stat.trend && (
                <span
                  className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                    stat.trendUp
                      ? "bg-[#06C755]/10 text-[#06C755]"
                      : stat.label === "未読メッセージ"
                      ? "bg-orange-100 text-orange-600"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {stat.trendUp && (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                    </svg>
                  )}
                  {stat.trend}
                </span>
              )}
            </div>
            <p className="mt-4 text-3xl font-bold text-gray-900">
              <AnimatedNumber value={stat.value} />
            </p>
            <p className="mt-1 text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-gray-500">クイックアクション</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="flex shrink-0 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-[#06C755] hover:bg-[#06C755]/5 hover:text-[#06C755]"
            >
              <QuickActionIcon name={action.icon} />
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* AI Reply Logs - 2/3 width */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="font-semibold text-gray-900">AI返信ログ</h2>
              <Link
                href="/ai/logs"
                className="text-sm font-medium text-[#06C755] transition-colors hover:text-[#05A649]"
              >
                すべて見る
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {aiLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                    <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  </div>
                  <p className="mt-3 text-sm text-gray-500">AI返信ログはまだありません</p>
                  <Link
                    href="/ai/settings"
                    className="mt-2 text-sm font-medium text-[#06C755] hover:underline"
                  >
                    AI自動返信を設定する
                  </Link>
                </div>
              ) : (
                aiLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-gray-50/50">
                    {log.friend_picture_url ? (
                      <img
                        src={log.friend_picture_url}
                        alt={log.friend_name}
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#06C755]/10 text-sm font-bold text-[#06C755]">
                        {log.friend_name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-gray-900">{log.friend_name}</span>
                        <span className="shrink-0 text-xs text-gray-400">{timeAgo(log.created_at)}</span>
                      </div>
                      <div className="mt-1.5 space-y-1">
                        <p className="text-sm text-gray-600 line-clamp-1">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-gray-100 text-[10px] font-medium text-gray-500 mr-1.5">Q</span>
                          {log.user_message}
                        </p>
                        <p className="text-sm text-gray-500 line-clamp-1">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[#06C755]/10 text-[10px] font-medium text-[#06C755] mr-1.5">A</span>
                          {log.ai_response}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Today's Tasks Widget - 1/3 width */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="font-semibold text-gray-900">今日やること</h2>
            </div>
            <div className="p-5 space-y-4">
              {/* Unread messages */}
              <Link href="/chat" className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 transition-all hover:border-gray-200 hover:bg-gray-50">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50">
                  <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">未読メッセージ</p>
                  <p className="text-xs text-gray-500">確認が必要です</p>
                </div>
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-orange-100 px-2 text-xs font-bold text-orange-600">
                  {stats?.unreadMessages ?? 0}
                </span>
              </Link>

              {/* Pending followups - placeholder */}
              <div className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                  <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">フォローアップ</p>
                  <p className="text-xs text-gray-500">予定されている対応</p>
                </div>
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-100 px-2 text-xs font-bold text-blue-600">
                  0
                </span>
              </div>

              {/* Scheduled broadcasts - placeholder */}
              <div className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50">
                  <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">予約配信</p>
                  <p className="text-xs text-gray-500">本日の予定</p>
                </div>
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-indigo-100 px-2 text-xs font-bold text-indigo-600">
                  0
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
