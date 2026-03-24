import { createClient } from '@supabase/supabase-js'
import { messagingApi } from '@line/bot-sdk'
import { sub, startOfDay, startOfWeek, startOfMonth, startOfYear } from 'date-fns'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
})

const CHANNEL_ID = '00000000-0000-0000-0000-000000000010'

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

export async function executeToolCall(
  toolName: string,
  toolInput: any,
  channelId: string
): Promise<string> {
  const cid = channelId || CHANNEL_ID

  try {
    switch (toolName) {
      case 'get_todays_messages':
        return await getTodaysMessages(cid, toolInput)
      case 'get_conversation':
        return await getConversation(cid, toolInput)
      case 'reply_to_friend':
        return await replyToFriend(cid, toolInput)
      case 'bulk_reply':
        return await bulkReply(cid, toolInput)
      case 'broadcast_message':
        return await doBroadcastMessage(cid, toolInput)
      case 'search_friends':
        return await searchFriends(cid, toolInput)
      case 'get_friend_count':
        return await getFriendCount(cid, toolInput)
      case 'manage_tags':
        return await manageTags(cid, toolInput)
      case 'manage_step_sequence':
        return await manageStepSequence(cid, toolInput)
      case 'manage_auto_response':
        return await manageAutoResponse(cid, toolInput)
      case 'manage_rich_menu':
        return await manageRichMenu(cid, toolInput)
      case 'manage_template':
        return await manageTemplate(cid, toolInput)
      case 'manage_form':
        return await manageForm(cid, toolInput)
      case 'manage_reservation':
        return await manageReservation(cid, toolInput)
      case 'create_reminder':
        return await createReminder(cid, toolInput)
      case 'get_analytics':
        return await getAnalytics(cid, toolInput)
      case 'manage_ai_settings':
        return await manageAiSettings(cid, toolInput)
      case 'manage_knowledge':
        return await manageKnowledge(cid, toolInput)
      // EC連携
      case 'ec_get_orders':
        return await ecGetOrders(cid, toolInput)
      case 'ec_get_order_detail':
        return await ecGetOrderDetail(cid, toolInput)
      case 'ec_get_customer_profile':
        return await ecGetCustomerProfile(cid, toolInput)
      case 'ec_link_customer':
        return await ecLinkCustomer(cid, toolInput)
      case 'ec_send_shipping_notification':
        return await ecSendShippingNotification(cid, toolInput)
      case 'ec_manage_followup':
        return await ecManageFollowup(cid, toolInput)
      case 'ec_sync_orders':
        return await ecSyncOrders(cid, toolInput)
      case 'ec_get_stats':
        return await ecGetStats(cid, toolInput)
      case 'ec_get_products':
        return await ecGetProducts(cid, toolInput)
      case 'ec_get_store_pages':
        return await ecGetStorePages(cid, toolInput)
      default:
        return `エラー: 不明なツール「${toolName}」`
    }
  } catch (err: any) {
    return `エラーが発生しました: ${err.message}`
  }
}

// ---------------------------------------------------------------------------
// Helper: resolve friend by name
// ---------------------------------------------------------------------------

async function resolveFriend(channelId: string, input: { friend_id?: string; friend_name?: string }): Promise<any | null> {
  if (input.friend_id) {
    const { data } = await supabase
      .from('friends')
      .select('id, display_name, line_user_id, status, picture_url')
      .eq('channel_id', channelId)
      .eq('id', input.friend_id)
      .single()
    return data
  }
  if (input.friend_name) {
    const { data } = await supabase
      .from('friends')
      .select('id, display_name, line_user_id, status, picture_url')
      .eq('channel_id', channelId)
      .ilike('display_name', `%${input.friend_name}%`)
      .limit(1)
      .single()
    return data
  }
  return null
}

// ---------------------------------------------------------------------------
// Helper: period start date
// ---------------------------------------------------------------------------

function getPeriodStart(period?: string): Date {
  const now = new Date()
  switch (period) {
    case 'today':
      return startOfDay(now)
    case 'week':
      return startOfWeek(now, { weekStartsOn: 1 })
    case 'month':
      return startOfMonth(now)
    case 'year':
      return startOfYear(now)
    default:
      return sub(now, { months: 1 })
  }
}

// ---------------------------------------------------------------------------
// get_todays_messages
// ---------------------------------------------------------------------------

async function getTodaysMessages(channelId: string, input: any): Promise<string> {
  const { unread_only, limit = 50 } = input || {}
  const todayStart = startOfDay(new Date()).toISOString()

  // Get today's inbound messages with friend info
  const { data: messages, error } = await supabase
    .from('chat_messages')
    .select('id, friend_id, content, message_type, sent_at, friends!inner(id, display_name, picture_url)')
    .eq('channel_id', channelId)
    .eq('direction', 'inbound')
    .gte('sent_at', todayStart)
    .order('sent_at', { ascending: false })
    .limit(limit)

  if (error) return `エラー: ${error.message}`
  if (!messages || messages.length === 0) return '今日のメッセージはありません。'

  // Group by friend, get latest message per friend
  const friendMap = new Map<string, { friend: any; latestMessage: any; messages: any[] }>()
  for (const msg of messages) {
    const friend = (msg as any).friends
    const fid = msg.friend_id
    if (!friendMap.has(fid)) {
      friendMap.set(fid, { friend, latestMessage: msg, messages: [msg] })
    } else {
      friendMap.get(fid)!.messages.push(msg)
    }
  }

  // Check which friends have been replied to (have outbound message after their last inbound)
  const friendIds = Array.from(friendMap.keys())
  const { data: outboundMessages } = await supabase
    .from('chat_messages')
    .select('friend_id, sent_at')
    .eq('channel_id', channelId)
    .eq('direction', 'outbound')
    .in('friend_id', friendIds)
    .gte('sent_at', todayStart)
    .order('sent_at', { ascending: false })

  const repliedFriends = new Set<string>()
  if (outboundMessages) {
    for (const out of outboundMessages) {
      const friendData = friendMap.get(out.friend_id)
      if (friendData && out.sent_at >= friendData.latestMessage.sent_at) {
        repliedFriends.add(out.friend_id)
      }
    }
  }

  // Build results
  const results: string[] = []
  let unrepliedCount = 0
  let totalCount = 0

  for (const [fid, data] of friendMap) {
    const isReplied = repliedFriends.has(fid)
    if (unread_only && isReplied) continue

    totalCount++
    if (!isReplied) unrepliedCount++

    const status = isReplied ? '✅返信済み' : '⚠️未返信'
    const name = data.friend.display_name || '名前なし'
    const msgCount = data.messages.length
    const latestContent = data.latestMessage.content || `[${data.latestMessage.message_type}]`
    const time = new Date(data.latestMessage.sent_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })

    results.push(`${status} ${name}（ID: ${fid}）\n  最新: ${latestContent}（${time}）\n  本日${msgCount}件のメッセージ`)
  }

  const header = `📨 今日のメッセージ: ${totalCount}人から受信（未返信: ${unrepliedCount}人）\n`
  return header + '\n' + results.join('\n\n')
}

// ---------------------------------------------------------------------------
// get_conversation
// ---------------------------------------------------------------------------

