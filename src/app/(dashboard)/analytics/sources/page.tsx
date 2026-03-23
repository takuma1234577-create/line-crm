"use client";

interface Source {
  id: string;
  name: string;
  code: string;
  friendCount: number;
  qrUrl: string;
}

const placeholderSources: Source[] = [
  {
    id: "1",
    name: "店頭POP",
    code: "store_pop",
    friendCount: 342,
    qrUrl: "https://lin.ee/qr/store_pop",
  },
  {
    id: "2",
    name: "Webサイト",
    code: "website",
    friendCount: 528,
    qrUrl: "https://lin.ee/qr/website",
  },
  {
    id: "3",
    name: "Instagram広告",
    code: "ig_ad_2026",
    friendCount: 189,
    qrUrl: "https://lin.ee/qr/ig_ad_2026",
  },
  {
    id: "4",
    name: "チラシ配布",
    code: "flyer_march",
    friendCount: 67,
    qrUrl: "https://lin.ee/qr/flyer_march",
  },
  {
    id: "5",
    name: "紹介キャンペーン",
    code: "referral",
    friendCount: 95,
    qrUrl: "https://lin.ee/qr/referral",
  },
  {
    id: "6",
    name: "Google広告",
    code: "google_ad",
    friendCount: 156,
    qrUrl: "https://lin.ee/qr/google_ad",
  },
];

export default function SourcesPage() {
  const totalFriends = placeholderSources.reduce(
    (sum, s) => sum + s.friendCount,
    0
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          友だち追加の流入経路を分析・管理します
        </p>
        <button className="rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white hover:bg-[#05b34c] transition-colors">
          + 新規流入経路
        </button>
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">計測済み友だち総数</p>
        <p className="mt-2 text-3xl font-bold text-gray-900">
          {totalFriends.toLocaleString()}人
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-3 font-semibold text-gray-600">経路名</th>
              <th className="px-6 py-3 font-semibold text-gray-600">コード</th>
              <th className="px-6 py-3 font-semibold text-gray-600">
                友だち数
              </th>
              <th className="px-6 py-3 font-semibold text-gray-600">
                割合
              </th>
              <th className="px-6 py-3 font-semibold text-gray-600">QR URL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {placeholderSources.map((source) => {
              const percentage = (
                (source.friendCount / totalFriends) *
                100
              ).toFixed(1);
              return (
                <tr
                  key={source.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {source.name}
                  </td>
                  <td className="px-6 py-4">
                    <code className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                      {source.code}
                    </code>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#06C755]"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        {source.friendCount}人
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{percentage}%</td>
                  <td className="px-6 py-4">
                    <code className="rounded bg-gray-100 px-2 py-0.5 text-xs text-[#06C755]">
                      {source.qrUrl}
                    </code>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
