"use client";

import { useState } from "react";

interface Reservation {
  id: string;
  date: string;
  time: string;
  title: string;
  reservedCount: number;
  capacity: number;
}

const placeholderReservations: Reservation[] = [
  {
    id: "1",
    date: "2026-03-24",
    time: "10:00 - 11:00",
    title: "個別カウンセリング",
    reservedCount: 3,
    capacity: 5,
  },
  {
    id: "2",
    date: "2026-03-24",
    time: "14:00 - 15:30",
    title: "グループセミナー",
    reservedCount: 12,
    capacity: 20,
  },
  {
    id: "3",
    date: "2026-03-25",
    time: "10:00 - 11:00",
    title: "個別カウンセリング",
    reservedCount: 5,
    capacity: 5,
  },
  {
    id: "4",
    date: "2026-03-25",
    time: "13:00 - 14:00",
    title: "体験レッスン",
    reservedCount: 8,
    capacity: 10,
  },
  {
    id: "5",
    date: "2026-03-26",
    time: "11:00 - 12:00",
    title: "オンライン相談",
    reservedCount: 2,
    capacity: 3,
  },
  {
    id: "6",
    date: "2026-03-27",
    time: "15:00 - 16:30",
    title: "グループセミナー",
    reservedCount: 15,
    capacity: 20,
  },
  {
    id: "7",
    date: "2026-03-28",
    time: "10:00 - 11:00",
    title: "個別カウンセリング",
    reservedCount: 1,
    capacity: 5,
  },
];

const viewOptions = [
  { value: "list", label: "リスト" },
  { value: "calendar", label: "カレンダー" },
] as const;

export default function ReservationsPage() {
  const [view, setView] = useState<"list" | "calendar">("list");

  // Group reservations by date for calendar view
  const grouped = placeholderReservations.reduce<Record<string, Reservation[]>>(
    (acc, r) => {
      if (!acc[r.date]) acc[r.date] = [];
      acc[r.date].push(r);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500">予約スロットと予約状況を管理します</p>
          <div className="flex rounded-lg border border-gray-300 bg-white">
            {viewOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setView(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === opt.value
                    ? "bg-[#06C755] text-white"
                    : "text-gray-600 hover:bg-gray-50"
                } ${opt.value === "list" ? "rounded-l-lg" : "rounded-r-lg"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <button className="rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white hover:bg-[#05b34c] transition-colors">
          + 新規スロット作成
        </button>
      </div>

      {view === "list" ? (
        /* Table View */
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 font-semibold text-gray-600">日付</th>
                <th className="px-6 py-3 font-semibold text-gray-600">時間</th>
                <th className="px-6 py-3 font-semibold text-gray-600">
                  タイトル
                </th>
                <th className="px-6 py-3 font-semibold text-gray-600">
                  予約数/定員
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {placeholderReservations.map((r) => {
                const isFull = r.reservedCount >= r.capacity;
                return (
                  <tr
                    key={r.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {r.date}
                    </td>
                    <td className="px-6 py-4 text-gray-500">{r.time}</td>
                    <td className="px-6 py-4 text-gray-900">{r.title}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isFull ? "bg-red-500" : "bg-[#06C755]"
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                (r.reservedCount / r.capacity) * 100
                              )}%`,
                            }}
                          />
                        </div>
                        <span
                          className={`text-sm font-medium ${
                            isFull ? "text-red-600" : "text-gray-700"
                          }`}
                        >
                          {r.reservedCount}/{r.capacity}
                        </span>
                        {isFull && (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            満席
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Calendar-like View */
        <div className="space-y-4">
          {Object.entries(grouped).map(([date, reservations]) => (
            <div
              key={date}
              className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
            >
              <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
                <h3 className="text-sm font-semibold text-gray-900">{date}</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {reservations.map((r) => {
                  const isFull = r.reservedCount >= r.capacity;
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between px-5 py-3"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-[#06C755]">
                          {r.time}
                        </span>
                        <span className="text-sm text-gray-900">
                          {r.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium ${
                            isFull ? "text-red-600" : "text-gray-600"
                          }`}
                        >
                          {r.reservedCount}/{r.capacity}
                        </span>
                        {isFull && (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            満席
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