async function getConversation(channelId: string, input: any): Promise<string> {
  const { limit = 20 } = input
  const friend = await resolveFriend(channelId, input)
  if (!friend) return 'エラー: 友だちが見つかりませんでした。名前またはIDを確認してください。'

  const { data: messages, error } = await supabase
    .from('chat_messages')
    .select('direction, content, message_type, sent_at')
    .eq('channel_id', channelId)
    .eq('friend_id', friend.id)
    .order('sent_at', { ascending: false })
    .limit(limit)

  if (error) return `エラー: ${error.message}`
  if (!messages || messages.length === 0) return `${friend.display_name}さんとの会話履歴はありません。`

  const lines = messages.reverse().map((m: any) => {
    const dir = m.direction === 'inbound' ? `${friend.display_name}` : 'あなた'
    const content = m.content || `[${m.message_type}]`
    const time = new Date(m.sent_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    return `[${time}] ${dir}: ${content}`
  })

  return `💬 ${friend.display_name}さんとの会話（最新${messages.length}件）\n\n${lines.join('\n')}`
}

// ---------------------------------------------------------------------------
// reply_to_friend
// ---------------------------------------------------------------------------

async function replyToFriend(channelId: string, input: any): Promise<string> {
  const { message } = input
  if (!message) return 'エラー: メッセージが指定されていません。'

  const friend = await resolveFriend(channelId, input)
  if (!friend) return 'エラー: 友だちが見つかりませんでした。名前またはIDを確認してください。'
  if (!friend.line_user_id) return 'エラー: この友だちのLINEユーザーIDが不明です。'

  try {
    await lineClient.pushMessage({
      to: friend.line_user_id,
      messages: [{ type: 'text', text: message }]
    })
  } catch (err: any) {
    return `LINE送信エラー: ${err.message}`
  }

  await supabase.from('chat_messages').insert({
    channel_id: channelId,
    friend_id: friend.id,
    direction: 'outbound',
    message_type: 'text',
    content: message,
    sent_at: new Date().toISOString(),
  })

  return `${friend.display_name}さんにメッセージを送信しました。\n内容: ${message}`
}

// ---------------------------------------------------------------------------
// bulk_reply
// ---------------------------------------------------------------------------

async function bulkReply(channelId: string, input: any): Promise<string> {
  const { replies } = input
  if (!replies || replies.length === 0) return 'エラー: 返信リストが空です。'

  const results: string[] = []
  let successCount = 0
  let failCount = 0

  for (const reply of replies) {
    const { data: friend } = await supabase
      .from('friends')
      .select('id, display_name, line_user_id')
      .eq('channel_id', channelId)
      .eq('id', reply.friend_id)
      .single()

    if (!friend || !friend.line_user_id) {
      results.push(`❌ ID:${reply.friend_id} - 友だちが見つかりません`)
      failCount++
      continue
    }

    try {
      await lineClient.pushMessage({
        to: friend.line_user_id,
        messages: [{ type: 'text', text: reply.message }]
      })

      await supabase.from('chat_messages').insert({
        channel_id: channelId,
        friend_id: friend.id,
        direction: 'outbound',
        message_type: 'text',
        content: reply.message,
        sent_at: new Date().toISOString(),
      })

      results.push(`✅ ${friend.display_name}: 送信完了`)
      successCount++
    } catch (err: any) {
      results.push(`❌ ${friend.display_name}: ${err.message}`)
      failCount++
    }
  }

  return `一括返信結果: 成功${successCount}件 / 失敗${failCount}件\n\n${results.join('\n')}`
}

// ---------------------------------------------------------------------------
// broadcast_message
// ---------------------------------------------------------------------------

async function doBroadcastMessage(channelId: string, input: any): Promise<string> {
  const { message, tag_name } = input
  if (!message) return 'エラー: メッセージが指定されていません。'

  if (tag_name) {
    // Send to friends with specific tag
    const { data: tag } = await supabase
      .from('tags')
      .select('id')
      .eq('channel_id', channelId)
      .eq('name', tag_name)
      .single()

    if (!tag) return `エラー: タグ「${tag_name}」が見つかりません。`

    const { data: friendTags } = await supabase
      .from('friend_tags')
      .select('friend_id')
      .eq('tag_id', tag.id)

    if (!friendTags || friendTags.length === 0) return `タグ「${tag_name}」が付いた友だちがいません。`

    const friendIds = friendTags.map((ft: any) => ft.friend_id)
    const { data: friends } = await supabase
      .from('friends')
      .select('id, line_user_id, display_name')
      .in('id', friendIds)
      .eq('status', 'active')

    if (!friends || friends.length === 0) return 'アクティブな送信先が見つかりませんでした。'

    const lineUserIds = friends.map((f: any) => f.line_user_id).filter(Boolean)
    const messages = [{ type: 'text' as const, text: message }]

    try {
      for (let i = 0; i < lineUserIds.length; i += 500) {
        const chunk = lineUserIds.slice(i, i + 500)
        if (chunk.length === 1) {
          await lineClient.pushMessage({ to: chunk[0], messages })
        } else {
          await lineClient.multicast({ to: chunk, messages })
        }
      }
    } catch (err: any) {
      return `LINE送信エラー: ${err.message}`
    }

    // Record outbound messages
    const chatMessages = friends.map((f: any) => ({
      channel_id: channelId,
      friend_id: f.id,
      direction: 'outbound',
      message_type: 'text',
      content: message,
      sent_at: new Date().toISOString(),
    }))
    await supabase.from('chat_messages').insert(chatMessages)

    return `タグ「${tag_name}」の${friends.length}人に送信しました。\n内容: ${message}`
  }

  // Broadcast to all
  try {
    await lineClient.broadcast({
      messages: [{ type: 'text', text: message }]
    })
  } catch (err: any) {
    return `LINE一斉送信エラー: ${err.message}`
  }

  await supabase.from('broadcasts').insert({
    channel_id: channelId,
    message_type: 'text',
    content: message,
    status: 'sent',
    sent_at: new Date().toISOString(),
  })

  const { count } = await supabase
    .from('friends')
    .select('id', { count: 'exact', head: true })
    .eq('channel_id', channelId)
    .eq('status', 'active')

  return `全友だち（約${count ?? 0}人）に一斉送信しました。\n内容: ${message}`
}

// ---------------------------------------------------------------------------
// search_friends
// ---------------------------------------------------------------------------

async function searchFriends(channelId: string, input: any): Promise<string> {
  const { query, tag_name, status, limit = 20 } = input || {}

  let q = supabase
    .from('friends')
    .select('id, display_name, picture_url, status, line_user_id, followed_at, memo')
    .eq('channel_id', channelId)
    .limit(limit)

  if (query) q = q.ilike('display_name', `%${query}%`)
  if (status) q = q.eq('status', status)

  const { data: friends, error } = await q

  if (error) return `エラー: ${error.message}`
  if (!friends || friends.length === 0) return '該当する友だちが見つかりませんでした。'

  let filteredFriends = friends

  // Filter by tag if specified
  if (tag_name) {
    const { data: tag } = await supabase
      .from('tags')
      .select('id')
      .eq('channel_id', channelId)
      .eq('name', tag_name)
      .single()

    if (!tag) return `タグ「${tag_name}」が見つかりません。`

    const { data: taggedFriends } = await supabase
      .from('friend_tags')
      .select('friend_id')
      .eq('tag_id', tag.id)
      .in('friend_id', friends.map((f: any) => f.id))

    if (!taggedFriends || taggedFriends.length === 0) return `タグ「${tag_name}」の友だちが見つかりません。`

    const matchedIds = new Set(taggedFriends.map((ft: any) => ft.friend_id))
    filteredFriends = friends.filter((f: any) => matchedIds.has(f.id))
  }

  const lines = filteredFriends.map((f: any) => {
    const followDate = f.followed_at ? new Date(f.followed_at).toLocaleDateString('ja-JP') : '不明'
    const memo = f.memo ? ` メモ: ${f.memo}` : ''
    return `- ${f.display_name || '名前なし'}（ID: ${f.id}）\n  ステータス: ${f.status} / 追加日: ${followDate}${memo}`
  })

  return `友だち検索結果: ${filteredFriends.length}件\n\n${lines.join('\n')}`
}

// ---------------------------------------------------------------------------
// get_friend_count
// ---------------------------------------------------------------------------

async function getFriendCount(channelId: string, input: any): Promise<string> {
  const { status = 'all', since } = input || {}

  let q = supabase
    .from('friends')
    .select('id', { count: 'exact', head: true })
    .eq('channel_id', channelId)

  if (status && status !== 'all') q = q.eq('status', status)
  if (since) q = q.gte('followed_at', since)

  const { count, error } = await q
  if (error) return `エラー: ${error.message}`

  const statusLabel = status === 'all' ? '全体' : status
  const sinceLabel = since ? `（${since}以降）` : ''
  return `友だち数${sinceLabel}: ${count ?? 0}人（${statusLabel}）`
}

// ---------------------------------------------------------------------------
// manage_tags
// ---------------------------------------------------------------------------

async function manageTags(channelId: string, input: any): Promise<string> {
  const { action, tag_name, color, friend_ids, friend_name } = input

  switch (action) {
    case 'list': {
      const { data: tags, error } = await supabase
        .from('tags')
        .select('id, name, color, created_at')
        .eq('channel_id', channelId)
        .order('name')

      if (error) return `エラー: ${error.message}`
      if (!tags || tags.length === 0) return 'タグがまだ作成されていません。'

      const lines: string[] = []
      for (const tag of tags) {
        const { count } = await supabase
          .from('friend_tags')
          .select('id', { count: 'exact', head: true })
          .eq('tag_id', tag.id)

        lines.push(`- ${tag.name}（色: ${tag.color}、${count ?? 0}人）`)
      }

      return `タグ一覧: ${tags.length}件\n\n${lines.join('\n')}`
    }

    case 'create': {
      if (!tag_name) return 'エラー: タグ名を指定してください。'

      const { data, error } = await supabase
        .from('tags')
        .insert({
          channel_id: channelId,
          name: tag_name,
          color: color ?? '#6366f1',
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') return `タグ「${tag_name}」は既に存在します。`
        return `エラー: ${error.message}`
      }
      return `タグ「${tag_name}」を作成しました。（色: ${data.color}）`
    }

    case 'delete': {
      if (!tag_name) return 'エラー: タグ名を指定してください。'

      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('channel_id', channelId)
        .eq('name', tag_name)

      if (error) return `エラー: ${error.message}`
      return `タグ「${tag_name}」を削除しました。`
    }

    case 'assign': {
      if (!tag_name) return 'エラー: タグ名を指定してください。'

      // Resolve friend IDs
      let resolvedIds = friend_ids || []
      if ((!resolvedIds || resolvedIds.length === 0) && friend_name) {
        const friend = await resolveFriend(channelId, { friend_name })
        if (!friend) return `友だち「${friend_name}」が見つかりません。`
        resolvedIds = [friend.id]
      }
      if (resolvedIds.length === 0) return 'エラー: 友だちIDまたは名前を指定してください。'

      const { data: tag } = await supabase
        .from('tags')
        .select('id')
        .eq('channel_id', channelId)
        .eq('name', tag_name)
        .single()

      if (!tag) return `タグ「${tag_name}」が見つかりません。`

      const rows = resolvedIds.map((fid: string) => ({ friend_id: fid, tag_id: tag.id }))
      const { error } = await supabase
        .from('friend_tags')
        .upsert(rows, { onConflict: 'friend_id,tag_id' })

      if (error) return `エラー: ${error.message}`
      return `${resolvedIds.length}人の友だちにタグ「${tag_name}」を付与しました。`
    }

    case 'unassign': {
      if (!tag_name) return 'エラー: タグ名を指定してください。'

      let resolvedIds = friend_ids || []
      if ((!resolvedIds || resolvedIds.length === 0) && friend_name) {
        const friend = await resolveFriend(channelId, { friend_name })
        if (!friend) return `友だち「${friend_name}」が見つかりません。`
        resolvedIds = [friend.id]
      }
      if (resolvedIds.length === 0) return 'エラー: 友だちIDまたは名前を指定してください。'

      const { data: tag } = await supabase
        .from('tags')
        .select('id')
        .eq('channel_id', channelId)
        .eq('name', tag_name)
        .single()

      if (!tag) return `タグ「${tag_name}」が見つかりません。`

      const { error } = await supabase
        .from('friend_tags')
        .delete()
        .eq('tag_id', tag.id)
        .in('friend_id', resolvedIds)

      if (error) return `エラー: ${error.message}`
      return `${resolvedIds.length}人の友だちからタグ「${tag_name}」を解除しました。`
    }

    default:
      return `不明な操作: ${action}`
  }
}

// ---------------------------------------------------------------------------
// manage_step_sequence
// ---------------------------------------------------------------------------

async function manageStepSequence(channelId: string, input: any): Promise<string> {
  const { action, sequence_id, name, trigger_type, is_active, steps } = input

  switch (action) {
    case 'list': {
      const { data, error } = await supabase
        .from('step_sequences')
        .select('id, name, trigger_type, is_active, created_at')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })

      if (error) return `エラー: ${error.message}`
      if (!data || data.length === 0) return 'ステップ配信はまだ作成されていません。'

      const lines = data.map((s: any) => {
        const status = s.is_active ? '🟢有効' : '🔴無効'
        return `- ${s.name}（${status}）\n  トリガー: ${s.trigger_type} / ID: ${s.id}`
      })
      return `ステップ配信一覧: ${data.length}件\n\n${lines.join('\n')}`
    }

    case 'get': {
      if (!sequence_id) return 'エラー: シーケンスIDを指定してください。'

      const { data: seq, error } = await supabase
        .from('step_sequences')
        .select('*')
        .eq('id', sequence_id)
        .eq('channel_id', channelId)
        .single()

      if (error || !seq) return 'シーケンスが見つかりません。'

      const { data: msgs } = await supabase
        .from('step_messages')
        .select('*')
        .eq('sequence_id', sequence_id)
        .order('step_order', { ascending: true })

      const stepLines = (msgs || []).map((m: any, i: number) =>
        `  ステップ${i + 1}: ${m.delay_minutes}分後 → ${m.content || m.message}`
      )

      const status = seq.is_active ? '🟢有効' : '🔴無効'
      return `ステップ配信「${seq.name}」（${status}）\nトリガー: ${seq.trigger_type}\n\n${stepLines.join('\n')}`
    }

    case 'create': {
      if (!name) return 'エラー: シーケンス名を指定してください。'

      const { data: seq, error } = await supabase
        .from('step_sequences')
        .insert({
          channel_id: channelId,
          name,
          trigger_type: trigger_type || 'follow',
          is_active: is_active !== undefined ? is_active : true,
        })
        .select()
        .single()

      if (error) return `エラー: ${error.message}`

      // Insert steps
      if (steps && steps.length > 0) {
        const stepRows = steps.map((s: any, i: number) => ({
          sequence_id: seq.id,
          step_order: i + 1,
          delay_minutes: s.delay_minutes ?? 0,
          message_type: 'text',
          content: s.message,
        }))

        const { error: stepError } = await supabase.from('step_messages').insert(stepRows)
        if (stepError) return `シーケンスは作成されましたが、ステップの追加でエラー: ${stepError.message}`
      }

      return `ステップ配信「${name}」を作成しました。（トリガー: ${trigger_type || 'follow'}、ステップ数: ${steps?.length || 0}）`
    }

    case 'update': {
      if (!sequence_id) return 'エラー: シーケンスIDを指定してください。'

      const updates: any = {}
      if (name) updates.name = name
      if (trigger_type) updates.trigger_type = trigger_type
      if (is_active !== undefined) updates.is_active = is_active

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('step_sequences')
          .update(updates)
          .eq('id', sequence_id)
          .eq('channel_id', channelId)

        if (error) return `エラー: ${error.message}`
      }

      // Update steps if provided
      if (steps && steps.length > 0) {
        await supabase.from('step_messages').delete().eq('sequence_id', sequence_id)

        const stepRows = steps.map((s: any, i: number) => ({
          sequence_id,
          step_order: i + 1,
          delay_minutes: s.delay_minutes ?? 0,
          message_type: 'text',
          content: s.message,
        }))

        const { error: stepError } = await supabase.from('step_messages').insert(stepRows)
        if (stepError) return `シーケンス更新後、ステップの追加でエラー: ${stepError.message}`
      }

      return `ステップ配信（ID: ${sequence_id}）を更新しました。`
    }

    case 'delete': {
      if (!sequence_id) return 'エラー: シーケンスIDを指定してください。'

      await supabase.from('step_messages').delete().eq('sequence_id', sequence_id)
      const { error } = await supabase
        .from('step_sequences')
        .delete()
        .eq('id', sequence_id)
        .eq('channel_id', channelId)

      if (error) return `エラー: ${error.message}`
      return `ステップ配信（ID: ${sequence_id}）を削除しました。`
    }

    case 'toggle': {
      if (!sequence_id) return 'エラー: シーケンスIDを指定してください。'

      const { data: seq } = await supabase
        .from('step_sequences')
        .select('is_active, name')
        .eq('id', sequence_id)
        .eq('channel_id', channelId)
        .single()

      if (!seq) return 'シーケンスが見つかりません。'

      const newState = !seq.is_active
      const { error } = await supabase
        .from('step_sequences')
        .update({ is_active: newState })
        .eq('id', sequence_id)

      if (error) return `エラー: ${error.message}`
      return `ステップ配信「${seq.name}」を${newState ? '有効' : '無効'}にしました。`
    }

    default:
      return `不明な操作: ${action}`
  }
}

