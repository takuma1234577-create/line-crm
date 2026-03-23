"use client";

interface RichMenu {
  id: string;
  name: string;
  isDefault: boolean;
  areas: number;
  createdAt: string;
}

const placeholderMenus: RichMenu[] = [
  {
    id: "1",
    name: "メインメニュー",
    isDefault: true,
    areas: 6,
    createdAt: "2026-02-15",
  },
  {
    id: "2",
    name: "会員限定メニュー",
    isDefault: false,
    areas: 4,
    createdAt: "2026-03-01",
  },
  {
    id: "3",
    name: "キャンペーン用メニュー",
    isDefault: false,
    areas: 3,
    createdAt: "2026-03-10",
  },
  {
    id: "4",
    name: "簡易メニュー",
    isDefault: false,
    areas: 2,
    createdAt: "2026-03-18",
  },
];

export default function RichMenusPage() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          LINEトーク画面下部に表示されるリッチメニューを管理します
        </p>
        <button className="rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white hover:bg-[#05b34c] transition-colors">
          + 新規メニュー作成
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {placeholderMenus.map((menu) => (
          <div
            key={menu.id}
            className="group rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
          >
            {/* Image preview area */}
            <div className="relative h-40 bg-gray-100">
              {/* Simulated rich menu grid */}
              <div className="grid h-full grid-cols-3 grid-rows-2 gap-px bg-gray-300 p-px">
                {Array.from({ length: menu.areas }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-center bg-gray-50 text-xs text-gray-400"
                  >
                    エリア {i + 1}
                  </div>
                ))}
                {Array.from({ length: Math.max(0, 6 - menu.areas) }).map(
                  (_, i) => (
                    <div key={`empty-${i}`} className="bg-gray-100" />
                  )
                )}
              </div>

              {/* Default badge */}
              {menu.isDefault && (
                <div className="absolute right-2 top-2 rounded-full bg-[#06C755] px-2.5 py-0.5 text-xs font-bold text-white shadow">
                  デフォルト
                </div>
              )}
            </div>

            {/* Info */}
            <div className="border-t border-gray-100 p-4">
              <h3 className="text-sm font-semibold text-gray-900 group-hover:text-[#06C755] transition-colors">
                {menu.name}
              </h3>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  エリア数: {menu.areas}
                </span>
                <span className="text-xs text-gray-400">
                  {menu.createdAt}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
