"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

const CHANNEL_ID = "00000000-0000-0000-0000-000000000010";
const PAGE_SIZE = 20;

interface LogEntry {
  id: string;
  channel_id: string;
  friend_id: string;
  user_message: string;
  ai_reply: string;
  tokens_used: number;
  response_time_ms: number;
  was_escalated: boolean;
  created_at: string;
  friends: { display_name: string } | null;
}

export default function AILogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("ai_reply_logs")
      .select("*, friends(display_name)", { count: "exact" })
      .eq("channel_id", CHANNEL_ID)
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (dateFrom) {
      query = query.gte("created_at", dateFrom + "T00:00:00");
    }
    if (dateTo) {
      query = query.lte("created_at", dateTo + "T23:59:59");
    }

    const { data, count } = await query;

    setLogs((data ?? []) as LogEntry[]);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [page, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  function handleFilter() {
    setPage(0);
    fetchLogs();
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function truncate(text: string, maxLen: number) {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + "...";
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI返信ログ</h1>
        <p className="mt-1 text-sm text-gray-500">
          AIによる自動返信の履歴を確認できます
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            開始日
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            終了日
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
          />
        </div>
        <button
          onClick={handleFilter}
          className="rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white hover:bg-[#05b34c] transition-colors"
        >
          絞り込み
        </button>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => {
              setDateFrom("");
              setDateTo("");
              setPage(0);
            }}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            リセット
          </button>
        )}
        <div className="ml-auto text-sm text-gray-500">
          全{totalCount}件
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#06C755] border-t-transparent" />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            ログがありません
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    日時
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    友だち名
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    ユーザーメッセージ
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    AI返信
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">
                    応答時間
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">
                    トークン数
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">
                    エスカレーション
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <>
                    <tr
                      key={log.id}
                      onClick={() =>
                        setExpandedId(
                          expandedId === log.id ? null : log.id
                        )
                      }
                      className="cursor-pointer border-b border-gray-50 hover:bg-gray-50 transition-colors"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {log.friends?.display_name ?? "不明"}
                      </td>
                      <td className="max-w-[200px] px-4 py-3 text-gray-600">
                        {truncate(log.user_message, 40)}
                      </td>
                      <td className="max-w-[200px] px-4 py-3 text-gray-600">
                        {truncate(log.ai_reply, 40)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-gray-500">
                        {(log.response_time_ms / 1000).toFixed(1)}秒
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-gray-500">
                        {log.tokens_used.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {log.was_escalated ? (
                          <span className="inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                            エスカレーション
                          </span>
                        ) : (
                          <span className="inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                            自動返信
                          </span>
                        )}
                      </td>
                    </tr>
                    {expandedId === log.id && (
                      <tr key={`${log.id}-expanded`} className="bg-gray-50">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                              <p className="mb-1 text-xs font-medium text-gray-500">
                                ユーザーメッセージ（全文）
                              </p>
                              <div className="rounded-lg bg-white p-3 text-sm text-gray-800 whitespace-pre-wrap border border-gray-200">
                                {log.user_message}
                              </div>
                            </div>
                            <div>
                              <p className="mb-1 text-xs font-medium text-gray-500">
                                AI返信（全文）
                              </p>
                              <div className="rounded-lg bg-white p-3 text-sm text-gray-800 whitespace-pre-wrap border border-gray-200">
                                {log.ai_reply}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            前へ
          </button>
          <span className="px-4 text-sm text-gray-500">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            次へ
          </button>
        </div>
      )}
    </div>
  );
}