// ---------------------------------------------------------------------------
// manage_auto_response
// ---------------------------------------------------------------------------

async function manageAutoResponse(channelId: string, input: any): Promise<string> {
  const { action, rule_id, name, match_type, keywords, response_message, is_active } = input

  switch (action) {
    case 'list': {
      const { data, error } = await supabase
        .from('auto_responses')
        .select('id, name, match_type, keyword, is_active, priority')
        .eq('channel_id', channelId)
        .order('priority', { ascending: true })

      if (error) return `エラー: ${error.message}`
      if (!data || data.length === 0) return '自動応答ルールはまだ作成されていません。'

      const lines = data.map((r: any) => {
        const status = r.is_active ? '🟢有効' : '🔴無効'
        return `- ${r.name}（${status}）\n  マッチ: ${r.match_type} / キーワード: ${r.keyword} / ID: ${r.id}`
      })
      return `自動応答ルール一覧: ${data.length}件\n\n${lines.join('\n')}`
    }

    case 'create': {
      if (!name || !match_type || !keywords || !response_message) {
        return 'エラー: name, match_type, keywords, response_message を指定してください。'
      }

      const rows = keywords.map((keyword: string, i: number) => ({
        channel_id: channelId,
        name: keywords.length > 1 ? `${name} (${i + 1})` : name,
        match_type,
        keyword,
        response_messages: [{ type: 'text', text: response_message }],
        is_active: true,
        priority: 100,
      }))

      const { data, error } = await supabase.from('auto_responses').insert(rows).select()
      if (error) return `エラー: ${error.message}`

      return `自動応答ルール「${name}」を作成しました。（キーワード: ${keywords.join(', ')}、${data?.length || 0}件のルール）`
    }

    case 'update': {
      if (!rule_id) return 'エラー: ルールIDを指定してください。'

      const updates: any = {}
      if (name) updates.name = name
      if (match_type) updates.match_type = match_type
      if (response_message) updates.response_messages = [{ type: 'text', text: response_message }]
      if (is_active !== undefined) updates.is_active = is_active
      if (keywords && keywords.length > 0) updates.keyword = keywords[0]

      const { error } = await supabase
        .from('auto_responses')
        .update(updates)
        .eq('id', rule_id)
        .eq('channel_id', channelId)

      if (error) return `エラー: ${error.message}`
      return `自動応答ルール（ID: ${rule_id}）を更新しました。`
    }

    case 'delete': {
      if (!rule_id) return 'エラー: ルールIDを指定してください。'

      const { error } = await supabase
        .from('auto_responses')
        .delete()
        .eq('id', rule_id)
        .eq('channel_id', channelId)

      if (error) return `エラー: ${error.message}`
      return `自動応答ルール（ID: ${rule_id}）を削除しました。`
    }

    case 'toggle': {
      if (!rule_id) return 'エラー: ルールIDを指定してください。'

      const { data: rule } = await supabase
        .from('auto_responses')
        .select('is_active, name')
        .eq('id', rule_id)
        .eq('channel_id', channelId)
        .single()

      if (!rule) return 'ルールが見つかりません。'

      const newState = !rule.is_active
      const { error } = await supabase
        .from('auto_responses')
        .update({ is_active: newState })
        .eq('id', rule_id)

      if (error) return `エラー: ${error.message}`
      return `自動応答ルール「${rule.name}」を${newState ? '有効' : '無効'}にしました。`
    }

    default:
      return `不明な操作: ${action}`
  }
}

// ---------------------------------------------------------------------------
// manage_rich_menu
// ---------------------------------------------------------------------------

