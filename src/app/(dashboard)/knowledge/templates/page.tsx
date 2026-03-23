"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

const CHANNEL_ID = "00000000-0000-0000-0000-000000000010";

interface TemplateItem {
  category: string;
  title: string;
  content: string;
}

interface BusinessTemplate {
  name: string;
  description: string;
  icon: string;
  items: TemplateItem[];
}

const TEMPLATES: BusinessTemplate[] = [
  {
    name: "美容サロン",
    description: "ヘアサロン・ネイル・エステなどの美容サロン向け",
    icon: "scissors",
    items: [
      {
        category: "基本情報",
        title: "店舗概要",
        content:
          "【ここに店舗名・概要を入力】\n\n例：ビューティーサロンみさきは、2015年にオープンした完全予約制のヘアサロンです。",
      },
      {
        category: "サービス・商品",
        title: "メニュー一覧",
        content:
          "【ここにメニューを入力】\n\nカット: ¥5,000\nカラー: ¥8,000〜\nパーマ: ¥10,000〜\nトリートメント: ¥3,000〜",
      },
      {
        category: "料金",
        title: "料金体系",
        content: "【料金詳細を入力】",
      },
      {
        category: "営業時間・アクセス",
        title: "営業時間",
        content:
          "営業時間: 10:00〜19:00\n定休日: 毎週火曜日\n住所: 【住所を入力】\n最寄り駅: 【駅名を入力】",
      },
      {
        category: "よくある質問",
        title: "予約について",
        content:
          "Q: 予約はどうすればいいですか？\nA: LINEまたはお電話（03-xxxx-xxxx）で承っております。\n\nQ: 当日予約は可能ですか？\nA: 空きがあれば可能です。お気軽にお問い合わせください。",
      },
      {
        category: "よくある質問",
        title: "キャンセルについて",
        content:
          "Q: キャンセルはいつまで可能ですか？\nA: 前日の18時までにご連絡ください。当日キャンセルはキャンセル料が発生する場合がございます。",
      },
      {
        category: "キャンペーン",
        title: "現在のキャンペーン",
        content: "【キャンペーン情報を入力】",
      },
      {
        category: "ポリシー",
        title: "注意事項",
        content:
          "・完全予約制です\n・お支払いは現金/クレジットカード/PayPay対応\n・駐車場は2台分ございます",
      },
    ],
  },
  {
    name: "飲食店",
    description: "レストラン・カフェ・居酒屋などの飲食店向け",
    icon: "utensils",
    items: [
      {
        category: "基本情報",
        title: "店舗概要",
        content:
          "【ここに店舗名・概要を入力】\n\n例：イタリアンレストラン「ラ・クチーナ」は、本格的なイタリア料理をカジュアルにお楽しみいただけるお店です。",
      },
      {
        category: "サービス・商品",
        title: "メニュー一覧",
        content:
          "【ここにメニューを入力】\n\n■ ランチ\nパスタランチ: ¥1,200\nピザランチ: ¥1,400\nシェフのおすすめランチ: ¥1,800\n\n■ ディナー\nコースA: ¥3,500\nコースB: ¥5,000\nアラカルトあり",
      },
      {
        category: "料金",
        title: "料金・席料",
        content:
          "【料金詳細を入力】\n\n・席料: なし\n・サービス料: ディナーのみ10%\n・飲み放題: ¥1,500（2時間）",
      },
      {
        category: "営業時間・アクセス",
        title: "営業時間",
        content:
          "ランチ: 11:30〜14:00（L.O. 13:30）\nディナー: 17:30〜22:00（L.O. 21:00）\n定休日: 毎週月曜日\n住所: 【住所を入力】\n最寄り駅: 【駅名を入力】\n席数: 【席数を入力】",
      },
      {
        category: "よくある質問",
        title: "予約について",
        content:
          "Q: 予約はできますか？\nA: はい、LINEまたはお電話で承っております。\n\nQ: 何名まで予約可能ですか？\nA: 最大20名様まで対応可能です。貸切もご相談ください。\n\nQ: 子連れでも大丈夫ですか？\nA: お子様連れ大歓迎です。お子様用メニューもございます。",
      },
      {
        category: "よくある質問",
        title: "アレルギー対応",
        content:
          "Q: アレルギー対応はしていますか？\nA: はい、事前にご連絡いただければ対応いたします。ご予約時にお知らせください。",
      },
      {
        category: "キャンペーン",
        title: "現在のキャンペーン",
        content: "【キャンペーン情報を入力】",
      },
      {
        category: "ポリシー",
        title: "注意事項",
        content:
          "・お支払いは現金/クレジットカード/電子マネー対応\n・駐車場は提携コインパーキングあり（割引サービス）\n・全席禁煙（テラス席で喫煙可）",
      },
    ],
  },
  {
    name: "ECショップ",
    description: "オンラインショップ・通販サイト向け",
    icon: "shopping-bag",
    items: [
      {
        category: "基本情報",
        title: "ショップ概要",
        content:
          "【ここにショップ名・概要を入力】\n\n例：オーガニックコスメ専門店「ナチュラルビューティー」では、厳選されたオーガニック・自然派化粧品をお届けしています。",
      },
      {
        category: "サービス・商品",
        title: "取扱商品",
        content:
          "【ここに商品カテゴリを入力】\n\n・スキンケア\n・ヘアケア\n・ボディケア\n・メイクアップ\n・サプリメント",
      },
      {
        category: "料金",
        title: "送料・配送",
        content:
          "【配送情報を入力】\n\n・5,000円以上のご注文で送料無料\n・5,000円未満: 全国一律550円\n・通常2〜3営業日で発送\n・お届けまで発送後1〜3日",
      },
      {
        category: "よくある質問",
        title: "注文について",
        content:
          "Q: 注文後のキャンセルはできますか？\nA: 発送前であればキャンセル可能です。LINEまたはメールでお知らせください。\n\nQ: 届くまでどのくらいかかりますか？\nA: ご注文から2〜5日でお届けいたします。\n\nQ: ギフト包装はできますか？\nA: はい、無料でギフト包装を承っております。注文時にお申し付けください。",
      },
      {
        category: "よくある質問",
        title: "返品・交換",
        content:
          "Q: 返品はできますか？\nA: 商品到着後7日以内であれば返品可能です。未開封・未使用品に限ります。\n\nQ: 商品が破損していた場合は？\nA: 送料当店負担で交換いたします。お写真をLINEでお送りください。",
      },
      {
        category: "よくある質問",
        title: "支払い方法",
        content:
          "Q: 支払い方法は何がありますか？\nA: クレジットカード、コンビニ払い、銀行振込、PayPay、Amazon Payに対応しております。",
      },
      {
        category: "キャンペーン",
        title: "現在のキャンペーン",
        content: "【キャンペーン情報を入力】",
      },
      {
        category: "ポリシー",
        title: "注意事項",
        content:
          "・ポイント制度あり（100円=1ポイント）\n・LINE友だち限定クーポン配信中\n・定期購入で10%OFF",
      },
    ],
  },
  {
    name: "クリニック",
    description: "歯科・皮膚科・美容クリニックなどの医療機関向け",
    icon: "hospital",
    items: [
      {
        category: "基本情報",
        title: "クリニック概要",
        content:
          "【ここにクリニック名・概要を入力】\n\n例：みさき歯科クリニックは、一般歯科・矯正歯科・インプラントを専門とするクリニックです。",
      },
      {
        category: "サービス・商品",
        title: "診療内容",
        content:
          "【ここに診療内容を入力】\n\n・一般歯科（虫歯治療・歯周病治療）\n・矯正歯科\n・インプラント\n・ホワイトニング\n・小児歯科\n・予防歯科",
      },
      {
        category: "料金",
        title: "料金目安",
        content:
          "【料金情報を入力】\n\n・保険診療: 各種保険適用\n・ホワイトニング: ¥30,000〜\n・インプラント: ¥300,000〜/1本\n・矯正: ¥600,000〜\n※詳しくはカウンセリング時にご説明いたします",
      },
      {
        category: "営業時間・アクセス",
        title: "診療時間",
        content:
          "診療時間:\n月〜金: 9:00〜12:30 / 14:00〜18:30\n土: 9:00〜13:00\n休診日: 日曜・祝日\n住所: 【住所を入力】\n最寄り駅: 【駅名を入力】",
      },
      {
        category: "よくある質問",
        title: "予約について",
        content:
          "Q: 予約は必要ですか？\nA: 予約優先制です。LINEまたはお電話でご予約ください。\n\nQ: 急な歯の痛みの場合は？\nA: 急患対応いたします。まずはお電話でご連絡ください。\n\nQ: 初診時に必要なものは？\nA: 保険証と、お薬手帳をお持ちの方はご持参ください。",
      },
      {
        category: "よくある質問",
        title: "治療について",
        content:
          "Q: 痛くない治療はできますか？\nA: 表面麻酔や電動麻酔を使用し、痛みの少ない治療を心がけております。\n\nQ: 治療期間はどのくらいですか？\nA: 症状により異なります。初診時に治療計画をご説明いたします。",
      },
      {
        category: "キャンペーン",
        title: "現在のキャンペーン",
        content: "【キャンペーン情報を入力】",
      },
      {
        category: "ポリシー",
        title: "注意事項",
        content:
          "・予約優先制\n・キャンセルは前日までにご連絡ください\n・各種保険取り扱い\n・クレジットカード対応（自費診療のみ）\n・駐車場完備",
      },
    ],
  },
  {
    name: "不動産",
    description: "不動産仲介・賃貸・売買などの不動産業向け",
    icon: "building",
    items: [
      {
        category: "基本情報",
        title: "会社概要",
        content:
          "【ここに会社名・概要を入力】\n\n例：みさき不動産は、地域密着型の不動産会社です。賃貸・売買・管理まで幅広くサポートいたします。",
      },
      {
        category: "サービス・商品",
        title: "サービス内容",
        content:
          "【ここにサービス内容を入力】\n\n・賃貸物件仲介\n・売買物件仲介\n・物件管理\n・リフォーム相談\n・住宅ローン相談",
      },
      {
        category: "料金",
        title: "仲介手数料",
        content:
          "【料金情報を入力】\n\n・賃貸仲介手数料: 家賃1ヶ月分（税別）\n・売買仲介手数料: 物件価格の3%+6万円（税別）\n※キャンペーン割引あり",
      },
      {
        category: "営業時間・アクセス",
        title: "営業時間",
        content:
          "営業時間: 9:30〜18:30\n定休日: 毎週水曜日\n住所: 【住所を入力】\n最寄り駅: 【駅名を入力】",
      },
      {
        category: "よくある質問",
        title: "物件探しについて",
        content:
          "Q: 内見はできますか？\nA: はい、ご希望の日時をLINEでお知らせください。\n\nQ: 条件に合う物件を探してもらえますか？\nA: はい、ご希望の条件（エリア・家賃・間取りなど）をお伝えください。\n\nQ: 初期費用はどのくらいですか？\nA: 物件により異なりますが、家賃の4〜5ヶ月分が目安です。",
      },
      {
        category: "よくある質問",
        title: "契約について",
        content:
          "Q: 契約に必要な書類は？\nA: 身分証明書、印鑑、収入証明書が必要です。詳細は物件により異なります。\n\nQ: 保証人は必要ですか？\nA: 保証会社利用で保証人不要の物件もございます。",
      },
      {
        category: "キャンペーン",
        title: "現在のキャンペーン",
        content: "【キャンペーン情報を入力】",
      },
      {
        category: "ポリシー",
        title: "注意事項",
        content:
          "・物件情報は最新の情報を掲載しておりますが、成約済みの場合はご容赦ください\n・内見は予約制です\n・お気軽にLINEでお問い合わせください",
      },
    ],
  },
  {
    name: "スクール・教室",
    description: "学習塾・語学教室・習い事教室向け",
    icon: "school",
    items: [
      {
        category: "基本情報",
        title: "教室概要",
        content:
          "【ここに教室名・概要を入力】\n\n例：みさき英語教室は、子どもから大人まで楽しく英語を学べるアットホームな英会話スクールです。",
      },
      {
        category: "サービス・商品",
        title: "コース一覧",
        content:
          "【ここにコース内容を入力】\n\n・キッズクラス（4〜6歳）\n・小学生クラス\n・中高生クラス\n・一般英会話クラス\n・ビジネス英語クラス\n・TOEIC対策クラス",
      },
      {
        category: "料金",
        title: "料金体系",
        content:
          "【料金情報を入力】\n\n入会金: ¥10,000\n教材費: ¥5,000〜/年\n\n■ 月謝\nキッズクラス: ¥8,000/月（週1回）\n小学生クラス: ¥9,000/月（週1回）\n一般英会話: ¥12,000/月（週1回）\nビジネス英語: ¥15,000/月（週1回）",
      },
      {
        category: "営業時間・アクセス",
        title: "レッスンスケジュール",
        content:
          "レッスン時間:\n平日: 15:00〜21:00\n土曜: 10:00〜18:00\n休校日: 日曜・祝日\n住所: 【住所を入力】\n最寄り駅: 【駅名を入力】",
      },
      {
        category: "よくある質問",
        title: "入会について",
        content:
          "Q: 体験レッスンはありますか？\nA: はい、無料体験レッスンを随時受け付けております。LINEでお申し込みください。\n\nQ: 途中入会はできますか？\nA: はい、いつからでも始められます。\n\nQ: レベルチェックはありますか？\nA: 体験レッスン時にレベルチェックを行い、最適なクラスをご案内します。",
      },
      {
        category: "よくある質問",
        title: "レッスンについて",
        content:
          "Q: 振替レッスンはできますか？\nA: はい、月2回まで振替可能です。前日までにご連絡ください。\n\nQ: 休会はできますか？\nA: 最大3ヶ月まで休会可能です（月額1,000円の休会費）。",
      },
      {
        category: "キャンペーン",
        title: "現在のキャンペーン",
        content: "【キャンペーン情報を入力】",
      },
      {
        category: "ポリシー",
        title: "注意事項",
        content:
          "・月謝は毎月27日に口座振替\n・退会は1ヶ月前までにお申し出ください\n・教室内での飲食は禁止です\n・お友達紹介で入会金無料",
      },
    ],
  },
];

