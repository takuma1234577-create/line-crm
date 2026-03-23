"use client";

type TemplateType = "text" | "image" | "flex";

interface Template {
  id: string;
  name: string;
  type: TemplateType;
  preview: string;
  createdAt: string;
}

const typeLabels: Record<TemplateType, { label: string; className: string }> = {
  text: { label: "テキスト", className: "bg-blue-100 text-blue-700" },
  image: { label: "画像", className: "bg-orange-100 text-orange-700" },
  flex: { label: "Flex", className: "bg-purple-100 text-purple-700" },
};

const placeholderTemplates: Template[] = [
  {
    id: "1",
    name: "ウェルカムメッセージ",
    type: "text",
    preview:
      "友だち追加ありがとうございます！こちらは〇〇ショップの公式LINEです。",
    createdAt: "2026-03-01",
  },
  {
    id: "2",
    name: "クーポン配布",
    type: "flex",
    preview: "10%OFFクーポン - Flexメッセージ",
    createdAt: "2026-03-05",
  },
  {
    id: "3",
    name: "新商品紹介",
    type: "image",
    preview: "春の新商品コレクション画像",
    createdAt: "2026-03-10",
  },
  {
    id: "4",
    name: "営業時間変更のお知らせ",
    type: "text",
    preview: "いつもご利用ありがとうございます。4月より営業時間を変更いたします。",
    createdAt: "2026-03-12",
  },
  {
    id: "5",
    name: "イベント告知",
    type: "flex",
    preview: "春の感謝祭開催！ - カルーセルメッセージ",
    createdAt: "2026-03-15",
  },
  {
    id: "6",
    name: "商品写真テンプレート",
    type: "image",
    preview: "商品紹介用画像テンプレート",
    createdAt: "2026-03-18",
  },
];

export default function TemplatesPage() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          メッセージテンプレートを管理・再利用できます
        </p>
        <button className="rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white hover:bg-[#05b34c] transition-colors">
          + 新規テンプレート
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {placeholderTemplates.map((template) => {
          const typeInfo = typeLabels[template.type];
          return (
            <div
              key={template.id}
              className="group rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
            >
              {/* Preview area */}
              <div className="relative h-36 bg-gray-50 flex items-center justify-center p-4">
                {template.type === "image" ? (
                  <div className="flex h-full w-full items-center justify-center rounded-lg bg-gray-200">
                    <svg
                      className="h-10 w-10 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                ) : template.type === "flex" ? (
                  <div className="w-full rounded-lg border border-dashed border-gray-300 bg-white p-3">
                    <div className="space-y-2">
                      <div className="h-3 w-3/4 rounded bg-gray-200" />
                      <div className="h-3 w-1/2 rounded bg-gray-200" />
                      <div className="mt-2 h-6 w-20 rounded bg-[#06C755]/20" />
                    </div>
                  </div>
                ) : (
                  <div className="w-full rounded-lg bg-[#06C755]/5 p-3">
                    <p className="line-clamp-3 text-xs text-gray-600">
                      {template.preview}
                    </p>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="border-t border-gray-100 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900 group-hover:text-[#06C755] transition-colors">
                    {template.name}
                  </h3>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeInfo.className}`}
                  >
                    {typeInfo.label}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500 line-clamp-1">
                  {template.preview}
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  作成日: {template.createdAt}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