async function manageRichMenu(channelId: string, input: any): Promise<string> {
  const { action, menu_id, name, chat_bar_text, areas, is_default } = input

  switch (action) {
    case 'list': {
      const { data, error } = await supabase
        .from('rich_menus')
        .select('id, name, chat_bar_text, is_default, created_at')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })

      if (error) return `エラー: ${error.message}`
      if (!data || data.length === 0) return 'リッチメニューはまだ作成されていません。'

      const lines = data.map((m: any) => {
        const def = m.is_default ? ' ⭐デフォルト' : ''
        return `- ${m.name}${def}\n  バーテキスト: ${m.chat_bar_text || '未設定'} / ID: ${m.id}`
      })
      return `リッチメニュー一覧: ${data.length}件\n\n${lines.join('\n')}`
    }

    case 'get': {
      if (!menu_id) return 'エラー: メニューIDを指定してください。'

      const { data, error } = await supabase
        .from('rich_menus')
        .select('*')
        .eq('id', menu_id)
        .eq('channel_id', channelId)
        .single()

      if (error || !data) return 'リッチメニューが見つかりません。'

      const areasInfo = data.areas ? (data.areas as any[]).map((a: any, i: number) =>
        `  領域${i + 1}: (${a.x},${a.y}) ${a.width}x${a.height} → ${a.action_type}: ${a.action_value}`
      ).join('\n') : '  領域未設定'

      return `リッチメニュー「${data.name}」\nバーテキスト: ${data.chat_bar_text || '未設定'}\nデフォルト: ${data.is_default ? 'はい' : 'いいえ'}\n\n${areasInfo}`
    }

    case 'create': {
      if (!name) return 'エラー: メニュー名を指定してください。'

      const { data, error } = await supabase
        .from('rich_menus')
        .insert({
          channel_id: channelId,
          name,
          chat_bar_text: chat_bar_text || 'メニュー',
          areas: areas || [],
          is_default: is_default || false,
        })
        .select()
        .single()

      if (error) return `エラー: ${error.message}`
      return `リッチメニュー「${name}」を作成しました。（ID: ${data.id}）\n※LINE側への反映は管理画面から行ってください。`
    }

    case 'update': {
      if (!menu_id) return 'エラー: メニューIDを指定してください。'

      const updates: any = {}
      if (name) updates.name = name
      if (chat_bar_text) updates.chat_bar_text = chat_bar_text
      if (areas) updates.areas = areas
      if (is_default !== undefined) updates.is_default = is_default

      const { error } = await supabase
        .from('rich_menus')
        .update(updates)
        .eq('id', menu_id)
        .eq('channel_id', channelId)

      if (error) return `エラー: ${error.message}`
      return `リッチメニュー（ID: ${menu_id}）を更新しました。`
    }

    case 'delete': {
      if (!menu_id) return 'エラー: メニューIDを指定してください。'

      const { error } = await supabase
        .from('rich_menus')
        .delete()
        .eq('id', menu_id)
        .eq('channel_id', channelId)

      if (error) return `エラー: ${error.message}`
      return `リッチメニュー（ID: ${menu_id}）を削除しました。`
    }

    case 'set_default': {
      if (!menu_id) return 'エラー: メニューIDを指定してください。'

      // Unset current default
      await supabase
        .from('rich_menus')
        .update({ is_default: false })
        .eq('channel_id', channelId)
        .eq('is_default', true)

      // Set new default
      const { error } = await supabase
        .from('rich_menus')
        .update({ is_default: true })
        .eq('id', menu_id)
        .eq('channel_id', channelId)

      if (error) return `エラー: ${error.message}`
      return `リッチメニュー（ID: ${menu_id}）をデフォルトに設定しました。`
    }

    default:
      return `不明な操作: ${action}`
  }
}

// ---------------------------------------------------------------------------
// manage_template
// ---------------------------------------------------------------------------

async function manageTemplate(channelId: string, input: any): Promise<string> {
  const { action, template_id, name, type, content } = input

  switch (action) {
    case 'list': {
      const { data, error } = await supabase
        .from('templates')
        .select('id, name, type, created_at')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })

      if (error) return `エラー: ${error.message}`
      if (!data || data.length === 0) return 'テンプレートはまだ作成されていません。'

      const lines = data.map((t: any) =>
        `- ${t.name}（タイプ: ${t.type}）/ ID: ${t.id}`
      )
      return `テンプレート一覧: ${data.length}件\n\n${lines.join('\n')}`
    }

    case 'create': {
      if (!name || !content) return 'エラー: テンプレート名と内容を指定してください。'

      const { data, error } = await supabase
        .from('templates')
        .insert({
          channel_id: channelId,
          name,
          type: type || 'text',
          content,
        })
        .select()
        .single()

      if (error) return `エラー: ${error.message}`
      return `テンプレート「${name}」を作成しました。（ID: ${data.id}）`
    }

    case 'delete': {
      if (!template_id) return 'エラー: テンプレートIDを指定してください。'

      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', template_id)
        .eq('channel_id', channelId)

      if (error) return `エラー: ${error.message}`
      return `テンプレート（ID: ${template_id}）を削除しました。`
    }

    default:
      return `不明な操作: ${action}`
  }
}

// ---------------------------------------------------------------------------
// manage_form
// ---------------------------------------------------------------------------

async function manageForm(channelId: string, input: any): Promise<string> {
  const { action, form_id, title, description, fields } = input

  switch (action) {
    case 'list': {
      const { data, error } = await supabase
        .from('forms')
        .select('id, title, description, created_at')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })

      if (error) return `エラー: ${error.message}`
      if (!data || data.length === 0) return 'フォームはまだ作成されていません。'

      const lines = data.map((f: any) =>
        `- ${f.title}${f.description ? `（${f.description}）` : ''}\n  ID: ${f.id}`
      )
      return `フォーム一覧: ${data.length}件\n\n${lines.join('\n')}`
    }

    case 'create': {
      if (!title) return 'エラー: フォームタイトルを指定してください。'

      const { data, error } = await supabase
        .from('forms')
        .insert({
          channel_id: channelId,
          title,
          description: description || '',
          fields: fields || [],
        })
        .select()
        .single()

      if (error) return `エラー: ${error.message}`

      const fieldCount = fields?.length || 0
      return `フォーム「${title}」を作成しました。（${fieldCount}フィールド、ID: ${data.id}）`
    }

    case 'delete': {
      if (!form_id) return 'エラー: フォームIDを指定してください。'

      const { error } = await supabase
        .from('forms')
        .delete()
        .eq('id', form_id)
        .eq('channel_id', channelId)

      if (error) return `エラー: ${error.message}`
      return `フォーム（ID: ${form_id}）を削除しました。`
    }

    case 'get_submissions': {
      if (!form_id) return 'エラー: フォームIDを指定してください。'

      const { data: form } = await supabase
        .from('forms')
        .select('title')
        .eq('id', form_id)
        .single()

      const { data, error } = await supabase
        .from('form_submissions')
        .select('id, friend_id, data, submitted_at, friends(display_name)')
        .eq('form_id', form_id)
        .order('submitted_at', { ascending: false })
        .limit(50)

      if (error) return `エラー: ${error.message}`
      if (!data || data.length === 0) return `フォーム「${form?.title || form_id}」への回答はまだありません。`

      const lines = data.map((s: any) => {
        const name = (s as any).friends?.display_name || '不明'
        const date = new Date(s.submitted_at).toLocaleString('ja-JP')
        const answers = typeof s.data === 'object' ? Object.entries(s.data).map(([k, v]) => `${k}: ${v}`).join(', ') : String(s.data)
        return `- ${name}（${date}）\n  ${answers}`
      })
      return `フォーム「${form?.title || form_id}」の回答: ${data.length}件\n\n${lines.join('\n')}`
    }

    default:
      return `不明な操作: ${action}`
  }
}

// ---------------------------------------------------------------------------
// manage_reservation
// ---------------------------------------------------------------------------

async function manageReservation(channelId: string, input: any): Promise<string> {
  const { action, slot_id, reservation_id, title, date, start_time, end_time, capacity } = input

  switch (action) {
    case 'list_slots': {
      let q = supabase
        .from('reservation_slots')
        .select('id, title, date, start_time, end_time, capacity, reserved_count')
        .eq('channel_id', channelId)
        .order('date', { ascending: true })

      if (date) q = q.eq('date', date)

      const { data, error } = await q
      if (error) return `エラー: ${error.message}`
      if (!data || data.length === 0) return '予約スロットはまだ作成されていません。'

      const lines = data.map((s: any) =>
        `- ${s.title}（${s.date} ${s.start_time}-${s.end_time}）\n  予約: ${s.reserved_count || 0}/${s.capacity}人 / ID: ${s.id}`
      )
      return `予約スロット一覧: ${data.length}件\n\n${lines.join('\n')}`
    }

    case 'create_slot': {
      if (!title || !date || !start_time || !end_time) {
        return 'エラー: title, date, start_time, end_time を指定してください。'
      }

      const { data, error } = await supabase
        .from('reservation_slots')
        .insert({
          channel_id: channelId,
          title,
          date,
          start_time,
          end_time,
          capacity: capacity || 1,
          reserved_count: 0,
        })
        .select()
        .single()

      if (error) return `エラー: ${error.message}`
      return `予約スロット「${title}」を作成しました。（${date} ${start_time}-${end_time}、定員${capacity || 1}人、ID: ${data.id}）`
    }

    case 'list_reservations': {
      let q = supabase
        .from('reservations')
        .select('id, slot_id, friend_id, status, reserved_at, reservation_slots(title, date, start_time, end_time), friends(display_name)')
        .eq('channel_id', channelId)
        .order('reserved_at', { ascending: false })

      if (slot_id) q = q.eq('slot_id', slot_id)

      const { data, error } = await q.limit(50)
      if (error) return `エラー: ${error.message}`
      if (!data || data.length === 0) return '予約はまだありません。'

      const lines = data.map((r: any) => {
        const slot = (r as any).reservation_slots
        const friend = (r as any).friends
        return `- ${friend?.display_name || '不明'}（${r.status}）\n  ${slot?.title || ''} ${slot?.date || ''} ${slot?.start_time || ''}-${slot?.end_time || ''}\n  ID: ${r.id}`
      })
      return `予約一覧: ${data.length}件\n\n${lines.join('\n')}`
    }

    case 'cancel': {
      if (!reservation_id) return 'エラー: 予約IDを指定してください。'

      const { data: reservation } = await supabase
        .from('reservations')
        .select('slot_id')
        .eq('id', reservation_id)
        .single()

      const { error } = await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('id', reservation_id)

      if (error) return `エラー: ${error.message}`

      // Decrement booked_count
      if (reservation) {
        const { data: slot } = await supabase
          .from('reservation_slots')
          .select('booked_count')
          .eq('id', reservation.slot_id)
          .single()
        if (slot) {
          await supabase
            .from('reservation_slots')
            .update({ booked_count: Math.max(0, (slot.booked_count ?? 1) - 1) })
            .eq('id', reservation.slot_id)
        }
      }

      return `予約（ID: ${reservation_id}）をキャンセルしました。`
    }

    default:
      return `不明な操作: ${action}`
  }
}

