"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navGroups = [
  {
    label: "友だち管理",
    items: [
      { href: "/friends", label: "友だち一覧", icon: "👥" },
      { href: "/tags", label: "タグ管理", icon: "🏷️" },
    ],
  },
  {
    label: "メッセージ",
    items: [
      { href: "/chat", label: "1:1チャット", icon: "💬" },
      { href: "/broadcasts", label: "配信", icon: "📢" },
      { href: "/templates", label: "テンプレート", icon: "📝" },
    ],
  },
  {
    label: "自動化",
    items: [
      { href: "/auto-reply", label: "自動応答", icon: "🤖" },
      { href: "/step-delivery", label: "ステップ配信", icon: "📨" },
      { href: "/reminders", label: "リマインダー", icon: "⏰" },
    ],
  },
  {
    label: "コンテンツ",
    items: [
      { href: "/rich-menu", label: "リッチメニュー", icon: "📱" },
      { href: "/forms", label: "フォーム", icon: "📋" },
      { href: "/reservations", label: "予約管理", icon: "📅" },
    ],
  },
  {
    label: "分析",
    items: [
      { href: "/", label: "ダッシュボード", icon: "📊" },
      { href: "/analytics/urls", label: "URL計測", icon: "🔗" },
      { href: "/analytics/conversions", label: "コンバージョン", icon: "🎯" },
      { href: "/analytics/sources", label: "流入経路", icon: "🔍" },
    ],
  },
  {
    label: "AI",
    items: [{ href: "/ai", label: "AIアシスタント", icon: "✨" }],
  },
  {
    label: "設定",
    items: [{ href: "/settings/channel", label: "チャネル設定", icon: "⚙️" }],
  },
];

function pageTitleFromPathname(pathname: string): string {
  for (const group of navGroups) {
    for (const item of group.items) {
      if (item.href === pathname) return item.label;
    }
  }
  return "ダッシュボード";
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pageTitle = pageTitleFromPathname(pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-gray-900 text-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-gray-800 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#06C755]">
            <svg
              viewBox="0 0 24 24"
              fill="white"
              className="h-5 w-5"
            >
              <path d="M12 2C6.48 2 2 5.58 2 10c0 2.24 1.12 4.27 2.94 5.76-.17.62-.94 3.31-.97 3.54 0 0-.02.17.09.24.11.06.24.01.24.01.33-.05 3.82-2.5 4.36-2.87.43.06.87.1 1.34.1 5.52 0 10-3.58 10-8 0-4.42-4.48-8-10-8z" />
            </svg>
          </div>
          <span className="text-lg font-bold">LINE CRM</span>
          {/* Mobile close button */}
          <button
            className="ml-auto lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-4">
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                {group.label}
              </p>
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-[#06C755] text-white font-medium"
                        : "text-gray-300 hover:bg-gray-800 hover:text-white"
                    }`}
                  >
                    <span className="text-base">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header bar */}
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-6">
          {/* Mobile hamburger */}
          <button
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900">{pageTitle}</h1>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
