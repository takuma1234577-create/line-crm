"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [form, setForm] = useState({
    channelId: "1234567890",
    channelSecret: "abcdef1234567890abcdef1234567890",
    channelAccessToken:
      "eyJhbGciOiJIUzI1NiJ9.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    botBasicId: "@example-bot",
  });
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState(false);

  const webhookUrl = "https://your-domain.com/api/webhook/line";

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const maskValue = (value: string) => {
    if (value.length <= 8) return "••••••••";
    return value.slice(0, 4) + "••••••••" + value.slice(-4);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Form */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            LINE チャネル設定
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            LINE Messaging APIのチャネル情報を設定します
          </p>
        </div>

        <div className="space-y-5 p-6">
          {/* Channel ID */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Channel ID
            </label>
            <input
              type="text"
              value={form.channelId}
              onChange={(e) =>
                setForm({ ...form, channelId: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
            />
          </div>

          {/* Channel Secret */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Channel Secret
            </label>
            <div className="relative">
              <input
                type={showSecret ? "text" : "password"}
                value={
                  showSecret ? form.channelSecret : maskValue(form.channelSecret)
                }
                onChange={(e) =>
                  setForm({ ...form, channelSecret: e.target.value })
                }
                readOnly={!showSecret}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-20 text-sm font-mono focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-[#06C755] hover:bg-[#06C755]/10 transition-colors"
              >
                {showSecret ? "非表示" : "表示"}
              </button>
            </div>
          </div>

          {/* Channel Access Token */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Channel Access Token
            </label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={
                  showToken
                    ? form.channelAccessToken
                    : maskValue(form.channelAccessToken)
                }
                onChange={(e) =>
                  setForm({ ...form, channelAccessToken: e.target.value })
                }
                readOnly={!showToken}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-20 text-sm font-mono focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-[#06C755] hover:bg-[#06C755]/10 transition-colors"
              >
                {showToken ? "非表示" : "表示"}
              </button>
            </div>
          </div>

          {/* Webhook URL */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Webhook URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={webhookUrl}
                readOnly
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-600"
              />
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(webhookUrl)}
                className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                コピー
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              LINE Developers ConsoleのWebhook URLにこのURLを設定してください
            </p>
          </div>

          {/* Bot Basic ID */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Bot Basic ID
            </label>
            <input
              type="text"
              value={form.botBasicId}
              onChange={(e) =>
                setForm({ ...form, botBasicId: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
            />
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          {saved && (
            <span className="text-sm font-medium text-[#06C755]">
              保存しました
            </span>
          )}
          <button
            onClick={handleSave}
            className="rounded-lg bg-[#06C755] px-6 py-2 text-sm font-medium text-white hover:bg-[#05b34c] transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