// ---------------------------------------------------------------------------
// create_reminder
// ---------------------------------------------------------------------------

async function createReminder(channelId: string, input: any): Promise<string> {
  const { name, message, send_at, target_type, tag_name, friend_ids } = input

  if (!name || !message || !send_at || !target_type) {
    return 'エラー: name, message, send_at, target_type を指定してください。'
  }

  const sendDate = new Date(send_at)
  if (isNaN(sendDate.getTime())) return 'エラー: 送信日時の形式が正しくありません。ISO 8601形式で指定してください。'
  if (sendDate <= new Date()) return 'エラー: 送信日時は未来の日時を指定してください。'

  const targetConfig: any = { type: target_type }
  if (target_type === 'tag' && tag_name) {
    const { data: tag } = await supabase
      .from('tags')
      .select('id')
      .eq('channel_id', channelId)
      .eq('name', tag_name)
      .single()

    if (!tag) return `タグ「${tag_name}」が見つかりません。`
    targetConfig.tag_id = tag.id
    targetConfig.tag_name = tag_name
  } else if (target_type === 'friends' && friend_ids) {
    targetConfig.friend_ids = friend_ids
  }

  const { data, error } = await supabase
    .from('reminders')
    .insert({
      channel_id: channelId,
      name,
      message,
      send_at: sendDate.toISOString(),
      target: targetConfig,
      status: 'scheduled',
    })
    .select()
    .single()

  if (error) return `エラー: ${error.message}`

  const formattedDate = sendDate.toLocaleString('ja-JP')
  return `リマインダー「${name}」を作成しました。\n送信日時: ${formattedDate}\n対象: ${target_type}${tag_name ? `（タグ: ${tag_name}）` : ''}\n内容: ${message}`
}

// ---------------------------------------------------------------------------
// get_analytics
// ---------------------------------------------------------------------------

async function getAnalytics(channelId: string, input: any): Promise<string> {
  const { metric, period } = input
  const since = getPeriodStart(period).toISOString()
  const periodLabel = period || 'month'

  switch (metric) {
    case 'summary': {
      // Comprehensive summary
      const todayStart = startOfDay(new Date()).toISOString()
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString()

      const [
        { count: totalFriends },
        { count: newToday },
        { count: newWeek },
        { count: msgReceivedToday },
        { count: msgSentToday },
        { count: broadcastsTotal },
        { count: aiReplies },
      ] = await Promise.all([
        supabase.from('friends').select('id', { count: 'exact', head: true }).eq('channel_id', channelId).eq('status', 'active'),
        supabase.from('friends').select('id', { count: 'exact', head: true }).eq('channel_id', channelId).gte('followed_at', todayStart),
        supabase.from('friends').select('id', { count: 'exact', head: true }).eq('channel_id', channelId).gte('followed_at', weekStart),
        supabase.from('chat_messages').select('id', { count: 'exact', head: true }).eq('channel_id', channelId).eq('direction', 'inbound').gte('sent_at', todayStart),
        supabase.from('chat_messages').select('id', { count: 'exact', head: true }).eq('channel_id', channelId).eq('direction', 'outbound').gte('sent_at', todayStart),
        supabase.from('broadcasts').select('id', { count: 'exact', head: true }).eq('channel_id', channelId).eq('status', 'sent'),
        supabase.from('chat_messages').select('id', { count: 'exact', head: true }).eq('channel_id', channelId).eq('direction', 'outbound').eq('message_type', 'ai_reply').gte('sent_at', todayStart),
      ])

      return `📊 サマリーレポート

👥 友だち
- アクティブ友だち数: ${totalFriends ?? 0}人
- 今日の新規追加: ${newToday ?? 0}人
- 今週の新規追加: ${newWeek ?? 0}人

💬 メッセージ（今日）
- 受信: ${msgReceivedToday ?? 0}件
- 送信: ${msgSentToday ?? 0}件
- AI自動返信: ${aiReplies ?? 0}件

📢 配信
- 総配信数: ${broadcastsTotal ?? 0}回`
    }

    case 'friend_growth': {
      const { count: total } = await supabase
        .from('friends')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', channelId)
        .eq('status', 'active')

      const { count: newFriends } = await supabase
        .from('friends')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', channelId)
        .gte('followed_at', since)

      const { count: unfollowed } = await supabase
        .from('friends')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', channelId)
        .eq('status', 'unfollowed')
        .gte('unfollowed_at', since)

      const net = (newFriends ?? 0) - (unfollowed ?? 0)
      return `📈 友だち推移（${periodLabel}）\n- アクティブ友だち数: ${total ?? 0}人\n- 新規追加: ${newFriends ?? 0}人\n- ブロック/解除: ${unfollowed ?? 0}人\n- 純増: ${net >= 0 ? '+' : ''}${net}人`
    }

    case 'messages_sent': {
      const { count } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', channelId)
        .eq('direction', 'outbound')
        .gte('sent_at', since)

      return `📤 送信メッセージ数（${periodLabel}）: ${count ?? 0}件`
    }

    case 'messages_received': {
      const { count } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', channelId)
        .eq('direction', 'inbound')
        .gte('sent_at', since)

      return `📥 受信メッセージ数（${periodLabel}）: ${count ?? 0}件`
    }

    case 'broadcasts_sent': {
      const { count } = await supabase
        .from('broadcasts')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', channelId)
        .eq('status', 'sent')
        .gte('sent_at', since)

      return `📢 配信数（${periodLabel}）: ${count ?? 0}回`
    }

    case 'url_clicks': {
      const { count } = await supabase
        .from('url_clicks')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', channelId)
        .gte('clicked_at', since)

      return `🔗 URLクリック数（${periodLabel}）: ${count ?? 0}回`
    }

    case 'ai_replies': {
      const { count } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', channelId)
        .eq('direction', 'outbound')
        .eq('message_type', 'ai_reply')
        .gte('sent_at', since)

      return `🤖 AI自動返信数（${periodLabel}）: ${count ?? 0}件`
    }

    default:
      return `不明な指標: ${metric}`
  }
}

// ---------------------------------------------------------------------------
// manage_ai_settings
// ---------------------------------------------------------------------------

async function manageAiSettings(channelId: string, input: any): Promise<string> {
  const { action, auto_reply_enabled, persona_name, persona_description, tone, system_instructions } = input

  switch (action) {
    case 'get': {
      const { data, error } = await supabase
        .from('ai_settings')
        .select('*')
        .eq('channel_id', channelId)
        .single()

      if (error || !data) return 'AI設定が見つかりません。デフォルト設定が使用されます。'

      return `🤖 AI設定
- 自動返信: ${data.auto_reply_enabled ? 'ON' : 'OFF'}
- ペルソナ名: ${data.persona_name || '未設定'}
- ペルソナ説明: ${data.persona_description || '未設定'}
- トーン: ${data.tone || '未設定'}
- システム指示: ${data.system_instructions ? data.system_instructions.substring(0, 100) + '...' : '未設定'}`
    }

    case 'update': {
      const updates: any = {}
      if (auto_reply_enabled !== undefined) updates.auto_reply_enabled = auto_reply_enabled
      if (persona_name !== undefined) updates.persona_name = persona_name
      if (persona_description !== undefined) updates.persona_description = persona_description
      if (tone !== undefined) updates.tone = tone
      if (system_instructions !== undefined) updates.system_instructions = system_instructions

      if (Object.keys(updates).length === 0) return 'エラー: 更新する項目を指定してください。'

      // Upsert: try update first, then insert
      const { data: existing } = await supabase
        .from('ai_settings')
        .select('id')
        .eq('channel_id', channelId)
        .single()

      if (existing) {
        const { error } = await supabase
          .from('ai_settings')
          .update(updates)
          .eq('channel_id', channelId)

        if (error) return `エラー: ${error.message}`
      } else {
        const { error } = await supabase
          .from('ai_settings')
          .insert({ channel_id: channelId, ...updates })

        if (error) return `エラー: ${error.message}`
      }

      const changedItems: string[] = []
      if (auto_reply_enabled !== undefined) changedItems.push(`自動返信: ${auto_reply_enabled ? 'ON' : 'OFF'}`)
      if (persona_name) changedItems.push(`ペルソナ名: ${persona_name}`)
      if (persona_description) changedItems.push(`ペルソナ説明: 更新`)
      if (tone) changedItems.push(`トーン: ${tone}`)
      if (system_instructions) changedItems.push(`システム指示: 更新`)

      return `AI設定を更新しました。\n${changedItems.map(i => `- ${i}`).join('\n')}`
    }

    default:
      return `不明な操作: ${action}`
  }
}

// ---------------------------------------------------------------------------
// manage_knowledge
// ---------------------------------------------------------------------------

