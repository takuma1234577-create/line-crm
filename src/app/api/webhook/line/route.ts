import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { messagingApi } from '@line/bot-sdk'

let _supabase: SupabaseClient | null = null
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
  return _supabase
}

let _lineClient: messagingApi.MessagingApiClient | null = null
function getLineClient() {
  if (!_lineClient) {
    _lineClient = new messagingApi.MessagingApiClient({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
    })
  }
  return _lineClient
}

// ---------------------------------------------------------------------------
// LINE message sanitizer: LINE APIは空文字の title/text を受け付けないため補完
// ---------------------------------------------------------------------------
function sanitizeLineMessages(messages: unknown[]): unknown[] {
  return messages.map(m => sanitizeMessage(m))
}

function sanitizeMessage(m: unknown): unknown {
  if (!m || typeof m !== 'object') return m
  const msg = m as Record<string, unknown>
  if (msg.type === 'template' && msg.template && typeof msg.template === 'object') {
    const tmpl = msg.template as Record<string, unknown>
    if (tmpl.type === 'carousel' && Array.isArray(tmpl.columns)) {
      tmpl.columns = tmpl.columns.map((c: unknown) => sanitizeCarouselColumn(c))
    } else if (tmpl.type === 'buttons') {
      if (!tmpl.text || String(tmpl.text).trim() === '') tmpl.text = ' '
      if (typeof tmpl.title === 'string' && tmpl.title.trim() === '') delete tmpl.title
      if (typeof tmpl.thumbnailImageUrl === 'string' && !tmpl.thumbnailImageUrl) delete tmpl.thumbnailImageUrl
    }
    if (!msg.altText || String(msg.altText).trim() === '') msg.altText = 'メッセージ'
  }
  return msg
}

function sanitizeCarouselColumn(c: unknown): unknown {
  if (!c || typeof c !== 'object') return c
  const col = c as Record<string, unknown>
  // text は必須・空文字不可
  if (!col.text || String(col.text).trim() === '') {
    // タイトルがあればフォールバックに使う、なければスペース
    col.text = (typeof col.title === 'string' && col.title) ? col.title : ' '
  }
  // title は任意。空文字の場合はプロパティごと削除（LINEは空文字を拒否）
  if (typeof col.title === 'string' && col.title.trim() === '') delete col.title
  // thumbnailImageUrl は任意。空文字なら削除
  if (typeof col.thumbnailImageUrl === 'string' && col.thumbnailImageUrl.trim() === '') delete col.thumbnailImageUrl
  // defaultAction 等も空文字なら削除
  if (typeof col.defaultAction === 'object' && col.defaultAction === null) delete col.defaultAction
  return col
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

function verifySignature(body: string, signature: string): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET!
  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(body)
    .digest('base64')
  // Compare as strings since timingSafeEqual requires equal-length buffers
  const hashBuf = Buffer.from(hash)
  const sigBuf = Buffer.from(signature)
  if (hashBuf.length !== sigBuf.length) return false
  return crypto.timingSafeEqual(hashBuf, sigBuf)
}

// ---------------------------------------------------------------------------
// Helper: resolve channel_id from the destination (bot user ID)
// ---------------------------------------------------------------------------

async function resolveChannelId(destination: string): Promise<string | null> {
  const { data } = await getSupabase()
    .from('line_channels')
    .select('id')
    .eq('bot_user_id', destination)
    .single()
  return data?.id ?? null
}

// ---------------------------------------------------------------------------
// Helper: get or create friend record
// ---------------------------------------------------------------------------

