"use client";

interface TrackingUrl {
  id: string;
  label: string;
  originalUrl: string;
  shortUrl: string;
  clickCount: number;
  createdAt: string;
}

const placeholderUrls: TrackingUrl[] = [
  {
    id: "1",
    label: "3月キャンペーンLP",
    originalUrl: "https://example.com/campaign/march2026",
    shortUrl: "https://lin.ee/abc123",
    clickCount: 342,
    createdAt: "2026-03-01",
  },
  {
    id: "2",
    label: "新商品紹介ページ",
    originalUrl: "https://example.com/products/new-spring",
    shortUrl: "https://lin.ee/def456",
    clickCount: 189,
    createdAt: "2026-03-05",
  },
  {
    id: "3",
    label: "セミナー申込ページ",
    originalUrl: "https://example.com/seminar/apply",
    shortUrl: "https://lin.ee/ghi789",
    clickCount: 95,
    createdAt: "2026-03-10",
  },
  {
    id: "4",
    label: "アンケートフォーム",
    originalUrl: "https://example.com/survey/customer-2026",
    shortUrl: "https://lin.ee/jkl012",
    clickCount: 56,
    createdAt: "2026-03-12",
  },
  {
    id: "5",
    label: "公式サイトトップ",
    originalUrl: "https://example.com/",
    shortUrl: "https://lin.ee/mno345",
    clickCount: 1024,
    createdAt: "2026-02-01",
  },
];

export default function UrlTrackingPage() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          クリック計測用のトラッキングURLを管理します
        </p>
        <button className="rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white hover:bg-[#05b34c] transition-colors">
          + 新規トラッキングURL
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-3 font-semibold text-gray-600">ラベル</th>
              <th className="px-6 py-3 font-semibold text-gray-600">元URL</th>
              <th className="px-6 py-3 font-semibold text-gray-600">
                短縮URL
              </th>
              <th className="px-6 py-3 font-semibold text-gray-600">
                クリック数
              </th>
              <th className="px-6 py-3 font-semibold text-gray-600">作成日</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {placeholderUrls.map((url) => (
              <tr
                key={url.id}
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="px-6 py-4 font-medium text-gray-900">
                  {url.label}
                </td>
                <td className="max-w-[200px] truncate px-6 py-4 text-gray-500">
                  {url.originalUrl}
                </td>
                <td className="px-6 py-4">
                  <code className="rounded bg-gray-100 px-2 py-0.5 text-xs text-[#06C755]">
                    {url.shortUrl}
                  </code>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                    {url.clickCount.toLocaleString()}回
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500">{url.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