async function manageKnowledge(channelId: string, input: any): Promise<string> {
  const { action, knowledge_id, category, title, content } = input

  switch (action) {
    case 'list': {
      let q = supabase
        .from('knowledge_base')
        .select('id, category, title, created_at, updated_at')
        .eq('channel_id', channelId)
        .order('category')
        .order('title')

      if (category) q = q.eq('category', category)

      const { data, error } = await q
      if (error) return `エラー: ${error.message}`
      if (!data || data.length === 0) return 'ナレッジベースにはまだ記事がありません。'

      // Group by category
      const grouped = new Map<string, any[]>()
      for (const item of data) {
        const cat = item.category || '未分類'
        if (!grouped.has(cat)) grouped.set(cat, [])
        grouped.get(cat)!.push(item)
      }

      const sections: string[] = []
      for (const [cat, items] of grouped) {
        const lines = items.map((i: any) => `  - ${i.title}（ID: ${i.id}）`)
        sections.push(`📁 ${cat}\n${lines.join('\n')}`)
      }

      return `ナレッジベース: ${data.length}件\n\n${sections.join('\n\n')}`
    }

    case 'add': {
      if (!title || !content) return 'エラー: タイトルと内容を指定してください。'

      const { data, error } = await supabase
        .from('knowledge_base')
        .insert({
          channel_id: channelId,
          category: category || '一般',
          title,
          content,
        })
        .select()
        .single()

      if (error) return `エラー: ${error.message}`
      return `ナレッジ「${title}」を追加しました。（カテゴリ: ${category || '一般'}、ID: ${data.id}）`
    }

    case 'update': {
      if (!knowledge_id) return 'エラー: ナレッジIDを指定してください。'

      const updates: any = {}
      if (category) updates.category = category
      if (title) updates.title = title
      if (content) updates.content = content
      updates.updated_at = new Date().toISOString()

      const { error } = await supabase
        .from('knowledge_base')
        .update(updates)
        .eq('id', knowledge_id)
        .eq('channel_id', channelId)

      if (error) return `エラー: ${error.message}`
      return `ナレッジ（ID: ${knowledge_id}）を更新しました。`
    }

    case 'delete': {
      if (!knowledge_id) return 'エラー: ナレッジIDを指定してください。'

      const { error } = await supabase
        .from('knowledge_base')
        .delete()
        .eq('id', knowledge_id)
        .eq('channel_id', channelId)

      if (error) return `エラー: ${error.message}`
      return `ナレッジ（ID: ${knowledge_id}）を削除しました。`
    }

    default:
      return `不明な操作: ${action}`
  }
}

// ---------------------------------------------------------------------------
// EC連携: ec_get_orders
// ---------------------------------------------------------------------------

async function ecGetOrders(channelId: string, input: any): Promise<string> {
  const { status, platform, friend_name, friend_id, limit = 20, period } = input || {}

  // If friend_name is provided, resolve to friend_id first
  let resolvedFriendId = friend_id
  if (!resolvedFriendId && friend_name) {
    const friend = await resolveFriend(channelId, { friend_name })
    if (!friend) return `エラー: 「${friend_name}」という友だちが見つかりません。`
    resolvedFriendId = friend.id
  }

  let query = supabase
    .from('ec_orders')
    .select(`
      id, external_order_id, platform, status, total_amount, currency, ordered_at, shipping_status,
      ec_order_items(id, product_name, quantity, unit_price),
      ec_customer_links!inner(friend_id, friends!inner(id, display_name))
    `)
    .eq('channel_id', channelId)
    .order('ordered_at', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)
  if (platform) query = query.eq('platform', platform)
  if (resolvedFriendId) query = query.eq('ec_customer_links.friend_id', resolvedFriendId)
  if (period) {
    const start = getPeriodStart(period)
    query = query.gte('ordered_at', start.toISOString())
  }

  const { data: orders, error } = await query

  if (error) return `エラー: ${error.message}`
  if (!orders || orders.length === 0) return '該当する注文はありません。'

  const lines = orders.map((o: any) => {
    const customerName = o.ec_customer_links?.friends?.display_name || '不明'
    const items = (o.ec_order_items || []).map((i: any) => `${i.product_name}×${i.quantity}`).join(', ')
    const date = new Date(o.ordered_at).toLocaleDateString('ja-JP')
    const statusLabel: Record<string, string> = {
      pending: '未確定', confirmed: '確定', shipped: '発送済', delivered: '配達完了', cancelled: 'キャンセル', returned: '返品'
    }
    return `📦 注文ID: ${o.id}\n  外部ID: ${o.external_order_id || '-'}\n  顧客: ${customerName}\n  商品: ${items || '-'}\n  金額: ¥${o.total_amount?.toLocaleString() || 0}\n  ステータス: ${statusLabel[o.status] || o.status}\n  プラットフォーム: ${o.platform}\n  注文日: ${date}`
  })

  return `🛒 注文一覧（${orders.length}件）\n\n${lines.join('\n\n')}`
}

// ---------------------------------------------------------------------------
// EC連携: ec_get_order_detail
// ---------------------------------------------------------------------------

async function ecGetOrderDetail(channelId: string, input: any): Promise<string> {
  const { order_id, external_order_id } = input || {}

  if (!order_id && !external_order_id) return 'エラー: 注文IDまたは外部注文IDを指定してください。'

  let query = supabase
    .from('ec_orders')
    .select(`
      id, external_order_id, platform, status, total_amount, currency, ordered_at,
      shipping_status, tracking_number, carrier, shipped_at, delivered_at,
      ec_order_items(id, product_name, quantity, unit_price, sku),
      ec_customer_links!inner(friend_id, email, friends!inner(id, display_name, line_user_id)),
      ec_followup_jobs(id, job_type, status, scheduled_at, sent_at)
    `)
    .eq('channel_id', channelId)

  if (order_id) query = query.eq('id', order_id)
  else query = query.eq('external_order_id', external_order_id)

  const { data: order, error } = await query.single()

  if (error) return `エラー: ${error.message}`
  if (!order) return '注文が見つかりません。'

  const o = order as any
  const customerName = o.ec_customer_links?.friends?.display_name || '不明'
  const items = (o.ec_order_items || []).map((i: any, idx: number) =>
    `  ${idx + 1}. ${i.product_name}（SKU: ${i.sku || '-'}）× ${i.quantity} ¥${i.unit_price?.toLocaleString()}`
  ).join('\n')

  const followups = (o.ec_followup_jobs || []).map((j: any) => {
    const typeLabel: Record<string, string> = {
      delivery_followup: '配送フォロー', product_followup: '商品フォロー',
      review_request: 'レビュー依頼', repeat_suggestion: 'リピート提案'
    }
    const statusLabel: Record<string, string> = {
      pending: '待機中', sent: '送信済', cancelled: 'キャンセル'
    }
    return `  - ${typeLabel[j.job_type] || j.job_type}: ${statusLabel[j.status] || j.status}（${j.scheduled_at ? new Date(j.scheduled_at).toLocaleDateString('ja-JP') : '-'}）`
  }).join('\n')

  const statusLabel: Record<string, string> = {
    pending: '未確定', confirmed: '確定', shipped: '発送済', delivered: '配達完了', cancelled: 'キャンセル', returned: '返品'
  }

  return `📦 注文詳細
注文ID: ${o.id}
外部ID: ${o.external_order_id || '-'}
プラットフォーム: ${o.platform}
顧客: ${customerName}
ステータス: ${statusLabel[o.status] || o.status}
注文日: ${new Date(o.ordered_at).toLocaleDateString('ja-JP')}
合計金額: ¥${o.total_amount?.toLocaleString() || 0}

📋 商品:
${items || '  なし'}

🚚 配送情報:
  配送ステータス: ${o.shipping_status || '-'}
  追跡番号: ${o.tracking_number || '-'}
  配送業者: ${o.carrier || '-'}
  発送日: ${o.shipped_at ? new Date(o.shipped_at).toLocaleDateString('ja-JP') : '-'}
  配達日: ${o.delivered_at ? new Date(o.delivered_at).toLocaleDateString('ja-JP') : '-'}

📨 フォローアップ:
${followups || '  なし'}`
}

// ---------------------------------------------------------------------------
// EC連携: ec_get_customer_profile
// ---------------------------------------------------------------------------

async function ecGetCustomerProfile(channelId: string, input: any): Promise<string> {
  const { friend_id, friend_name } = input || {}

  const friend = await resolveFriend(channelId, { friend_id, friend_name })
  if (!friend) return `エラー: 友だちが見つかりません。`

  // Get customer link
  const { data: link } = await supabase
    .from('ec_customer_links')
    .select('id, email, phone, tier, total_spent, order_count, first_order_at, last_order_at, linked_at')
    .eq('channel_id', channelId)
    .eq('friend_id', friend.id)
    .single()

  if (!link) return `${friend.display_name} さんはEC顧客として紐付けされていません。`

  // Get recent orders with items
  const { data: orders } = await supabase
    .from('ec_orders')
    .select(`
      id, external_order_id, platform, status, total_amount, ordered_at,
      ec_order_items(product_name, quantity, unit_price)
    `)
    .eq('channel_id', channelId)
    .eq('customer_link_id', link.id)
    .order('ordered_at', { ascending: false })
    .limit(10)

  const tierLabel: Record<string, string> = {
    bronze: 'ブロンズ', silver: 'シルバー', gold: 'ゴールド', platinum: 'プラチナ'
  }

  const orderLines = (orders || []).map((o: any) => {
    const items = (o.ec_order_items || []).map((i: any) => `${i.product_name}×${i.quantity}`).join(', ')
    const date = new Date(o.ordered_at).toLocaleDateString('ja-JP')
    return `  - ${date} ¥${o.total_amount?.toLocaleString()} [${o.platform}] ${items}`
  }).join('\n')

  return `👤 EC購買プロフィール: ${friend.display_name}
メール: ${link.email || '-'}
電話: ${link.phone || '-'}
顧客ランク: ${tierLabel[link.tier] || link.tier || '-'}
累計購入金額: ¥${link.total_spent?.toLocaleString() || 0}
注文回数: ${link.order_count || 0}回
初回注文: ${link.first_order_at ? new Date(link.first_order_at).toLocaleDateString('ja-JP') : '-'}
最終注文: ${link.last_order_at ? new Date(link.last_order_at).toLocaleDateString('ja-JP') : '-'}
紐付け日: ${link.linked_at ? new Date(link.linked_at).toLocaleDateString('ja-JP') : '-'}

📦 最近の注文:
${orderLines || '  なし'}`
}

