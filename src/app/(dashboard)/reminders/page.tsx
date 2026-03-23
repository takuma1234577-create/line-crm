"use client";

type ReminderStatus = "scheduled" | "sent" | "failed" | "draft";

interface Reminder {
  id: string;
  name: string;
  target: string;
  sendAt: string;
  status: ReminderStatus;
}

const statusLabels: Record<
  ReminderStatus,
  { label: string; className: string }
> = {
  scheduled: { label: "予約済み", className: "bg-blue-100 text-blue-700" },
  sent: { label: "送信済み", className: "bg-green-100 text-green-700" },
  failed: { label: "失敗", className: "bg-red-100 text-red-700" },
  draft: { label: "下書き", className: "bg-gray-100 text-gray-700" },
};

const placeholderReminders: Reminder[] = [
  {
    id: "1",
    name: "予約前日リマインド",
    target: "予約者全員",
    sendAt: "2026-03-23 09:00",
    status: "sent",
  },
  {
    id: "2",
    name: "セミナー参加確認",
    target: "セミナー申込者",
    sendAt: "2026-03-24 10:00",
    status: "scheduled",
  },
  {
    id: "3",
    name: "支払い期限リマインド",
    target: "未払いユーザー",
    sendAt: "2026-03-25 12:00",
    status: "scheduled",
  },
  {
    id: "4",
    name: "フォローアップ連絡",
    target: "来店済みユーザー",
    sendAt: "2026-03-26 15:00",
    status: "draft",
  },
  {
    id: "5",
    name: "キャンペーン終了前通知",
    target: "全ての友だち",
    sendAt: "2026-03-20 18:00",
    status: "sent",
  },
  {
    id: "6",
    name: "予約当日リマインド",
    target: "予約者全員",
    sendAt: "2026-03-19 08:00",
    status: "failed",
  },
];

export default function RemindersPage() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          指定日時にメッセージを自動送信するリマインダーを管理します
        </p>
        <button className="rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white hover:bg-[#05b34c] transition-colors">
          + 新規リマインダー
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-3 font-semibold text-gray-600">
                リマインダー名
              </th>
              <th className="px-6 py-3 font-semibold text-gray-600">送信先</th>
              <th className="px-6 py-3 font-semibold text-gray-600">
                送信日時
              </th>
              <th className="px-6 py-3 font-semibold text-gray-600">
                ステータス
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {placeholderReminders.map((reminder) => {
              const statusInfo = statusLabels[reminder.status];
              return (
                <tr
                  key={reminder.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {reminder.name}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {reminder.target}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {reminder.sendAt}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.className}`}
                    >
                      {statusInfo.label}
                    </span>
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
