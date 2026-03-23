"use client";

import { useState } from "react";

interface Form {
  id: string;
  name: string;
  responseCount: number;
  enabled: boolean;
  createdAt: string;
}

const placeholderForms: Form[] = [
  {
    id: "1",
    name: "顧客アンケート2026年3月",
    responseCount: 142,
    enabled: true,
    createdAt: "2026-03-01",
  },
  {
    id: "2",
    name: "セミナー申込フォーム",
    responseCount: 56,
    enabled: true,
    createdAt: "2026-03-05",
  },
  {
    id: "3",
    name: "お問い合わせフォーム",
    responseCount: 328,
    enabled: true,
    createdAt: "2026-02-10",
  },
  {
    id: "4",
    name: "商品レビュー収集",
    responseCount: 89,
    enabled: false,
    createdAt: "2026-02-20",
  },
  {
    id: "5",
    name: "会員登録フォーム",
    responseCount: 215,
    enabled: true,
    createdAt: "2026-01-15",
  },
];

export default function FormsPage() {
  const [forms, setForms] = useState(placeholderForms);

  const toggleForm = (id: string) => {
    setForms((prev) =>
      prev.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f))
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          LINE上で回答を収集するフォームを管理します
        </p>
        <button className="rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white hover:bg-[#05b34c] transition-colors">
          + 新規フォーム
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-3 font-semibold text-gray-600">
                フォーム名
              </th>
              <th className="px-6 py-3 font-semibold text-gray-600">回答数</th>
              <th className="px-6 py-3 font-semibold text-gray-600">
                有効/無効
              </th>
              <th className="px-6 py-3 font-semibold text-gray-600">作成日</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {forms.map((form) => (
              <tr
                key={form.id}
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="px-6 py-4 font-medium text-gray-900">
                  {form.name}
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                    {form.responseCount}件
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => toggleForm(form.id)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                      form.enabled ? "bg-[#06C755]" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform mt-0.5 ${
                        form.enabled
                          ? "translate-x-5 ml-0.5"
                          : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </td>
                <td className="px-6 py-4 text-gray-500">{form.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
