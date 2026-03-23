"use client";

import Link from "next/link";
import { useState } from "react";

interface StepSequence {
  id: string;
  name: string;
  trigger: string;
  stepCount: number;
  enabled: boolean;
  subscriberCount: number;
}

const placeholderSequences: StepSequence[] = [
  {
    id: "1",
    name: "新規友だちウェルカム",
    trigger: "友だち追加時",
    stepCount: 5,
    enabled: true,
    subscriberCount: 342,
  },
  {
    id: "2",
    name: "商品購入フォローアップ",
    trigger: "タグ「購入済」追加時",
    stepCount: 3,
    enabled: true,
    subscriberCount: 128,
  },
  {
    id: "3",
    name: "セミナー参加者フォロー",
    trigger: "タグ「セミナー参加」追加時",
    stepCount: 7,
    enabled: false,
    subscriberCount: 56,
  },
  {
    id: "4",
    name: "会員登録促進",
    trigger: "フォーム回答時",
    stepCount: 4,
    enabled: true,
    subscriberCount: 89,
  },
  {
    id: "5",
    name: "リピーター育成",
    trigger: "タグ「初回購入」追加時",
    stepCount: 10,
    enabled: false,
    subscriberCount: 215,
  },
];

export default function StepsPage() {
  const [sequences, setSequences] = useState(placeholderSequences);

  const toggleSequence = (id: string) => {
    setSequences((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          段階的にメッセージを自動配信するシーケンスを管理します
        </p>
        <button className="rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white hover:bg-[#05b34c] transition-colors">
          + 新規シーケンス作成
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-3 font-semibold text-gray-600">
                シーケンス名
              </th>
              <th className="px-6 py-3 font-semibold text-gray-600">
                トリガー
              </th>
              <th className="px-6 py-3 font-semibold text-gray-600">
                ステップ数
              </th>
              <th className="px-6 py-3 font-semibold text-gray-600">
                有効/無効
              </th>
              <th className="px-6 py-3 font-semibold text-gray-600">
                登録者数
              </th>
              <th className="px-6 py-3 font-semibold text-gray-600" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sequences.map((seq) => (
              <tr
                key={seq.id}
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="px-6 py-4 font-medium text-gray-900">
                  {seq.name}
                </td>
                <td className="px-6 py-4 text-gray-500">{seq.trigger}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                    {seq.stepCount}ステップ
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => toggleSequence(seq.id)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                      seq.enabled ? "bg-[#06C755]" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform mt-0.5 ${
                        seq.enabled
                          ? "translate-x-5 ml-0.5"
                          : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {seq.subscriberCount}人
                </td>
                <td className="px-6 py-4">
                  <Link
                    href={`/steps/${seq.id}`}
                    className="text-sm font-medium text-[#06C755] hover:underline"
                  >
                    編集
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
