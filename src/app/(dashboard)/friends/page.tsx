"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

const CHANNEL_ID = "00000000-0000-0000-0000-000000000010";

type FriendStatus = "active" | "blocked" | "unfollowed";

interface FriendTag {
  tag_id: string;
  tags: {
    name: string;
    color: string;
  };
}

interface Friend {
  id: string;
  display_name: string;
  picture_url: string | null;
  status: FriendStatus;
  followed_at: string;
  friend_tags: FriendTag[];
}

const statusFilters = [
  { value: "all", label: "全て" },
  { value: "active", label: "アクティブ" },
  { value: "blocked", label: "ブロック" },
] as const;

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | FriendStatus>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const perPage = 5;

  const fetchFriends = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("friends")
      .select("*, friend_tags(tag_id, tags(name, color))", { count: "exact" })
      .eq("channel_id", CHANNEL_ID);

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    if (search) {
      query = query.ilike("display_name", `%${search}%`);
    }

    const from = (currentPage - 1) * perPage;
    const to = from + perPage - 1;

    const { data, count, error } = await query
      .order("followed_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Error fetching friends:", error);
    }

    setFriends((data as Friend[]) ?? []);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [search, statusFilter, currentPage]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="友だちを検索..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755] sm:w-72"
          />
        </div>
        <div className="flex gap-2">
          {statusFilters.map((sf) => (
            <button
              key={sf.value}
              onClick={() => {
                setStatusFilter(sf.value);
                setCurrentPage(1);
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                statusFilter === sf.value
                  ? "bg-[#06C755] text-white"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              {sf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-3 font-semibold text-gray-600">アイコン</th>
              <th className="px-6 py-3 font-semibold text-gray-600">表示名</th>
              <th className="px-6 py-3 font-semibold text-gray-600">ステータス</th>
              <th className="px-6 py-3 font-semibold text-gray-600">タグ</th>
              <th className="px-6 py-3 font-semibold text-gray-600">友だち追加日</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              [...Array(perPage)].map((_, i) => (
                <tr key={i}>
                  <td className="px-6 py-4">
                    <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-5 w-20 animate-pulse rounded-full bg-gray-200" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                  </td>
                </tr>
              ))
            ) : (
              <>
                {friends.map((friend) => (
                  <tr key={friend.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      {friend.picture_url ? (
                        <img
                          src={friend.picture_url}
                          alt={friend.display_name}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#06C755]/10 text-[#06C755] font-bold">
                          {friend.display_name?.charAt(0) ?? "?"}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {friend.display_name}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          friend.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {friend.status === "active" ? "アクティブ" : "ブロック"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {friend.friend_tags?.map((ft) => (
                          <span
                            key={ft.tag_id}
                            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                            style={{ backgroundColor: ft.tags?.color ?? "#6B7280" }}
                          >
                            {ft.tags?.name ?? ""}
                          </span>
                        ))}
                        {(!friend.friend_tags || friend.friend_tags.length === 0) && (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {friend.followed_at
                        ? new Date(friend.followed_at).toLocaleDateString("ja-JP")
                        : "-"}
                    </td>
                  </tr>
                ))}
                {friends.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                      該当する友だちが見つかりません
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {totalCount}件中{" "}
            {totalCount > 0 ? (currentPage - 1) * perPage + 1 : 0}〜
            {Math.min(currentPage * perPage, totalCount)}件を表示
          </p>
          <div className="flex gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              前へ
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  page === currentPage
                    ? "bg-[#06C755] text-white"
                    : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              次へ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