// ---------------------------------------------------------------------------
// EC連携: ec_link_customer
// ---------------------------------------------------------------------------

async function ecLinkCustomer(channelId: string, input: any): Promise<string> {
  const { friend_id, friend_name, email, phone } = input || {}

  if (!email) return 'エラー: メールアドレスを指定してください。'

  const friend = await resolveFriend(channelId, { friend_id, friend_name })
  if (!friend) return `エラー: 友だちが見つかりません。`

  // Check if already linked
  const { data: existing } = await supabase
    .from('ec_customer_links')
    .select('id')
    .eq('channel_id', channelId)
    .eq('friend_id', friend.id)
    .single()

  if (existing) return `${friend.display_name} さんは既にEC顧客として紐付けされています（ID: ${existing.id}）。`

  // Create link
  const { data: link, error } = await supabase
    .from('ec_customer_links')
    .insert({
      channel_id: channelId,
      friend_id: friend.id,
      email,
      phone: phone || null,
      tier: 'bronze',
      total_spent: 0,
      order_count: 0,
      linked_at: new Date().toISOString()
    })
    .select('id')
    .single()

  if (error) return `エラー: ${error.message}`

  return `✅ ${friend.display_name} さんをEC顧客として紐付けました。\nメール: ${email}\nリンクID: ${link.id}`
}

// ---------------------------------------------------------------------------
// EC連携: ec_send_shipping_notification
// ---------------------------------------------------------------------------

async function ecSendShippingNotification(channelId: string, input: any): Promise<string> {
  const { order_id, tracking_number, carrier, custom_message } = input || {}

  if (!order_id) return 'エラー: 注文IDを指定してください。'

  // Get order with customer info
  const { data: order, error } = await supabase
    .from('ec_orders')
    .select(`
      id, external_order_id, status,
      ec_order_items(product_name, quantity),
      ec_customer_links!inner(friend_id, friends!inner(id, display_name, line_user_id))
    `)
    .eq('id', order_id)
    .eq('channel_id', channelId)
    .single()

  if (error || !order) return `エラー: 注文が見つかりません。`

  const o = order as any
  const lineUserId = o.ec_customer_links?.friends?.line_user_id
  const customerName = o.ec_customer_links?.friends?.display_name || '顧客'
  const friendId = o.ec_customer_links?.friend_id

  if (!lineUserId) return `エラー: 顧客のLINE IDが見つかりません。`

  // Build message
  const items = (o.ec_order_items || []).map((i: any) => `・${i.product_name}×${i.quantity}`).join('\n')
  let message = custom_message || `${customerName}様\n\nご注文の商品が発送されました。\n\n${items}\n`

  if (tracking_number) {
    message += `\n追跡番号: ${tracking_number}`
  }
  if (carrier) {
    message += `\n配送業者: ${carrier}`
  }

  // Send via LINE
  try {
    await lineClient.pushMessage({
      to: lineUserId,
      messages: [{ type: 'text', text: message }]
    })
  } catch (lineErr: any) {
    return `エラー: LINE送信に失敗しました: ${lineErr.message}`
  }

  // Update order shipping info
  const updateData: any = { shipping_status: 'shipped', shipped_at: new Date().toISOString() }
  if (tracking_number) updateData.tracking_number = tracking_number
  if (carrier) updateData.carrier = carrier

  await supabase
    .from('ec_orders')
    .update(updateData)
    .eq('id', order_id)

  // Save outbound message
  await supabase.from('chat_messages').insert({
    channel_id: channelId,
    friend_id: friendId,
    direction: 'outbound',
    content: message,
    message_type: 'text',
    sent_at: new Date().toISOString()
  })

  return `✅ ${customerName} さんに配送通知を送信しました。\n追跡番号: ${tracking_number || '-'}\n配送業者: ${carrier || '-'}`
}

// ---------------------------------------------------------------------------
// EC連携: ec_manage_followup
// ---------------------------------------------------------------------------

async function ecManageFollowup(channelId: string, input: any): Promise<string> {
  const { action, job_id, order_id, friend_id, job_type, message, scheduled_at } = input || {}

  const typeLabel: Record<string, string> = {
    delivery_followup: '配送フォロー', product_followup: '商品フォロー',
    review_request: 'レビュー依頼', repeat_suggestion: 'リピート提案'
  }

  switch (action) {
    case 'list_pending': {
      let query = supabase
        .from('ec_followup_jobs')
        .select(`
          id, job_type, status, message, scheduled_at,
          ec_orders(id, external_order_id, ec_customer_links(friends(display_name)))
        `)
        .eq('channel_id', channelId)
        .eq('status', 'pending')
        .order('scheduled_at', { ascending: true })
        .limit(20)

      if (friend_id) query = query.eq('friend_id', friend_id)
      if (job_type) query = query.eq('job_type', job_type)

      const { data: jobs, error } = await query

      if (error) return `エラー: ${error.message}`
      if (!jobs || jobs.length === 0) return '待機中のフォローアップジョブはありません。'

      const lines = jobs.map((j: any) => {
        const customerName = j.ec_orders?.ec_customer_links?.friends?.display_name || '不明'
        const schedDate = j.scheduled_at ? new Date(j.scheduled_at).toLocaleString('ja-JP') : '-'
        return `📨 ジョブID: ${j.id}\n  種類: ${typeLabel[j.job_type] || j.job_type}\n  顧客: ${customerName}\n  予定: ${schedDate}\n  メッセージ: ${j.message?.substring(0, 50) || '-'}...`
      })

      return `📋 待機中のフォローアップ（${jobs.length}件）\n\n${lines.join('\n\n')}`
    }

    case 'create': {
      if (!order_id) return 'エラー: 注文IDを指定してください。'
      if (!job_type) return 'エラー: ジョブタイプを指定してください。'

      const scheduledDate = scheduled_at ? new Date(scheduled_at).toISOString() : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()

      const { data: order } = await supabase
        .from('ec_orders')
        .select('id, ec_customer_links(friend_id)')
        .eq('id', order_id)
        .eq('channel_id', channelId)
        .single()

      if (!order) return 'エラー: 注文が見つかりません。'

      const resolvedFriendId = (order as any).ec_customer_links?.friend_id || friend_id

      const { data: job, error } = await supabase
        .from('ec_followup_jobs')
        .insert({
          channel_id: channelId,
          order_id,
          friend_id: resolvedFriendId,
          job_type,
          status: 'pending',
          message: message || null,
          scheduled_at: scheduledDate
        })
        .select('id')
        .single()

      if (error) return `エラー: ${error.message}`

      return `✅ フォローアップジョブを作成しました。\nジョブID: ${job.id}\n種類: ${typeLabel[job_type] || job_type}\n予定日時: ${new Date(scheduledDate).toLocaleString('ja-JP')}`
    }

    case 'cancel': {
      if (!job_id) return 'エラー: ジョブIDを指定してください。'

      const { error } = await supabase
        .from('ec_followup_jobs')
        .update({ status: 'cancelled' })
        .eq('id', job_id)
        .eq('channel_id', channelId)
        .eq('status', 'pending')

      if (error) return `エラー: ${error.message}`

      return `✅ フォローアップジョブ（ID: ${job_id}）をキャンセルしました。`
    }

    case 'send_now': {
      if (!job_id) return 'エラー: ジョブIDを指定してください。'

      // Get job with order and friend info
      const { data: job, error } = await supabase
        .from('ec_followup_jobs')
        .select(`
          id, job_type, message, friend_id,
          friends(id, display_name, line_user_id),
          ec_orders(id, external_order_id, ec_order_items(product_name))
        `)
        .eq('id', job_id)
        .eq('channel_id', channelId)
        .eq('status', 'pending')
        .single()

      if (error || !job) return 'エラー: 待機中のジョブが見つかりません。'

      const j = job as any
      const lineUserId = j.friends?.line_user_id
      if (!lineUserId) return 'エラー: 顧客のLINE IDが見つかりません。'

      const customerName = j.friends?.display_name || '顧客'
      const products = (j.ec_orders?.ec_order_items || []).map((i: any) => i.product_name).join('、')

      // Build default message if none
      let sendMessage = j.message
      if (!sendMessage) {
        switch (j.job_type) {
          case 'delivery_followup':
            sendMessage = `${customerName}様\n\n商品はお手元に届きましたでしょうか？何かご不明な点がございましたらお気軽にお問い合わせください。`
            break
          case 'product_followup':
            sendMessage = `${customerName}様\n\nご購入いただいた${products}はいかがでしょうか？ご使用感などお聞かせください。`
            break
          case 'review_request':
            sendMessage = `${customerName}様\n\nご購入いただいた${products}のレビューをお願いできますでしょうか？今後の商品改善の参考にさせていただきます。`
            break
          case 'repeat_suggestion':
            sendMessage = `${customerName}様\n\n以前ご購入いただいた${products}はいかがでしたか？リピートのご注文もお待ちしております。`
            break
          default:
            sendMessage = `${customerName}様\n\nご購入ありがとうございました。`
        }
      }

      // Send via LINE
      try {
        await lineClient.pushMessage({
          to: lineUserId,
          messages: [{ type: 'text', text: sendMessage }]
        })
      } catch (lineErr: any) {
        return `エラー: LINE送信に失敗しました: ${lineErr.message}`
      }

      // Update job status
      await supabase
        .from('ec_followup_jobs')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', job_id)

      // Save outbound message
      await supabase.from('chat_messages').insert({
        channel_id: channelId,
        friend_id: j.friend_id,
        direction: 'outbound',
        content: sendMessage,
        message_type: 'text',
        sent_at: new Date().toISOString()
      })

      return `✅ フォローアップを送信しました。\n種類: ${typeLabel[j.job_type] || j.job_type}\n顧客: ${customerName}`
    }

    default:
      return `不明な操作: ${action}`
  }
}

