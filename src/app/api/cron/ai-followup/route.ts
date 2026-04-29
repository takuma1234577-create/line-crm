/**
 * AI Follow-up Cron
 *
 * 顧客から1時間以上前にメッセージが届いており、
 * そのあと誰からも（スタッフ・AI・自動応答含め）返信されていない会話に対して
 * AI（ナレッジベース RAG）で返信する。
 *
 * 実行頻度: 10分ごと（vercel.json の crons で設定）
 * 認証: Bearer ${CRON_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server'
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

const FOLLOWUP_HOURS = 1
const MAX_PER_RUN = 3 // Voyage AI 無料枠 3RPM 対策

interface ChatMessage {
  id: string
  channel_id: string
  friend_id: string
  direction: 'inbound' | 'outbound'
  message_type: string
  content: { text?: string } & Record<string, unknown>
  created_at: string
}

export async function GET(request: NextRequest) {
  // 認証（Vercel cron は自動で Bearer を付けるが、手動呼び出し用にも許可）
  const authHeader = request.headers.get('authorization')
  const expectedSecret = process.env.CRON_SECRET
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 保留中のAI返信をフラッシュ
  try {
    const now = new Date().toISOString()
    const { data: pending } = await getSupabase()
      .from('pending_ai_replies')
      .select('*')
      .is('sent_at', null)
      .lte('send_at', now)
      .order('send_at', { ascending: true })
      .limit(20)

    for (const p of (pending || [])) {
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
        await getSupabase().from('pending_ai_replies').update({ sent_at: now }).eq('id', p.id)
      } catch (err) {
        console.error('[ai-followup] flush pending error:', err)
      }
    }
  } catch (err) {
    console.error('[ai-followup] flush pending failed:', err)
  }

  const cutoffIso = new Date(Date.now() - FOLLOWUP_HOURS * 60 * 60 * 1000).toISOString()
  const lookbackIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  try {
    // 直近7日の会話メッセージを新しい順で取得
    const { data: msgs, error: msgErr } = await getSupabase()
      .from('chat_messages')
      .select('id, channel_id, friend_id, direction, message_type, content, created_at')
      .gte('created_at', lookbackIso)
      .order('created_at', { ascending: false })
      .limit(5000)

    if (msgErr) {
      console.error('[ai-followup] fetch messages error:', msgErr)
      return NextResponse.json({ error: msgErr.message }, { status: 500 })
    }

    // friend_idごとに最新メッセージを集計
    const latestByFriend = new Map<string, ChatMessage>()
    for (const m of (msgs || []) as ChatMessage[]) {
      if (!latestByFriend.has(m.friend_id)) {
        latestByFriend.set(m.friend_id, m)
      }
    }

    // 対象: 最新メッセージが inbound かつ 1h以上前
    const candidates: ChatMessage[] = []
    for (const m of latestByFriend.values()) {
      if (m.direction !== 'inbound') continue
      if (m.message_type !== 'text') continue
      if (m.created_at > cutoffIso) continue
      candidates.push(m)
    }

    if (candidates.length === 0) {
      return NextResponse.json({ message: 'no candidates', processed: 0 })
    }

    // 古い順（放置時間が長い順）で優先処理し、1回の実行は上限まで
    candidates.sort((a, b) => a.created_at.localeCompare(b.created_at))
    const toProcess = candidates.slice(0, MAX_PER_RUN)
    console.log(`[ai-followup] candidates: ${candidates.length}, processing: ${toProcess.length}`)

    const { shouldAutoReply, generateAutoReply } = await import('@/lib/ai/auto-reply')

    let sent = 0
    let skipped = 0
    let failed = 0

    // チャンネル別の ai_settings キャッシュ
    const settingsCache = new Map<string, Awaited<ReturnType<typeof shouldAutoReply>> | null>()

    const errors: string[] = []
    for (const m of toProcess) {
      try {
        if (!settingsCache.has(m.channel_id)) {
          settingsCache.set(m.channel_id, await shouldAutoReply(m.channel_id))
        }
        const aiSettings = settingsCache.get(m.channel_id)
        if (!aiSettings) { skipped++; continue }

        // friend 情報（display_name と line_user_id）
        const { data: friend } = await getSupabase()
          .from('friends')
          .select('id, display_name, line_user_id')
          .eq('id', m.friend_id)
          .single()
        if (!friend?.line_user_id) { skipped++; continue }

        const userMessage = (m.content?.text as string) || ''
        if (!userMessage) { skipped++; continue }

        const result = await generateAutoReply(
          m.channel_id,
          friend.id,
          friend.display_name || 'お客様',
          userMessage,
          aiSettings,
        )

        if (result.wasEscalated || !result.reply) { skipped++; continue }

        await getLineClient().pushMessage({
          to: friend.line_user_id,
          messages: [{ type: 'text', text: result.reply }],
        })

        await getSupabase().from('chat_messages').insert({
          channel_id: m.channel_id,
          friend_id: friend.id,
          direction: 'outbound',
          message_type: 'text',
          content: { text: result.reply, source: 'ai_followup' },
        })

        sent++
      } catch (err) {
        failed++
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${m.friend_id}: ${msg}`)
        console.error('[ai-followup] error for friend', m.friend_id, msg)
      }
    }

    return NextResponse.json({
      candidates: candidates.length,
      processing: toProcess.length,
      sent,
      skipped,
      failed,
      errors: errors.slice(0, 5),
      cutoff: cutoffIso,
    })
  } catch (err) {
    console.error('[ai-followup] unexpected error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    )
  }
}
