"use client";

import { useState } from "react";

type DelayUnit = "minutes" | "hours" | "days";

interface Step {
  id: string;
  order: number;
  delayValue: number;
  delayUnit: DelayUnit;
  message: string;
}

const delayUnitLabels: Record<DelayUnit, string> = {
  minutes: "分後",
  hours: "時間後",
  days: "日後",
};

const initialSteps: Step[] = [
  {
    id: "1",
    order: 1,
    delayValue: 0,
    delayUnit: "minutes",
    message:
      "友だち追加ありがとうございます！\nこちらは〇〇ショップの公式LINEです。お得な情報をお届けします。",
  },
  {
    id: "2",
    order: 2,
    delayValue: 1,
    delayUnit: "days",
    message:
      "昨日はご登録ありがとうございました。\n当ショップの人気商品TOP5をご紹介します！",
  },
  {
    id: "3",
    order: 3,
    delayValue: 3,
    delayUnit: "days",
    message:
      "ご登録から3日が経ちました。\n初回限定10%OFFクーポンをプレゼント！\nクーポンコード: WELCOME10",
  },
  {
    id: "4",
    order: 4,
    delayValue: 7,
    delayUnit: "days",
    message:
      "お元気ですか？\n今週のおすすめ商品をお知らせします。ぜひチェックしてみてください！",
  },
  {
    id: "5",
    order: 5,
    delayValue: 14,
    delayUnit: "days",
    message:
      "ご登録から2週間が経ちました。\nアンケートにご協力いただけますか？所要時間は1分です。",
  },
];

export default function StepEditorPage() {
  const [steps, setSteps] = useState<Step[]>(initialSteps);
  const [editingId, setEditingId] = useState<string | null>(null);

  const addStep = () => {
    const newStep: Step = {
      id: String(Date.now()),
      order: steps.length + 1,
      delayValue: 1,
      delayUnit: "days",
      message: "",
    };
    setSteps((prev) => [...prev, newStep]);
    setEditingId(newStep.id);
  };

  const updateStep = (id: string, updates: Partial<Step>) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const removeStep = (id: string) => {
    setSteps((prev) =>
      prev
        .filter((s) => s.id !== id)
        .map((s, i) => ({ ...s, order: i + 1 }))
    );
    if (editingId === id) setEditingId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            新規友だちウェルカム
          </h2>
          <p className="text-sm text-gray-500">
            トリガー: 友だち追加時 ・ 登録者数: 342人
          </p>
        </div>
        <button
          onClick={addStep}
          className="rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white hover:bg-[#05b34c] transition-colors"
        >
          + ステップ追加
        </button>
      </div>

      {/* Timeline */}
      <div className="relative">
        {steps.map((step, index) => (
          <div key={step.id} className="relative flex gap-4 pb-8 last:pb-0">
            {/* Timeline line */}
            {index < steps.length - 1 && (
              <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-gray-200" />
            )}

            {/* Step number circle */}
            <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#06C755] text-sm font-bold text-white shadow-sm">
              {step.order}
            </div>

            {/* Step content */}
            <div className="flex-1 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {/* Step header */}
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-900">
                    ステップ {step.order}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                    {step.delayValue === 0
                      ? "即時送信"
                      : `${step.delayValue}${delayUnitLabels[step.delayUnit]}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setEditingId(editingId === step.id ? null : step.id)
                    }
                    className="text-sm font-medium text-[#06C755] hover:underline"
                  >
                    {editingId === step.id ? "閉じる" : "編集"}
                  </button>
                  {steps.length > 1 && (
                    <button
                      onClick={() => removeStep(step.id)}
                      className="text-sm font-medium text-red-500 hover:underline"
                    >
                      削除
                    </button>
                  )}
                </div>
              </div>

              {/* Edit form */}
              {editingId === step.id ? (
                <div className="p-5 space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      待機時間
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={0}
                        value={step.delayValue}
                        onChange={(e) =>
                          updateStep(step.id, {
                            delayValue: Number(e.target.value),
                          })
                        }
                        className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
                      />
                      <select
                        value={step.delayUnit}
                        onChange={(e) =>
                          updateStep(step.id, {
                            delayUnit: e.target.value as DelayUnit,
                          })
                        }
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
                      >
                        <option value="minutes">分</option>
                        <option value="hours">時間</option>
                        <option value="days">日</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      メッセージ内容
                    </label>
                    <textarea
                      rows={4}
                      value={step.message}
                      onChange={(e) =>
                        updateStep(step.id, { message: e.target.value })
                      }
                      placeholder="メッセージを入力してください"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
                    />
                  </div>
                </div>
              ) : (
                /* Message preview */
                <div className="p-5">
                  <div className="rounded-lg bg-[#06C755]/5 p-3">
                    <p className="whitespace-pre-wrap text-sm text-gray-700">
                      {step.message || (
                        <span className="italic text-gray-400">
                          メッセージ未設定
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button className="rounded-lg bg-[#06C755] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#05b34c] transition-colors">
          保存
        </button>
      </div>
    </div>
  );
}
