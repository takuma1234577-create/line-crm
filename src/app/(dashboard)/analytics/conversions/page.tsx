"use client";

interface Conversion {
  id: string;
  eventName: string;
  conversionCount: number;
  totalAmount: number;
}

const placeholderConversions: Conversion[] = [
  {
    id: "1",
    eventName: "商品購入",
    conversionCount: 89,
    totalAmount: 1245000,
  },
  {
    id: "2",
    eventName: "会員登録",
    conversionCount: 156,
    totalAmount: 0,
  },
  {
    id: "3",
    eventName: "セミナー申込",
    conversionCount: 34,
    totalAmount: 170000,
  },
  {
    id: "4",
    eventName: "資料請求",
    conversionCount: 67,
    totalAmount: 0,
  },
  {
    id: "5",
    eventName: "予約完了",
    conversionCount: 45,
    totalAmount: 675000,
  },
  {
    id: "6",
    eventName: "クーポン利用",
    conversionCount: 123,
    totalAmount: 492000,
  },
];

export default function ConversionsPage() {
  const totalConversions = placeholderConversions.reduce(
    (sum, c) => sum + c.conversionCount,
    0
  );
  const totalRevenue = placeholderConversions.reduce(
    (sum, c) => sum + c.totalAmount,
    0
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <p className="text-sm text-gray-500">
        コンバージョンイベントの計測結果を確認できます
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">総コンバージョン数</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {totalConversions.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">合計金額</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            ¥{totalRevenue.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-3 font-semibold text-gray-600">
                イベント名
              </th>
              <th className="px-6 py-3 font-semibold text-gray-600">
                コンバージョン数
              </th>
              <th className="px-6 py-3 font-semibold text-gray-600">
                合計金額
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {placeholderConversions.map((conversion) => (
              <tr
                key={conversion.id}
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="px-6 py-4 font-medium text-gray-900">
                  {conversion.eventName}
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                    {conversion.conversionCount.toLocaleString()}件
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-700 font-medium">
                  {conversion.totalAmount > 0
                    ? `¥${conversion.totalAmount.toLocaleString()}`
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
