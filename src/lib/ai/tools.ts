export const crmTools: any[] = [
  // ===== メッセージ管理 =====
  {
    name: "get_todays_messages",
    description: "今日受信したメッセージの一覧を取得する。未返信のものだけフィルターも可能。",
    input_schema: {
      type: "object",
      properties: {
        unread_only: { type: "boolean", description: "未返信のみ取得" },
        limit: { type: "number", description: "取得件数" }
      }
    }
  },
  {
    name: "get_conversation",
    description: "特定の友だちとの会話履歴を取得する。",
    input_schema: {
      type: "object",
      properties: {
        friend_name: { type: "string", description: "友だちの名前" },
        friend_id: { type: "string", description: "友だちID" },
        limit: { type: "number", description: "取得件数（デフォルト20）" }
      }
    }
  },
  {
    name: "reply_to_friend",
    description: "特定の友だちにメッセージを返信する。",
    input_schema: {
      type: "object",
      properties: {
        friend_id: { type: "string", description: "友だちID" },
        friend_name: { type: "string", description: "友だちの名前（IDがない場合）" },
        message: { type: "string", description: "返信メッセージ" }
      },
      required: ["message"]
    }
  },
  {
    name: "bulk_reply",
    description: "複数の友だちに一括でメッセージを返信する。各友だちに個別のメッセージを送れる。",
    input_schema: {
      type: "object",
      properties: {
        replies: {
          type: "array",
          items: {
            type: "object",
            properties: {
              friend_id: { type: "string" },
              message: { type: "string" }
            },
            required: ["friend_id", "message"]
          },
          description: "返信リスト"
        }
      },
      required: ["replies"]
    }
  },
  {
    name: "broadcast_message",
    description: "全友だちまたは特定タグの友だちに一斉送信する。",
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "送信メッセージ" },
        tag_name: { type: "string", description: "タグ名（指定しない場合は全員）" }
      },
      required: ["message"]
    }
  },

  // ===== 友だち管理 =====
  {
    name: "search_friends",
    description: "友だちを検索する。名前、タグ、ステータスで絞り込み。",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "名前で検索" },
        tag_name: { type: "string", description: "タグで絞り込み" },
        status: { type: "string", enum: ["active", "blocked", "unfollowed"] },
        limit: { type: "number" }
      }
    }
  },
  {
    name: "get_friend_count",
    description: "友だち数を取得する。",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["active", "blocked", "unfollowed", "all"] },
        since: { type: "string", description: "指定日以降の追加数（ISO 8601）" }
      }
    }
  },

  // ===== タグ管理 =====
  {
    name: "manage_tags",
    description: "タグの作成・削除・友だちへの付与・解除。",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["create", "delete", "assign", "unassign", "list"] },
        tag_name: { type: "string" },
        color: { type: "string" },
        friend_ids: { type: "array", items: { type: "string" } },
        friend_name: { type: "string", description: "友だち名で指定（IDがない場合）" }
      },
      required: ["action"]
    }
  },

  // ===== ステップ配信 =====
  {
    name: "manage_step_sequence",
    description: "ステップ配信（自動メッセージシーケンス）の作成・編集・削除・一覧取得。",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["create", "list", "get", "update", "delete", "toggle"], description: "操作" },
        sequence_id: { type: "string", description: "シーケンスID（既存の操作時）" },
        name: { type: "string", description: "シーケンス名" },
        trigger_type: { type: "string", enum: ["follow", "tag_added", "form_submitted", "manual"], description: "トリガー" },
        is_active: { type: "boolean" },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              delay_minutes: { type: "number", description: "前ステップからの待機時間（分）" },
              message: { type: "string", description: "送信メッセージ" }
            }
          },
          description: "ステップ一覧（create/update時）"
        }
      },
      required: ["action"]
    }
  },

  // ===== 自動応答 =====
  {
    name: "manage_auto_response",
    description: "キーワード自動応答ルールの作成・編集・削除・一覧取得。",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["create", "list", "update", "delete", "toggle"] },
        rule_id: { type: "string" },
        name: { type: "string", description: "ルール名" },
        match_type: { type: "string", enum: ["exact", "contains", "starts_with", "regex"] },
        keywords: { type: "array", items: { type: "string" } },
        response_message: { type: "string", description: "応答メッセージ" },
        is_active: { type: "boolean" }
      },
      required: ["action"]
    }
  },

  // ===== リッチメニュー =====
  {
    name: "manage_rich_menu",
    description: "リッチメニューの作成・編集・削除・一覧取得。タップ領域とアクションを設定できる。",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["create", "list", "get", "update", "delete", "set_default"] },
        menu_id: { type: "string" },
        name: { type: "string" },
        chat_bar_text: { type: "string", description: "チャットバーのテキスト" },
        areas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              x: { type: "number" }, y: { type: "number" },
              width: { type: "number" }, height: { type: "number" },
              action_type: { type: "string", enum: ["uri", "message", "postback"] },
              action_value: { type: "string" },
              label: { type: "string" }
            }
          },
          description: "タップ領域"
        },
        is_default: { type: "boolean" }
      },
      required: ["action"]
    }
  },

  // ===== テンプレート =====
  {
    name: "manage_template",
    description: "メッセージテンプレートの作成・一覧取得・削除。",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["create", "list", "delete"] },
        template_id: { type: "string" },
        name: { type: "string" },
        type: { type: "string", enum: ["text", "image", "flex"] },
        content: { type: "string", description: "テンプレート内容（テキストの場合はそのまま文字列）" }
      },
      required: ["action"]
    }
  },

  // ===== フォーム =====
  {
    name: "manage_form",
    description: "フォームの作成・一覧取得・削除。",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["create", "list", "delete", "get_submissions"] },
        form_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        fields: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["text", "textarea", "select", "radio", "checkbox", "date", "email"] },
              label: { type: "string" },
              required: { type: "boolean" },
              options: { type: "array", items: { type: "string" } }
            }
          }
        }
      },
      required: ["action"]
    }
  },

  // ===== 予約管理 =====
  {
    name: "manage_reservation",
    description: "予約スロットの作成・一覧・予約確認。",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["create_slot", "list_slots", "list_reservations", "cancel"] },
        slot_id: { type: "string" },
        reservation_id: { type: "string" },
        title: { type: "string" },
        date: { type: "string", description: "日付 (YYYY-MM-DD)" },
        start_time: { type: "string", description: "開始時刻 (HH:MM)" },
        end_time: { type: "string", description: "終了時刻 (HH:MM)" },
        capacity: { type: "number" }
      },
      required: ["action"]
    }
  },

  // ===== リマインダー =====
  {
    name: "create_reminder",
    description: "リマインダーを作成する。",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        message: { type: "string" },
        send_at: { type: "string", description: "送信日時 (ISO 8601)" },
        target_type: { type: "string", enum: ["all", "tag", "friends"] },
        tag_name: { type: "string" },
        friend_ids: { type: "array", items: { type: "string" } }
      },
      required: ["name", "message", "send_at", "target_type"]
    }
  },

  // ===== 分析 =====
  {
    name: "get_analytics",
    description: "分析データを取得する。",
    input_schema: {
      type: "object",
      properties: {
        metric: { type: "string", enum: ["friend_growth", "messages_sent", "messages_received", "broadcasts_sent", "url_clicks", "ai_replies", "summary"] },
        period: { type: "string", enum: ["today", "week", "month", "year"] }
      },
      required: ["metric"]
    }
  },

  // ===== AI設定 =====
  {
    name: "manage_ai_settings",
    description: "AI自動返信の設定を変更する。ON/OFF切り替え、ペルソナ変更など。",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["get", "update"] },
        auto_reply_enabled: { type: "boolean" },
        persona_name: { type: "string" },
        persona_description: { type: "string" },
        tone: { type: "string", enum: ["polite", "casual", "business", "friendly"] },
        system_instructions: { type: "string" }
      },
      required: ["action"]
    }
  },

  // ===== ナレッジベース =====
  {
    name: "manage_knowledge",
    description: "ナレッジベースの追加・一覧・編集・削除。",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["add", "list", "update", "delete"] },
        knowledge_id: { type: "string" },
        category: { type: "string" },
        title: { type: "string" },
        content: { type: "string" }
      },
      required: ["action"]
    }
  },

  // ===== EC連携 =====
  {
    name: "ec_get_orders",
    description: "EC注文一覧を取得する。ステータスやプラットフォームでフィルター可能。特定の顧客の注文も検索可能。",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "confirmed", "shipped", "delivered", "cancelled", "returned"] },
        platform: { type: "string", enum: ["amazon", "shopify"] },
        friend_name: { type: "string", description: "顧客名で検索" },
        friend_id: { type: "string" },
        limit: { type: "number" },
        period: { type: "string", enum: ["today", "week", "month"] }
      }
    }
  },
  {
    name: "ec_get_order_detail",
    description: "特定の注文の詳細（商品、配送状況、フォローアップ状況）を取得する。",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "string" },
        external_order_id: { type: "string" }
      }
    }
  },
  {
    name: "ec_get_customer_profile",
    description: "LINE友だちのEC購買プロフィール（購入履歴、合計金額、顧客ランク）を取得する。",
    input_schema: {
      type: "object",
      properties: {
        friend_id: { type: "string" },
        friend_name: { type: "string" }
      }
    }
  },
  {
    name: "ec_link_customer",
    description: "LINE友だちとEC顧客を紐付ける。メールアドレスまたは電話番号で紐付け。",
    input_schema: {
      type: "object",
      properties: {
        friend_id: { type: "string" },
        friend_name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" }
      },
      required: ["email"]
    }
  },
  {
    name: "ec_send_shipping_notification",
    description: "配送通知をLINEで送信する。追跡番号を含む。",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "string" },
        tracking_number: { type: "string" },
        carrier: { type: "string" },
        custom_message: { type: "string" }
      },
      required: ["order_id"]
    }
  },
  {
    name: "ec_manage_followup",
    description: "ECフォローアップジョブの確認・作成・キャンセル。商品フォローアップ、レビュー依頼、リピート提案など。",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list_pending", "create", "cancel", "send_now"] },
        job_id: { type: "string" },
        order_id: { type: "string" },
        friend_id: { type: "string" },
        job_type: { type: "string", enum: ["delivery_followup", "product_followup", "review_request", "repeat_suggestion"] },
        message: { type: "string" },
        scheduled_at: { type: "string" }
      },
      required: ["action"]
    }
  },
  {
    name: "ec_sync_orders",
    description: "ECストアから最新の注文データを同期する。",
    input_schema: {
      type: "object",
      properties: {
        store_id: { type: "string" },
        platform: { type: "string", enum: ["amazon", "shopify"] }
      }
    }
  },
  {
    name: "ec_get_stats",
    description: "EC関連の統計データを取得する。売上、注文数、顧客ランク分布など。",
    input_schema: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["today", "week", "month", "year"] }
      }
    }
  },

  // ===== Shopify商品・ページ取得 =====
  {
    name: "ec_get_products",
    description: "Shopifyストアの商品一覧を取得する。商品名、URL、画像URL、価格、説明を含む。リッチメニューのURL設定などに使う。",
    input_schema: {
      type: "object",
      properties: {
        store_id: { type: "string", description: "ストアID（省略時は最初のShopifyストア）" },
        query: { type: "string", description: "商品名で検索" },
        limit: { type: "number", description: "取得件数（デフォルト20）" }
      }
    }
  },
  {
    name: "ec_get_store_pages",
    description: "Shopifyストアの主要ページURL一覧を取得する。ホーム、コレクション、カート、お問い合わせなど。",
    input_schema: {
      type: "object",
      properties: {
        store_id: { type: "string", description: "ストアID（省略時は最初のShopifyストア）" }
      }
    }
  }
]