async function upsertFriend(
  channelId: string,
  lineUserId: string,
  profile: { displayName: string; pictureUrl?: string }
) {
  const { data, error } = await getSupabase()
    .from('friends')
    .upsert(
      {
        channel_id: channelId,
        line_user_id: lineUserId,
        display_name: profile.displayName,
        picture_url: profile.pictureUrl ?? null,
        status: 'active',
        followed_at: new Date().toISOString(),
      },
      { onConflict: 'channel_id,line_user_id' }
    )
    .select()
    .single()

  if (error) {
    console.error('[upsertFriend] error:', error)
    return null
  }
  return data
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleFollow(event: any, channelId: string) {
  const lineUserId: string = event.source.userId
  if (!lineUserId) return

  // Fetch profile from LINE
  let profile: { displayName: string; pictureUrl?: string }
  try {
    profile = await getLineClient().getProfile(lineUserId)
  } catch (err) {
    console.error('[handleFollow] getProfile failed:', err)
    profile = { displayName: 'Unknown' }
  }

  const friend = await upsertFriend(channelId, lineUserId, profile)
  if (!friend) return

  // 挨拶メッセージを送信
  try {
    const { data: ch } = await getSupabase()
      .from('line_channels')
      .select('greeting_template_id, greeting_enabled')
      .eq('id', channelId)
      .single()
    if (ch?.greeting_enabled && ch.greeting_template_id) {
      const { data: tmpl } = await getSupabase()
        .from('message_templates')
        .select('content')
        .eq('id', ch.greeting_template_id)
        .single()
      const rawMessages = Array.isArray(tmpl?.content?.messages) ? tmpl.content.messages : []
      const messages = sanitizeLineMessages(rawMessages) as messagingApi.Message[]
      if (messages.length > 0 && event.replyToken) {
        try {
          await getLineClient().replyMessage({ replyToken: event.replyToken, messages })
          await getSupabase().from('chat_messages').insert({
            channel_id: channelId,
            friend_id: friend.id,
            direction: 'outbound',
            message_type: 'text',
            content: { source: 'greeting', template_id: ch.greeting_template_id, messages },
          })
        } catch (replyErr) {
          console.error('[handleFollow] greeting send error:', JSON.stringify((replyErr as { originalError?: { response?: { data?: unknown } } })?.originalError?.response?.data ?? replyErr))
        }
      }
    }
  } catch (err) {
    console.error('[handleFollow] greeting error:', err)
  }

  // Enroll in active follow-triggered step sequences
  try {
    const { data: sequences } = await getSupabase()
      .from('step_sequences')
      .select('id')
      .eq('trigger_type', 'follow')
      .eq('is_active', true)

    if (sequences && sequences.length > 0) {
      const enrollments = sequences.map((seq: any) => ({
        sequence_id: seq.id,
        friend_id: friend.id,
        status: 'active',
        current_step: 0,
        enrolled_at: new Date().toISOString(),
      }))

      const { error } = await getSupabase()
        .from('step_enrollments')
        .upsert(enrollments, { onConflict: 'sequence_id,friend_id' })

      if (error) {
        console.error('[handleFollow] enroll error:', error)
      }
    }
  } catch (err) {
    console.error('[handleFollow] sequence enrollment failed:', err)
  }
}

async function handleUnfollow(event: any, channelId: string) {
  const lineUserId: string = event.source.userId
  if (!lineUserId) return

  const { error } = await getSupabase()
    .from('friends')
    .update({
      status: 'unfollowed',
      unfollowed_at: new Date().toISOString(),
    })
    .eq('channel_id', channelId)
    .eq('line_user_id', lineUserId)

  if (error) {
    console.error('[handleUnfollow] error:', error)
  }
}

async function handleMessage(event: any, channelId: string) {
  const lineUserId: string = event.source.userId
  if (!lineUserId) return

  // Resolve or create friend
  let { data: friend } = await getSupabase()
    .from('friends')
    .select('id')
    .eq('channel_id', channelId)
    .eq('line_user_id', lineUserId)
    .single()

  if (!friend) {
    // Auto-create friend record for existing followers not yet in DB
    let profile: { displayName: string; pictureUrl?: string }
    try {
      profile = await getLineClient().getProfile(lineUserId)
    } catch {
      profile = { displayName: 'Unknown' }
    }
    friend = await upsertFriend(channelId, lineUserId, profile)
    if (!friend) {
      console.error('[handleMessage] could not create friend for', lineUserId)
      return
    }
  }

  const message = event.message
  const messageText = message?.text ?? ''

  // Store inbound message
  const { error: insertError } = await getSupabase().from('chat_messages').insert({
    channel_id: channelId,
    friend_id: friend.id,
    direction: 'inbound',
    message_type: message?.type ?? 'text',
    content: { text: messageText },
    line_message_id: message?.id ?? null,
    created_at: new Date(event.timestamp).toISOString(),
  })

  if (insertError) {
    console.error('[handleMessage] insert error:', insertError)
  }

  // Only run auto-response matching for text messages
  if (message?.type !== 'text' || !messageText) return

  // キーワード一致の自動応答を先に試す
  const matched = await matchAutoResponse(channelId, messageText, event.replyToken, lineUserId)

  // キーワード一致しなかった場合、AI自動返信を実行
  if (!matched) {
    try {
      const { shouldAutoReply, generateAutoReply } = await import('@/lib/ai/auto-reply')
      const aiSettings = await shouldAutoReply(channelId)
      if (aiSettings) {
        // friend の display_name を取得
        const { data: friendData } = await getSupabase()
          .from('friends')
          .select('display_name')
          .eq('id', friend.id)
          .single()
        const friendName = friendData?.display_name || 'お客様'

        const result = await generateAutoReply(
          channelId,
          friend.id,
          friendName,
          messageText,
          aiSettings,
        )

        if (!result.wasEscalated && result.reply) {
          // テストアカウント(Takuma)はリアルタイム送信、それ以外は10分後に送信
          const isTestAccount = lineUserId === 'U777ec9eb252750ad0720288e388f7d9e'

          if (isTestAccount) {
            await getLineClient().pushMessage({
              to: lineUserId,
              messages: [{ type: 'text', text: result.reply }],
            })
            await getSupabase().from('chat_messages').insert({
              channel_id: channelId,
              friend_id: friend.id,
              direction: 'outbound',
              message_type: 'text',
              content: { text: result.reply, source: 'ai_auto_reply' },
            })
          } else {
            // 10分後に送信するキューに追加
            await getSupabase().from('pending_ai_replies').insert({
              channel_id: channelId,
              friend_id: friend.id,
              line_user_id: lineUserId,
              reply_text: result.reply,
              send_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            })
          }
        }
      }
    } catch (err) {
      console.error('[handleMessage] AI auto-reply error:', err)
    }
  }
}

async function matchAutoResponse(
  channelId: string,
  messageText: string,
  replyToken: string,
  lineUserId: string,
): Promise<boolean> {
  const { data: autoResponses } = await getSupabase()
    .from('auto_responses')
    .select('*')
    .eq('channel_id', channelId)
    .eq('is_active', true)
    .order('priority', { ascending: true })

  if (!autoResponses || autoResponses.length === 0) return false

  for (const rule of autoResponses) {
    const keywords: string[] = rule.keywords ?? []
    const matchType: string = rule.match_type ?? 'exact'
    let matched = false

    for (const keyword of keywords) {
      switch (matchType) {
        case 'exact':
          matched = messageText === keyword
          break
        case 'contains':
          matched = messageText.includes(keyword)
          break
        case 'starts_with':
          matched = messageText.startsWith(keyword)
          break
        case 'regex':
          try {
            const re = new RegExp(keyword)
            matched = re.test(messageText)
          } catch {
            console.warn('[matchAutoResponse] invalid regex:', keyword)
          }
          break
        default:
          break
      }
      if (matched) break
    }

    if (matched) {
      try {
        const rawMessages = Array.isArray(rule.response_messages)
          ? rule.response_messages
          : [{ type: 'text', text: String(rule.response_messages) }]
        const messages = sanitizeLineMessages(rawMessages) as messagingApi.Message[]

        // まず replyMessage を試し、失敗したら pushMessage にフォールバック
        let sent = false
        try {
          await getLineClient().replyMessage({ replyToken, messages })
          sent = true
        } catch (replyErr) {
          console.warn('[matchAutoResponse] replyMessage failed, falling back to pushMessage')
        }

        if (!sent) {
          try {
            await getLineClient().pushMessage({ to: lineUserId, messages })
            sent = true
          } catch (pushErr) {
            console.error('[matchAutoResponse] pushMessage also failed:', pushErr)
          }
        }

        // 自動応答の送信内容をchat_messagesに記録（AIが二重返信しないように）
        if (sent) {
          const { data: friend } = await getSupabase()
            .from('friends')
            .select('id')
            .eq('channel_id', channelId)
            .eq('line_user_id', lineUserId)
            .maybeSingle()
          if (friend) {
            await getSupabase().from('chat_messages').insert({
              channel_id: channelId,
              friend_id: friend.id,
              direction: 'outbound',
              message_type: 'text',
              content: { messages: rawMessages, source: 'auto_response', auto_response_id: rule.id },
            })
          }
        }
      } catch (err) {
        console.error('[matchAutoResponse] reply failed:', err)
      }
      return true
    }
  }

  return false
}

async function handlePostback(event: any, channelId: string) {
  const lineUserId: string = event.source.userId
  if (!lineUserId) return

  const postbackData: string = event.postback?.data ?? ''

  // Parse key=value pairs from postback data
  const params = new URLSearchParams(postbackData)
  const action = params.get('action')

  // Resolve friend
  const { data: friend } = await getSupabase()
    .from('friends')
    .select('id')
    .eq('channel_id', channelId)
    .eq('line_user_id', lineUserId)
    .single()

  // Store postback event for auditing / admin visibility
  await getSupabase().from('chat_messages').insert({
    channel_id: channelId,
    friend_id: friend?.id ?? null,
    direction: 'inbound',
    message_type: 'postback',
    content: { data: postbackData },
    created_at: new Date(event.timestamp).toISOString(),
  })

  // Handle specific postback actions
  switch (action) {
    case 'form_submit': {
      // Example: action=form_submit&form_id=xxx&field1=value1
      const formId = params.get('form_id')
      if (formId && friend) {
        const fieldEntries: Record<string, string> = {}
        params.forEach((value, key) => {
          if (key !== 'action' && key !== 'form_id') {
            fieldEntries[key] = value
          }
        })
        await getSupabase().from('form_submissions').insert({
          form_id: formId,
          friend_id: friend.id,
          answers: fieldEntries,
        })
      }
      break
    }
    case 'send_template': {
      // テンプレート送信ボタン: action=send_template&template_id=<id>
      const templateId = params.get('template_id')
      if (templateId && event.replyToken) {
        try {
          const { data: tmpl } = await getSupabase()
            .from('message_templates')
            .select('content')
            .eq('id', templateId)
            .single()
          const rawMessages = Array.isArray(tmpl?.content?.messages) ? tmpl.content.messages : []
          const messages = sanitizeLineMessages(rawMessages) as messagingApi.Message[]
          if (messages.length > 0) {
            try {
              await getLineClient().replyMessage({ replyToken: event.replyToken, messages })
            } catch (replyErr) {
              console.error('[handlePostback] LINE reply error:', JSON.stringify((replyErr as { originalError?: { response?: { data?: unknown } } })?.originalError?.response?.data ?? replyErr))
              throw replyErr
            }
            if (friend) {
              await getSupabase().from('chat_messages').insert({
                channel_id: channelId,
                friend_id: friend.id,
                direction: 'outbound',
                message_type: 'text',
                content: { source: 'template_postback', template_id: templateId, messages },
              })
            }
          }
        } catch (err) {
          console.error('[handlePostback] send_template error:', err)
        }
      }
      break
    }
    case 'richmenu': {
      // Rich menu actions can be extended here
      const menuAction = params.get('menu_action')
      console.log('[handlePostback] richmenu action:', menuAction)
      break
    }
    default:
      console.log('[handlePostback] unhandled action:', action, 'data:', postbackData)
      break
  }
}

// ---------------------------------------------------------------------------
// Flush pending AI replies (send_at を過ぎたキューを送信)
// ---------------------------------------------------------------------------

async function flushPendingReplies() {
  try {
    const now = new Date().toISOString()
    const { data: pending } = await getSupabase()
      .from('pending_ai_replies')
      .select('*')
      .is('sent_at', null)
      .lte('send_at', now)
      .order('send_at', { ascending: true })
      .limit(5)

    if (!pending || pending.length === 0) return

    for (const p of pending) {
      try {
        await getLineClient().pushMessage({
          to: p.line_user_id,
          messages: [{ type: 'text', text: p.reply_text }],
        })
        await getSupabase().from('chat_messages').insert({
          channel_id: p.channel_id,
          friend_id: p.friend_id,
          direction: 'outbound',
          message_type: 'text',
          content: { text: p.reply_text, source: 'ai_auto_reply_delayed' },
        })
        await getSupabase()
          .from('pending_ai_replies')
          .update({ sent_at: now })
          .eq('id', p.id)
      } catch (err) {
        console.error('[flushPendingReplies] send error:', err)
      }
    }
  } catch (err) {
    console.error('[flushPendingReplies] error:', err)
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 保留中のAI返信を送信（10分経過したもの）
    flushPendingReplies().catch(() => {})

    const rawBody = await request.text()
    const signature = request.headers.get('x-line-signature')

    if (!signature || !verifySignature(rawBody, signature)) {
      console.warn('[webhook] invalid signature')
      // Return 200 even on invalid signature to prevent LINE retries
      return NextResponse.json({ message: 'invalid signature' }, { status: 200 })
    }

    const body = JSON.parse(rawBody)
    const destination: string = body.destination ?? ''
    const events: any[] = body.events ?? []

    // Resolve channel_id from the destination (bot user ID)
    let channelId = await resolveChannelId(destination)

    // If channel not found by bot_user_id, try to fall back to a default channel
    if (!channelId && events.length > 0) {
      const { data } = await getSupabase()
        .from('line_channels')
        .select('id')
        .limit(1)
        .single()
      channelId = data?.id ?? null
    }

    if (!channelId) {
      console.warn('[webhook] could not resolve channel for destination:', destination)
      return NextResponse.json({ message: 'ok' }, { status: 200 })
    }

    // Process events concurrently
    await Promise.allSettled(
      events.map(async (event: any) => {
        try {
          switch (event.type) {
            case 'follow':
              await handleFollow(event, channelId!)
              break
            case 'unfollow':
              await handleUnfollow(event, channelId!)
              break
            case 'message':
              await handleMessage(event, channelId!)
              break
            case 'postback':
              await handlePostback(event, channelId!)
              break
            default:
              console.log('[webhook] unhandled event type:', event.type)
              break
          }
        } catch (err) {
          console.error(`[webhook] error processing ${event.type} event:`, err)
        }
      })
    )

    return NextResponse.json({ message: 'ok' }, { status: 200 })
  } catch (err) {
    console.error('[webhook] unexpected error:', err)
    // Always return 200 to LINE to prevent retries
    return NextResponse.json({ message: 'ok' }, { status: 200 })
  }
}
