"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

const CHANNEL_ID = "00000000-0000-0000-0000-000000000010";

type FriendStatus = "active" | "blocked" | "unfollowed";
type ViewMode = "table" | "grid";

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
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const perPage = 10;

  const importCSV = async (file: File) => {
    setImporting(true);
    setSyncResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/friends/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(
          `インポート完了: ${data.imported}人の友だち、${data.tags_created}個のタグを作成、${data.tag_links}個のタグ紐付け`
        );
        fetchFriends();
      } else {
        setSyncResult(`エラー: ${data.error ?? "インポートに失敗しました"}`);
      }
    } catch {
      setSyncResult("エラー: インポートに失敗しました");
    } finally {
      setImporting(false);
    }
  };

  const syncFriends = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/friends/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(
          `同期完了: ${data.total_followers}人中 ${data.imported}人をインポート`
        );
        fetchFriends();
      } else {
        setSyncResult(`エラー: ${data.error ?? "同期に失敗しました"}`);
      }
    } catch {
      setSyncResult("エラー: 同期に失敗しました");
    } finally {
      setSyncing(false);
    }
  };

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

  const toggleSelectFriend = (id: string) => {
    setSelectedFriends((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedFriends.size === friends.length) {
      setSelectedFriends(new Set());
    } else {
      setSelectedFriends(new Set(friends.map((f) => f.id)));
    }
  };

  const clearSelection = () => {
    setSelectedFriends(new Set());
  };

  // Skeleton loading
  if (loading) {
    return (
      <div className="space-y-4">
        {/* Header skeleton */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-10 w-72 animate-pulse rounded-lg bg-gray-200" />
          <div className="flex gap-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 w-24 animate-pulse rounded-lg bg-gray-200" />
            ))}
          </div>
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
            {[...Array(perPage)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <div className="h-5 w-5 animate-pulse rounded bg-gray-200" />
                <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
                <div className="flex-1">
                  <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                </div>
                <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200" />
                <div className="h-5 w-20 animate-pulse rounded-full bg-gray-200" />
                <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters & Search */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
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
              className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-[#06C755] focus:outline-none focus:ring-2 focus:ring-[#06C755]/20"
            />
          </div>

          {/* Status filter pills */}
          <div className="flex gap-1.5">
            {statusFilters.map((sf) => (
              <button
                key={sf.value}
                onClick={() => {
                  setStatusFilter(sf.value);
                  setCurrentPage(1);
                }}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  statusFilter === sf.value
                    ? "bg-[#06C755] text-white shadow-sm"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {sf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sync button, View toggle & count */}
        <div className="flex items-center gap-3">
          {/* CSV Import */}
          <label
            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 ${importing ? "opacity-50 pointer-events-none" : ""}`}
          >
            {importing ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                インポート中...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                CSVインポート
              </>
            )}
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  importCSV(file);
                  e.target.value = "";
                }
              }}
            />
          </label>

          <button
            onClick={syncFriends}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#05A649] disabled:opacity-50"
          >
            {syncing ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                同期中...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                LINE同期
              </>
            )}
          </button>
          <span className="text-sm text-gray-500">{totalCount}人の友だち</span>
          <div className="flex rounded-lg border border-gray-200 bg-white p-1">
            <button
              onClick={() => setViewMode("table")}
              className={`rounded-md p-2 transition-colors ${
                viewMode === "table" ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
              title="テーブル表示"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`rounded-md p-2 transition-colors ${
                viewMode === "grid" ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
              title="グリッド表示"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Sync result message */}
      {syncResult && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            syncResult.startsWith("エラー")
              ? "border border-red-200 bg-red-50 text-red-700"
              : "border border-[#06C755]/20 bg-[#06C755]/5 text-[#06C755]"
          }`}
        >
          {syncResult}
          <button
            onClick={() => setSyncResult(null)}
            className="ml-3 text-xs opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedFriends.size > 0 && (
        <div className="flex items-center gap-4 rounded-xl border border-[#06C755]/20 bg-[#06C755]/5 px-4 py-3">
          <span className="text-sm font-medium text-[#06C755]">
            {selectedFriends.size}人選択中
          </span>
          <div className="flex gap-2">
            <button className="rounded-lg bg-[#06C755] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#05A649]">
              タグ付与
            </button>
            <button className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50">
              メッセージ送信
            </button>
          </div>
          <button
            onClick={clearSelection}
            className="ml-auto text-sm text-gray-500 hover:text-gray-700"
          >
            選択解除
          </button>
        </div>
      )}

      {/* Table View */}
      {viewMode === "table" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/50">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedFriends.size === friends.length && friends.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-[#06C755] focus:ring-[#06C755]/20"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600">友だち</th>
                  <th className="px-4 py-3 font-medium text-gray-600">ステータス</th>
                  <th className="px-4 py-3 font-medium text-gray-600">タグ</th>
                  <th className="px-4 py-3 font-medium text-gray-600">友だち追加日</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {friends.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                          <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                          </svg>
                        </div>
                        <p className="mt-3 text-sm font-medium text-gray-900">該当する友だちが見つかりません</p>
                        <p className="mt-1 text-xs text-gray-500">検索条件を変更してください</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  friends.map((friend) => (
                    <tr 
                      key={friend.id} 
                      className={`transition-colors hover:bg-gray-50/50 ${selectedFriends.has(friend.id) ? "bg-[#06C755]/5" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedFriends.has(friend.id)}
                          onChange={() => toggleSelectFriend(friend.id)}
                          className="h-4 w-4 rounded border-gray-300 text-[#06C755] focus:ring-[#06C755]/20"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {friend.picture_url ? (
                            <img
                              src={friend.picture_url}
                              alt={friend.display_name}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#06C755]/10 text-sm font-bold text-[#06C755]">
                              {friend.display_name?.charAt(0) ?? "?"}
                            </div>
                          )}
                          <span className="font-medium text-gray-900">{friend.display_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                            friend.status === "active"
                              ? "bg-[#06C755]/10 text-[#06C755]"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${friend.status === "active" ? "bg-[#06C755]" : "bg-red-500"}`} />
                          {friend.status === "active" ? "アクティブ" : "ブロック"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3 text-gray-500">
                        {friend.followed_at
                          ? new Date(friend.followed_at).toLocaleDateString("ja-JP")
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {friends.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-16">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              </div>
              <p className="mt-3 text-sm font-medium text-gray-900">該当する友だちが見つかりません</p>
              <p className="mt-1 text-xs text-gray-500">検索条件を変更してください</p>
            </div>
          ) : (
            friends.map((friend) => (
              <div
                key={friend.id}
                className={`relative rounded-xl border bg-white p-4 transition-all hover:shadow-sm ${
                  selectedFriends.has(friend.id) ? "border-[#06C755] bg-[#06C755]/5" : "border-gray-200"
                }`}
              >
                {/* Checkbox */}
                <div className="absolute right-3 top-3">
                  <input
                    type="checkbox"
                    checked={selectedFriends.has(friend.id)}
                    onChange={() => toggleSelectFriend(friend.id)}
                    className="h-4 w-4 rounded border-gray-300 text-[#06C755] focus:ring-[#06C755]/20"
                  />
                </div>

                {/* Avatar */}
                <div className="flex flex-col items-center">
                  {friend.picture_url ? (
                    <img
                      src={friend.picture_url}
                      alt={friend.display_name}
                      className="h-16 w-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#06C755]/10 text-xl font-bold text-[#06C755]">
                      {friend.display_name?.charAt(0) ?? "?"}
                    </div>
                  )}
                  <h3 className="mt-3 text-center font-medium text-gray-900">{friend.display_name}</h3>
                  
                  {/* Status */}
                  <span
                    className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                      friend.status === "active"
                        ? "bg-[#06C755]/10 text-[#06C755]"
                        : "bg-red-50 text-red-600"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${friend.status === "active" ? "bg-[#06C755]" : "bg-red-500"}`} />
                    {friend.status === "active" ? "アクティブ" : "ブロック"}
                  </span>

                  {/* Tags */}
                  {friend.friend_tags && friend.friend_tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap justify-center gap-1">
                      {friend.friend_tags.map((ft) => (
                        <span
                          key={ft.tag_id}
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                          style={{ backgroundColor: ft.tags?.color ?? "#6B7280" }}
                        >
                          {ft.tags?.name ?? ""}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Follow date */}
                  <p className="mt-3 text-xs text-gray-400">
                    {friend.followed_at
                      ? new Date(friend.followed_at).toLocaleDateString("ja-JP") + " 追加"
                      : "-"}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-gray-500">
            {totalCount}件中{" "}
            {totalCount > 0 ? (currentPage - 1) * perPage + 1 : 0}〜
            {Math.min(currentPage * perPage, totalCount)}件を表示
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              前へ
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pageNum = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
              if (pageNum > totalPages) return null;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    pageNum === currentPage
                      ? "bg-[#06C755] text-white"
                      : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              次へ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