function getTemplateIcon(icon: string) {
  switch (icon) {
    case "scissors":
      return (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
        </svg>
      );
    case "utensils":
      return (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "shopping-bag":
      return (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      );
    case "hospital":
      return (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      );
    case "building":
      return (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
        </svg>
      );
    case "school":
      return (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
        </svg>
      );
    default:
      return (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      );
  }
}

export default function KnowledgeTemplatesPage() {
  const [selectedTemplate, setSelectedTemplate] =
    useState<BusinessTemplate | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  async function handleImport(template: BusinessTemplate) {
    if (
      !confirm(
        `「${template.name}」テンプレートの${template.items.length}件のナレッジを一括登録しますか？`
      )
    )
      return;

    setImporting(true);
    setImportMessage("");

    const now = new Date().toISOString();
    const rows = template.items.map((item, index) => ({
      channel_id: CHANNEL_ID,
      category: item.category,
      title: item.title,
      content: item.content,
      priority: template.items.length - index,
      is_active: true,
      created_at: now,
      updated_at: now,
    }));

    const { error } = await supabase.from("knowledge_base").insert(rows);

    if (error) {
      setImportMessage("登録に失敗しました: " + error.message);
    } else {
      setImportMessage(
        `${template.items.length}件のナレッジを登録しました`
      );
    }
    setImporting(false);
    setTimeout(() => setImportMessage(""), 5000);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          テンプレートから一括登録
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          業種別のテンプレートから、ナレッジベースを素早く構築できます。登録後に内容を編集してご利用ください。
        </p>
      </div>

      {importMessage && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            importMessage.includes("失敗")
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          {importMessage}
        </div>
      )}

      {/* Template grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((template) => (
          <button
            key={template.name}
            onClick={() =>
              setSelectedTemplate(
                selectedTemplate?.name === template.name ? null : template
              )
            }
            className={`rounded-xl border p-6 text-left transition-all hover:shadow-md ${
              selectedTemplate?.name === template.name
                ? "border-[#06C755] bg-green-50 shadow-md"
                : "border-gray-200 bg-white"
            }`}
          >
            <div className="mb-3 text-[#06C755]">
              {getTemplateIcon(template.icon)}
            </div>
            <h3 className="text-lg font-bold text-gray-900">
              {template.name}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {template.description}
            </p>
            <p className="mt-2 text-xs text-gray-400">
              {template.items.length}件のナレッジ
            </p>
          </button>
        ))}
      </div>

      {/* Selected template detail */}
      {selectedTemplate && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {selectedTemplate.name} テンプレート内容
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {selectedTemplate.items.length}
                件のナレッジが登録されます
              </p>
            </div>
            <button
              onClick={() => handleImport(selectedTemplate)}
              disabled={importing}
              className="flex items-center gap-2 rounded-lg bg-[#06C755] px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#05b34c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  登録中...
                </>
              ) : (
                "一括登録"
              )}
            </button>
          </div>

          <div className="space-y-3">
            {selectedTemplate.items.map((item, index) => (
              <div
                key={index}
                className="rounded-lg border border-gray-100 bg-gray-50 p-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="inline-block rounded-full bg-[#06C755]/10 px-2.5 py-0.5 text-xs font-medium text-[#06C755]">
                    {item.category}
                  </span>
                  <span className="font-bold text-sm text-gray-900">
                    {item.title}
                  </span>
                </div>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {item.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
