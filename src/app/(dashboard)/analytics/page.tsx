"use client";

import { useState } from "react";

const stats = [
  {
    label: "友だち総数",
    value: "1,284",
    change: "+12%",
    changeType: "positive" as const,
    icon: "👥",
  },
  {
    label: "今月の新規友だち",
    value: "156",
    change: "+8%",
    changeType: "positive" as const,
    icon: "🆕",
  },
  {
    label: "メッセージ送信数",
    value: "4,823",
    change: "+15%",
    changeType: "positive" as const,
    icon: "📨",
  },
  {
    label: "ブロック数",
    value: "32",
    change: "+3",
    changeType: "negative" as const,
    icon: "🚫",
  },
  {
    label: "配信開封率",
    value: "68.4%",
    change: "+2.1%",
    changeType: "positive" as const,
    icon: "📬",
  },
  {
    label: "リンククリック率",
    value: "12.3%",
    change: "-0.5%",
    changeType: "negative" as const,
    icon: "🔗",
  },
];

const dateRanges = [
  { value: "7", label: "7日" },
  { value: "30", label: "30日" },
  { value: "90", label: "90日" },
];

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState("30");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          アカウントの主要指標を確認できます
        </p>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
        >
          {dateRanges.map((range) => (
            <option key={range.value} value={range.value}>
              過去{range.label}
            </option>
          ))}
        </select>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl">{stat.icon}</span>
              <span
                className={`text-sm font-medium ${
                  stat.changeType === "positive"
                    ? "text-green-600"
                    : stat.changeType === "negative"
                    ? "text-red-600"
                    : "text-gray-600"
                }`}
              >
                {stat.change}
              </span>
            </div>
            <p className="mt-4 text-3xl font-bold text-gray-900">
              {stat.value}
            </p>
            <p className="mt-1 text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Chart Areas */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">
              友だち推移
            </h2>
          </div>
          <div className="flex h-64 items-center justify-center p-6">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <svg
                  className="h-6 w-6 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                  />
                </svg>
              </div>
              <p className="text-sm text-gray-500">チャートエリア</p>
              <p className="text-xs text-gray-400 mt-1">
                友だち数の推移グラフが表示されます
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">
              メッセージ数推移
            </h2>
          </div>
          <div className="flex h-64 items-center justify-center p-6">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <svg
                  className="h-6 w-6 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <p className="text-sm text-gray-500">チャートエリア</p>
              <p className="text-xs text-gray-400 mt-1">
                メッセージ送受信数のグラフが表示されます
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Engagement chart */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            エンゲージメント推移
          </h2>
        </div>
        <div className="flex h-64 items-center justify-center p-6">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <svg
                className="h-6 w-6 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-500">チャートエリア</p>
            <p className="text-xs text-gray-400 mt-1">
              開封率・クリック率の推移グラフが表示されます
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
