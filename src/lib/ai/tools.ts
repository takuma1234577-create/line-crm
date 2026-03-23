export const crmTools = [
  {
    name: "search_friends",
    description: "友だちを検索する。名前、タグ、ステータスで絞り込み可能。",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "名前で検索" },
        tag_names: { type: "array", items: { type: "string" }, description: "タグ名で絞り込み" },
        status: { type: "string", enum: ["active", "blocked", "unfollowed"], description: "ステータスで絞り込み" },
        limit: { type: "number", description: "取得件数（デフォルト20）" }
      },
      required: []
    }
  },
  {
    name: "get_friend_count",
    description: "友だちの数を取得する。ステータス別のカウントも可能。",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["active", "blocked", "unfollowed", "all"] },
        since: { type: "string", description: "この日以降に追加された友だち (ISO 8601)" }
      },
      required: []
    }
  },
  {
    name: "send_message_to_friends",
    description: "特定の友だちにメッセージを送信する。",
    input_schema: {
      type: "object" as const,
      properties: {
        friend_ids: { type: "array", items: { type: "string" }, description: "送信先の友だちID" },
        message: { type: "string", description: "送信するテキストメッセージ" }
      },
      required: ["friend_ids", "message"]
    }
  },
  {
    name: "send_message_by_tag",
    description: "特定のタグが付いた友だち全員にメッセージを送信する。",
    input_schema: {
      type: "object" as const,
      properties: {
        tag_name: { type: "string", description: "タグ名" },
        message: { type: "string", description: "送信するテキストメッセージ" }
      },
      required: ["tag_name", "message"]
    }
  },
  {
    name: "broadcast_message",
    description: "全友だちにメッセージを一斉送信する。",
    input_schema: {
      type: "object" as const,
      properties: {
        message: { type: "string", description: "送信するテキストメッセージ" }
      },
      required: ["message"]
    }
  },
  {
    name: "manage_tags",
    description: "タグの作成、削除、友だちへのタグ付け・解除を行う。",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["create", "delete", "assign", "unassign"], description: "操作" },
        tag_name: { type: "string", description: "タグ名" },
        color: { type: "string", description: "タグの色（create時）" },
        friend_ids: { type: "array", items: { type: "string" }, description: "対象の友だちID（assign/unassign時）" }
      },
      required: ["action", "tag_name"]
    }
  },
  {
    name: "list_tags",
    description: "全タグ一覧を取得する。",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: []
    }
  },
  {
    name: "create_reminder",
    description: "リマインダーを作成する。",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "リマインダー名" },
        message: { type: "string", description: "送信メッセージ" },
        send_at: { type: "string", description: "送信日時 (ISO 8601)" },
        target_type: { type: "string", enum: ["all", "tag", "friends"], description: "送信先タイプ" },
        tag_name: { type: "string", description: "タグ名（target_type=tag時）" },
        friend_ids: { type: "array", items: { type: "string" }, description: "友だちID（target_type=friends時）" }
      },
      required: ["name", "message", "send_at", "target_type"]
    }
  },
  {
    name: "get_analytics",
    description: "分析データを取得する。友だち追加数、メッセージ数、配信数など。",
    input_schema: {
      type: "object" as const,
      properties: {
        metric: { type: "string", enum: ["friend_growth", "messages_sent", "messages_received", "broadcasts_sent", "url_clicks"], description: "取得する指標" },
        period: { type: "string", enum: ["today", "week", "month", "year"], description: "期間" }
      },
      required: ["metric"]
    }
  },
  {
    name: "create_auto_response",
    description: "自動応答ルールを作成する。",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "ルール名" },
        match_type: { type: "string", enum: ["exact", "contains", "starts_with", "regex"], description: "マッチタイプ" },
        keywords: { type: "array", items: { type: "string" }, description: "キーワード" },
        response_message: { type: "string", description: "応答メッセージ" }
      },
      required: ["name", "match_type", "keywords", "response_message"]
    }
  }
]
