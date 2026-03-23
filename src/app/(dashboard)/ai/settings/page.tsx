"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

const CHANNEL_ID = "00000000-0000-0000-0000-000000000010";

const TONE_OPTIONS = [
  { value: "polite", label: "丁寧語" },
  { value: "casual", label: "カジュアル" },
  { value: "business", label: "ビジネス" },
  { value: "friendly", label: "フレンドリー" },
];

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

interface AISettings {
  auto_reply_enabled: boolean;
  persona_name: string;
  persona_description: string;
  tone: string;
  system_instructions: string;
  reply_delay_seconds: number;
  max_message_length: number;
  active_hours_start: string;
  active_hours_end: string;
  active_days: number[];
  escalation_keywords: string[];
  ng_words: string[];
}

const defaultSettings: AISettings = {
  auto_reply_enabled: false,
  persona_name: "",
  persona_description: "",
  tone: "polite",
  system_instructions: "",
  reply_delay_seconds: 0,
  max_message_length: 500,
  active_hours_start: "09:00",
  active_hours_end: "18:00",
  active_days: [1, 2, 3, 4, 5],
  escalation_keywords: [],
  ng_words: [],
};

export default function AISettingsPage() {
  const [settings, setSettings] = useState<AISettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [escalationText, setEscalationText] = useState("");
  const [ngWordsText, setNgWordsText] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_settings")
      .select("*")
      .eq("channel_id", CHANNEL_ID)
      .single();

    if (data && !error) {
      setSettings({
        auto_reply_enabled: data.auto_reply_enabled ?? false,
        persona_name: data.persona_name ?? "",
        persona_description: data.persona_description ?? "",
        tone: data.tone ?? "polite",
        system_instructions: data.system_instructions ?? "",
        reply_delay_seconds: data.reply_delay_seconds ?? 0,
        max_message_length: data.max_message_length ?? 500,
        active_hours_start: data.active_hours_start ?? "09:00",
        active_hours_end: data.active_hours_end ?? "18:00",
        active_days: data.active_days ?? [1, 2, 3, 4, 5],
        escalation_keywords: data.escalation_keywords ?? [],
        ng_words: data.ng_words ?? [],
      });
      setEscalationText((data.escalation_keywords ?? []).join("\n"));
      setNgWordsText((data.ng_words ?? []).join("\n"));
    }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaveMessage("");

    const keywords = escalationText
      .split("\n")
      .map((s: string) => s.trim())
      .filter(Boolean);
    const ngWords = ngWordsText
      .split("\n")
      .map((s: string) => s.trim())
      .filter(Boolean);

    const payload = {
      ...settings,
      escalation_keywords: keywords,
      ng_words: ngWords,
      channel_id: CHANNEL_ID,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("ai_settings")
      .upsert(payload, { onConflict: "channel_id" });

    if (error) {
      setSaveMessage("保存に失敗しました: " + error.message);
    } else {
      setSaveMessage("設定を保存しました");
      setSettings((prev) => ({
        ...prev,
        escalation_keywords: keywords,
        ng_words: ngWords,
      }));
    }
    setSaving(false);
    setTimeout(() => setSaveMessage(""), 3000);
  }

  function toggleDay(day: number) {
    setSettings((prev) => ({
      ...prev,
      active_days: prev.active_days.includes(day)
        ? prev.active_days.filter((d) => d !== day)
        : [...prev.active_days, day].sort(),
    }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#06C755] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI自動返信設定</h1>
        <p className="mt-1 text-sm text-gray-500">
          AIによる自動返信の動作を設定します
        </p>
      </div>

      {/* 自動返信ON/OFF */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">自動返信ON/OFF</h2>
            <p className="mt-1 text-sm text-gray-500">
              AI自動返信:{" "}
              <span
                className={
                  settings.auto_reply_enabled
                    ? "font-bold text-[#06C755]"
                    : "font-bold text-gray-400"
                }
              >
                {settings.auto_reply_enabled ? "ON" : "OFF"}
              </span>
            </p>
          </div>
          <button
            onClick={() =>
              setSettings((prev) => ({
                ...prev,
                auto_reply_enabled: !prev.auto_reply_enabled,
              }))
            }
            className={`relative inline-flex h-8 w-16 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
              settings.auto_reply_enabled ? "bg-[#06C755]" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                settings.auto_reply_enabled ? "translate-x-9" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* 人格設定 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-gray-900">人格設定</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              ペルソナ名
            </label>
            <input
              type="text"
              value={settings.persona_name}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  persona_name: e.target.value,
                }))
              }
              placeholder="例: みさきアシスタント"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              人物像・役割
            </label>
            <textarea
              value={settings.persona_description}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  persona_description: e.target.value,
                }))
              }
              rows={4}
              placeholder="例: あなたは美容サロン「ビューティーみさき」のアシスタントです。お客様の予約や施術に関する質問に答えます。明るく親切な性格です。"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              口調
            </label>
            <select
              value={settings.tone}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, tone: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
            >
              {TONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 運営者指示 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-gray-900">運営者指示</h2>
        <textarea
          value={settings.system_instructions}
          onChange={(e) =>
            setSettings((prev) => ({
              ...prev,
              system_instructions: e.target.value,
            }))
          }
          rows={6}
          placeholder={`例：\n・予約は電話（03-xxxx-xxxx）でお願いしてください\n・営業時間は10:00〜19:00です\n・クーポンの質問にはキャンペーンページのURLを案内してください`}
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
        />
      </div>

      {/* 返信ルール */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-gray-900">返信ルール</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              返信遅延（秒）
            </label>
            <input
              type="number"
              min={0}
              value={settings.reply_delay_seconds}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  reply_delay_seconds: parseInt(e.target.value) || 0,
                }))
              }
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
            />
            <p className="mt-1 text-xs text-gray-400">
              0 = 即座に返信
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              最大文字数
            </label>
            <input
              type="number"
              min={1}
              value={settings.max_message_length}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  max_message_length: parseInt(e.target.value) || 500,
                }))
              }
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
            />
          </div>
        </div>
      </div>

      {/* 対応時間 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-gray-900">対応時間</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                開始時刻
              </label>
              <input
                type="time"
                value={settings.active_hours_start}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    active_hours_start: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                終了時刻
              </label>
              <input
                type="time"
                value={settings.active_hours_end}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    active_hours_end: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              対応曜日
            </label>
            <div className="flex flex-wrap gap-2">
              {DAY_LABELS.map((label, index) => (
                <button
                  key={index}
                  onClick={() => toggleDay(index)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    settings.active_days.includes(index)
                      ? "bg-[#06C755] text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* エスカレーション設定 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-bold text-gray-900">
          エスカレーション設定
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          これらのキーワードを含むメッセージは自動返信せず、管理者に通知します
        </p>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          エスカレーションキーワード（1行1キーワード）
        </label>
        <textarea
          value={escalationText}
          onChange={(e) => setEscalationText(e.target.value)}
          rows={5}
          placeholder={`例:\nクレーム\n返金\n解約\n責任者`}
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
        />
      </div>

      {/* NGワード */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-bold text-gray-900">NGワード</h2>
        <p className="mb-4 text-sm text-gray-500">
          AIが使用しない言葉を指定します
        </p>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          NGワード（1行1ワード）
        </label>
        <textarea
          value={ngWordsText}
          onChange={(e) => setNgWordsText(e.target.value)}
          rows={5}
          placeholder={`例:\n競合他社名\n不適切な表現`}
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
        />
      </div>

      {/* 保存ボタン */}
      <div className="flex items-center gap-4 pb-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-[#06C755] px-8 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#05b34c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "保存中..." : "設定を保存"}
        </button>
        {saveMessage && (
          <p
            className={`text-sm font-medium ${
              saveMessage.includes("失敗")
                ? "text-red-600"
                : "text-[#06C755]"
            }`}
          >
            {saveMessage}
          </p>
        )}
      </div>
    </div>
  );
}
