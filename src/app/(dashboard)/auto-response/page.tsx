"use client";

import { useState } from "react";

type MatchType = "exact" | "partial" | "prefix" | "regex";

interface AutoResponseRule {
  id: string;
  name: string;
  matchType: MatchType;
  keyword: string;
  response: string;
  enabled: boolean;
}

const matchTypeLabels: Record<MatchType, string> = {
  exact: "完全一致",
  partial: "部分一致",
  prefix: "前方一致",
  regex: "正規表現",
};

const placeholderRules: AutoResponseRule[] = [
  {
    id: "1",
    name: "営業時間案内",
    matchType: "exact",
    keyword: "営業時間",
    response: "営業時間は10:00〜19:00です。定休日は水曜日です。",
    enabled: true,
  },
  {
    id: "2",
    name: "アクセス案内",
    matchType: "partial",
    keyword: "場所|アクセス|行き方",
    response: "〒100-0001 東京都千代田区千代田1-1\nJR東京駅から徒歩5分です。",
    enabled: true,
  },
  {
    id: "3",
    name: "予約受付",
    matchType: "prefix",
    keyword: "予約",
    response: "ご予約ありがとうございます。こちらのフォームからご予約ください: https://example.com/reserve",
    enabled: false,
  },
  {
    id: "4",
    name: "挨拶応答",
    matchType: "regex",
    keyword: "^(こんにちは|こんばんは|おはよう)",
    response: "こんにちは！お問い合わせありがとうございます。何かお手伝いできることはありますか？",
    enabled: true,
  },
  {
    id: "5",
    name: "料金案内",
    matchType: "partial",
    keyword: "料金|値段|価格",
    response: "料金表はこちらをご覧ください: https://example.com/pricing",
    enabled: true,
  },
];

export default function AutoResponsePage() {
  const [rules, setRules] = useState<AutoResponseRule[]>(placeholderRules);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    matchType: "partial" as MatchType,
    keyword: "",
    response: "",
  });

  const toggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleCreate = () => {
    if (!formData.name || !formData.keyword || !formData.response) return;
    const newRule: AutoResponseRule = {
      id: String(Date.now()),
      name: formData.name,
      matchType: formData.matchType,
      keyword: formData.keyword,
      response: formData.response,
      enabled: true,
    };
    setRules((prev) => [newRule, ...prev]);
    setFormData({ name: "", matchType: "partial", keyword: "", response: "" });
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          キーワードに応じた自動応答ルールを管理します
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white hover:bg-[#05b34c] transition-colors"
        >
          + 新規ルール作成
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-gray-900">
            新規ルール作成
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                ルール名
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="例: 営業時間案内"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                マッチタイプ
              </label>
              <select
                value={formData.matchType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    matchType: e.target.value as MatchType,
                  })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
              >
                {Object.entries(matchTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              キーワード
            </label>
            <input
              type="text"
              value={formData.keyword}
              onChange={(e) =>
                setFormData({ ...formData, keyword: e.target.value })
              }
              placeholder="例: 営業時間（正規表現やパイプ区切りも可）"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              応答メッセージ
            </label>
            <textarea
              rows={3}
              value={formData.response}
              onChange={(e) =>
                setFormData({ ...formData, response: e.target.value })
              }
              placeholder="自動で返信するメッセージを入力してください"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleCreate}
              className="rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white hover:bg-[#05b34c] transition-colors"
            >
              作成
            </button>
          </div>
        </div>
      )}

      {/* Rules List */}
      <div className="space-y-3">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {rule.name}
                  </h3>
                  <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                    {matchTypeLabels[rule.matchType]}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-gray-500">
                    キーワード:
                  </span>
                  <code className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-800">
                    {rule.keyword}
                  </code>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">
                  {rule.response}
                </p>
              </div>
              <button
                onClick={() => toggleRule(rule.id)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                  rule.enabled ? "bg-[#06C755]" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform mt-0.5 ${
                    rule.enabled ? "translate-x-5 ml-0.5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