// ---------------------------------------------------------------------------
// EC連携: ec_sync_orders
// ---------------------------------------------------------------------------

async function ecSyncOrders(channelId: string, input: any): Promise<string> {
  const { store_id, platform } = input || {}

  // Build the API URL for internal sync endpoint
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const params = new URLSearchParams()
  if (store_id) params.set('store_id', store_id)
  if (platform) params.set('platform', platform)
  params.set('channel_id', channelId)

  try {
    const res = await fetch(`${baseUrl}/api/ec/sync?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!res.ok) {
      const body = await res.text()
      return `エラー: 同期に失敗しました（${res.status}）: ${body}`
    }

    const result = await res.json()
    return `✅ EC注文データを同期しました。\nプラットフォーム: ${platform || '全て'}\n新規注文: ${result.new_orders ?? '-'}件\n更新注文: ${result.updated_orders ?? '-'}件`
  } catch (err: any) {
    return `エラー: 同期リクエストに失敗しました: ${err.message}`
  }
}

// ---------------------------------------------------------------------------
// EC連携: ec_get_stats
// ---------------------------------------------------------------------------

async function ecGetStats(channelId: string, input: any): Promise<string> {
  const { period } = input || {}
  const start = getPeriodStart(period || 'month')

  // Total orders and revenue in period
  const { data: orders, error } = await supabase
    .from('ec_orders')
    .select('id, status, total_amount, platform, ordered_at, customer_link_id')
    .eq('channel_id', channelId)
    .gte('ordered_at', start.toISOString())

  if (error) return `エラー: ${error.message}`

  const allOrders = orders || []
  const totalOrders = allOrders.length
  const activeOrders = allOrders.filter((o: any) => !['cancelled', 'returned'].includes(o.status))
  const totalRevenue = activeOrders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0)
  const cancelledOrders = allOrders.filter((o: any) => o.status === 'cancelled').length
  const returnedOrders = allOrders.filter((o: any) => o.status === 'returned').length

  // Platform breakdown
  const platformCounts: Record<string, { count: number; revenue: number }> = {}
  for (const o of activeOrders as any[]) {
    const p = o.platform || 'unknown'
    if (!platformCounts[p]) platformCounts[p] = { count: 0, revenue: 0 }
    platformCounts[p].count++
    platformCounts[p].revenue += o.total_amount || 0
  }
  const platformLines = Object.entries(platformCounts).map(
    ([p, v]) => `  ${p}: ${v.count}件 / ¥${v.revenue.toLocaleString()}`
  ).join('\n')

  // Unique customers & repeat rate
  const uniqueCustomers = new Set(activeOrders.map((o: any) => o.customer_link_id)).size
  const customerOrderCounts: Record<string, number> = {}
  for (const o of activeOrders as any[]) {
    const cid = o.customer_link_id
    if (cid) customerOrderCounts[cid] = (customerOrderCounts[cid] || 0) + 1
  }
  const repeatCustomers = Object.values(customerOrderCounts).filter(c => c > 1).length
  const repeatRate = uniqueCustomers > 0 ? Math.round((repeatCustomers / uniqueCustomers) * 100) : 0

  // Customer tier distribution
  const { data: links } = await supabase
    .from('ec_customer_links')
    .select('tier')
    .eq('channel_id', channelId)

  const tierCounts: Record<string, number> = {}
  for (const l of (links || []) as any[]) {
    const t = l.tier || 'unknown'
    tierCounts[t] = (tierCounts[t] || 0) + 1
  }
  const tierLabel: Record<string, string> = {
    bronze: 'ブロンズ', silver: 'シルバー', gold: 'ゴールド', platinum: 'プラチナ'
  }
  const tierLines = Object.entries(tierCounts).map(
    ([t, c]) => `  ${tierLabel[t] || t}: ${c}人`
  ).join('\n')

  const periodLabel: Record<string, string> = {
    today: '本日', week: '今週', month: '今月', year: '今年'
  }

  return `📊 EC統計（${periodLabel[period] || '過去1ヶ月'}）

📦 注文:
  総注文数: ${totalOrders}件
  有効注文: ${activeOrders.length}件
  キャンセル: ${cancelledOrders}件
  返品: ${returnedOrders}件

💰 売上:
  総売上: ¥${totalRevenue.toLocaleString()}
  平均注文金額: ¥${activeOrders.length > 0 ? Math.round(totalRevenue / activeOrders.length).toLocaleString() : 0}

🏪 プラットフォーム別:
${platformLines || '  データなし'}

👥 顧客:
  ユニーク顧客数: ${uniqueCustomers}人
  リピート顧客: ${repeatCustomers}人
  リピート率: ${repeatRate}%

🏆 顧客ランク分布:
${tierLines || '  データなし'}`
}

// ---------------------------------------------------------------------------
// Shopify Products & Pages
// ---------------------------------------------------------------------------

async function ecGetProducts(channelId: string, input: any): Promise<string> {
  const storeId = input.store_id
  const query = input.query ?? ''
  const limit = input.limit ?? 20

  // Get store credentials
  let storeQuery = supabase
    .from('ec_stores')
    .select('*')
    .eq('channel_id', channelId)
    .eq('platform', 'shopify')

  if (storeId) {
    storeQuery = storeQuery.eq('id', storeId)
  }

  const { data: stores } = await storeQuery.limit(1).single()

  if (!stores || !stores.shopify_domain || !stores.shopify_access_token) {
    return 'Shopifyストアが接続されていません。EC管理画面でストアを接続してください。'
  }

  const domain = stores.shopify_domain
  const token = stores.shopify_access_token

  // Fetch products from Shopify
  const searchParam = query ? `&title=${encodeURIComponent(query)}` : ''
  const res = await fetch(
    `https://${domain}/admin/api/2024-01/products.json?limit=${limit}${searchParam}`,
    { headers: { 'X-Shopify-Access-Token': token } }
  )

  if (!res.ok) {
    return `Shopify APIエラー: ${res.status} ${res.statusText}`
  }

  const data = await res.json()
  const products = data.products ?? []

  if (products.length === 0) {
    return query ? `「${query}」に一致する商品が見つかりませんでした。` : '商品が見つかりませんでした。'
  }

  const lines = products.map((p: any) => {
    const url = `https://${domain}/products/${p.handle}`
    const price = p.variants?.[0]?.price ?? '不明'
    const image = p.image?.src ?? '画像なし'
    return `- **${p.title}** (¥${Number(price).toLocaleString()})
    URL: ${url}
    画像: ${image}
    説明: ${(p.body_html ?? '').replace(/<[^>]+>/g, '').slice(0, 80)}...`
  })

  return `### Shopify商品一覧（${products.length}件）
ストア: ${domain}

${lines.join('\n\n')}`
}

async function ecGetStorePages(channelId: string, input: any): Promise<string> {
  const storeId = input.store_id

  let storeQuery = supabase
    .from('ec_stores')
    .select('*')
    .eq('channel_id', channelId)
    .eq('platform', 'shopify')

  if (storeId) {
    storeQuery = storeQuery.eq('id', storeId)
  }

  const { data: store } = await storeQuery.limit(1).single()

  if (!store || !store.shopify_domain) {
    return 'Shopifyストアが接続されていません。'
  }

  const domain = store.shopify_domain
  const token = store.shopify_access_token

  // Fetch collections
  let collections: any[] = []
  try {
    const colRes = await fetch(
      `https://${domain}/admin/api/2024-01/custom_collections.json?limit=20`,
      { headers: { 'X-Shopify-Access-Token': token } }
    )
    if (colRes.ok) {
      const colData = await colRes.json()
      collections = colData.custom_collections ?? []
    }
  } catch {}

  // Fetch pages
  let pages: any[] = []
  try {
    const pageRes = await fetch(
      `https://${domain}/admin/api/2024-01/pages.json?limit=20`,
      { headers: { 'X-Shopify-Access-Token': token } }
    )
    if (pageRes.ok) {
      const pageData = await pageRes.json()
      pages = pageData.pages ?? []
    }
  } catch {}

  const baseUrl = `https://${domain}`

  let result = `### ${domain} のページ一覧\n\n`
  result += `**主要ページ:**\n`
  result += `- ホーム: ${baseUrl}\n`
  result += `- 全商品: ${baseUrl}/collections/all\n`
  result += `- カート: ${baseUrl}/cart\n`
  result += `- お問い合わせ: ${baseUrl}/pages/contact\n\n`

  if (collections.length > 0) {
    result += `**コレクション:**\n`
    for (const col of collections) {
      result += `- ${col.title}: ${baseUrl}/collections/${col.handle}\n`
    }
    result += '\n'
  }

  if (pages.length > 0) {
    result += `**固定ページ:**\n`
    for (const page of pages) {
      result += `- ${page.title}: ${baseUrl}/pages/${page.handle}\n`
    }
  }

  return result
}
