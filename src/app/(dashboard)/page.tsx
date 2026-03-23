"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

const CHANNEL_ID = "00000000-0000-0000-0000-000000000010";

interface DashboardStats {
  totalFriends: number;
  newFriendsThisMonth: number;
  unreadMessages: number;
  broadcastsThisMonth: number;
}

interface Activity {
  id: string;
  action: string;
  detail: string;
  time: string;
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
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [totalRes, newRes, unreadRes, broadcastRes, messagesRes] =
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
          // Recent messages for activity feed
          supabase
            .from("chat_messages")
            .select("id, direction, content, created_at, friend_id, friends(display_name)")
            .eq("channel_id", CHANNEL_ID)
            .order("created_at", { ascending: false })
            .limit(6),
        ]);

      setStats({
        totalFriends: totalRes.count ?? 0,
        newFriendsThisMonth: newRes.count ?? 0,
        unreadMessages: unreadRes.count ?? 0,
        broadcastsThisMonth: broadcastRes.count ?? 0,
      });

      // Build recent activities from messages
      const recentActivities: Activity[] = (messagesRes.data ?? []).map(
        (msg: any) => {
          const friendName =
            msg.friends?.display_name ?? "不明なユーザー";
          const isInbound = msg.direction === "inbound";
          return {
            id: msg.id,
            action: isInbound ? "メッセージ受信" : "メッセージ送信",
            detail: isInbound
              ? `${friendName}さんからメッセージを受信しました`
              : `${friendName}さんにメッセージを送信しました`,
            time: timeAgo(msg.created_at),
          };
        }
      );

      setActivities(recentActivities);
      setLoading(false);
    }

    fetchData();
  }, []);

  const statCards = stats
    ? [
        {
          label: "友だち数",
          value: stats.totalFriends.toLocaleString(),
          icon: "👥",
        },
        {
          label: "今月の新規友だち",
          value: stats.newFriendsThisMonth.toLocaleString(),
          icon: "🆕",
        },
        {
          label: "未読メッセージ",
          value: stats.unreadMessages.toLocaleString(),
          icon: "💬",
        },
        {
          label: "今月の配信数",
          value: stats.broadcastsThisMonth.toLocaleString(),
          icon: "📢",
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
              className="animate-pulse rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="h-6 w-10 rounded bg-gray-200" />
              <div className="mt-4 h-8 w-20 rounded bg-gray-200" />
              <div className="mt-2 h-4 w-28 rounded bg-gray-200" />
            </div>
          ))}
        </div>
        <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="h-6 w-40 rounded bg-gray-200" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="mt-4 h-12 rounded bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl">{stat.icon}</span>
            </div>
            <p className="mt-4 text-3xl font-bold text-gray-900">
              {stat.value}
            </p>
            <p className="mt-1 text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">最近のアクティビティ</h2>
        </div>
        <ul className="divide-y divide-gray-100">
          {activities.length === 0 && (
            <li className="px-6 py-12 text-center text-gray-400">
              まだアクティビティはありません
            </li>
          )}
          {activities.map((activity) => (
            <li key={activity.id} className="flex items-start gap-4 px-6 py-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#06C755]/10">
                <div className="h-2 w-2 rounded-full bg-[#06C755]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {activity.action}
                </p>
                <p className="text-sm text-gray-500">{activity.detail}</p>
              </div>
              <span className="shrink-0 text-xs text-gray-400">
                {activity.time}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
