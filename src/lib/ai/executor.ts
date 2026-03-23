import { createServiceClient } from '@/lib/supabase/server'
import { pushMessage, multicast, broadcastMessage } from '@/lib/line/client'
import { textMessage } from '@/lib/line/messages'
import { sub, startOfDay, startOfWeek, startOfMonth, startOfYear } from 'date-fns'

export async function executeToolCall(
  toolName: string,
  toolInput: any,
  channelId: string
): Promise<string> {
  const supabase = createServiceClient()

  switch (toolName) {
    case 'search_friends':
      return await searchFriends(supabase, channelId, toolInput)
    case 'get_friend_count':
      return await getFriendCount(supabase, channelId, toolInput)
    case 'send_message_to_friends':
      return await sendMessageToFriends(supabase, channelId, toolInput)
    case 'send_message_by_tag':
      return await sendMessageByTag(supabase, channelId, toolInput)
    case 'broadcast_message':
      return await doBroadcastMessage(supabase, channelId, toolInput)
    case 'manage_tags':
      return await manageTags(supabase, channelId, toolInput)
    case 'list_tags':
      return await listTags(supabase, channelId)
    case 'create_reminder':
      return await createReminder(supabase, channelId, toolInput)
    case 'get_analytics':
      return await getAnalytics(supabase, channelId, toolInput)
    case 'create_auto_response':
      return await createAutoResponse(supabase, channelId, toolInput)
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` })
  }
}

// ---------------------------------------------------------------------------
// search_friends
// ---------------------------------------------------------------------------

async function searchFriends(supabase: any, channelId: string, input: any): Promise<string> {
  const { query, tag_names, status, limit = 20 } = input

  let q = supabase
    .from('friends')
    .select('id, display_name, picture_url, status, line_user_id, followed_at, memo')
    .eq('channel_id', channelId)
    .limit(limit)

  if (query) {
    q = q.ilike('display_name', `%${query}%`)
  }
  if (status) {
    q = q.eq('status', status)
  }

  const { data: friends, error } = await q

  if (error) {
    return JSON.stringify({ error: error.message })
  }

  // If tag_names filter is specified, further filter by tags
  if (tag_names && tag_names.length > 0 && friends && friends.length > 0) {
    const friendIds = friends.map((f: any) => f.id)

    const { data: taggedFriends } = await supabase
      .from('friend_tags')
      .select('friend_id, tags!inner(name)')
      .in('friend_id', friendIds)
      .in('tags.name', tag_names)

    if (taggedFriends) {
      const matchedIds = new Set(taggedFriends.map((ft: any) => ft.friend_id))
      const filtered = friends.filter((f: any) => matchedIds.has(f.id))
      return JSON.stringify({ friends: filtered, total: filtered.length })
    }
  }

  return JSON.stringify({ friends: friends ?? [], total: friends?.length ?? 0 })
}

// ---------------------------------------------------------------------------
// get_friend_count
// ---------------------------------------------------------------------------

async function getFriendCount(supabase: any, channelId: string, input: any): Promise<string> {
  const { status = 'all', since } = input

  let q = supabase
    .from('friends')
    .select('id', { count: 'exact', head: true })
    .eq('channel_id', channelId)

  if (status && status !== 'all') {
    q = q.eq('status', status)
  }
  if (since) {
    q = q.gte('followed_at', since)
  }

  const { count, error } = await q

  if (error) {
    return JSON.stringify({ error: error.message })
  }

  return JSON.stringify({ count: count ?? 0, status, since: since ?? null })
}

// ---------------------------------------------------------------------------
// send_message_to_friends
// ---------------------------------------------------------------------------

async function sendMessageToFriends(supabase: any, channelId: string, input: any): Promise<string> {
  const { friend_ids, message } = input

  if (!friend_ids || friend_ids.length === 0) {
    return JSON.stringify({ error: '送信先の友だちIDが指定されていません。' })
  }
  if (!message) {
    return JSON.stringify({ error: 'メッセージが指定されていません。' })
  }

  // Resolve LINE user IDs from friend IDs
  const { data: friends, error: fetchError } = await supabase
    .from('friends')
    .select('id, line_user_id, display_name')
    .eq('channel_id', channelId)
    .in('id', friend_ids)
    .eq('status', 'active')

  if (fetchError) {
    return JSON.stringify({ error: fetchError.message })
  }

  if (!friends || friends.length === 0) {
    return JSON.stringify({ error: '有効な送信先が見つかりませんでした。' })
  }

  const lineUserIds = friends.map((f: any) => f.line_user_id)
  const messages = [textMessage(message)]

  try {
    if (lineUserIds.length === 1) {
      await pushMessage(lineUserIds[0], messages)
    } else {
      await multicast(lineUserIds, messages)
    }
  } catch (err: any) {
    return JSON.stringify({ error: `LINE API送信エラー: ${err.message}` })
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

  const names = friends.map((f: any) => f.display_name).join(', ')
  return JSON.stringify({
    success: true,
    sent_to: friends.length,
    recipients: names,
  })
}

// ---------------------------------------------------------------------------
// send_message_by_tag
// ---------------------------------------------------------------------------

async function sendMessageByTag(supabase: any, channelId: string, input: any): Promise<string> {
  const { tag_name, message } = input

  if (!tag_name) {
    return JSON.stringify({ error: 'タグ名が指定されていません。' })
  }
  if (!message) {
    return JSON.stringify({ error: 'メッセージが指定されていません。' })
  }

  // Find the tag
  const { data: tag, error: tagError } = await supabase
    .from('tags')
    .select('id')
    .eq('channel_id', channelId)
    .eq('name', tag_name)
    .single()

  if (tagError || !tag) {
    return JSON.stringify({ error: `タグ「${tag_name}」が見つかりませんでした。` })
  }

  // Get friends with this tag
  const { data: friendTags } = await supabase
    .from('friend_tags')
    .select('friend_id')
    .eq('tag_id', tag.id)

  if (!friendTags || friendTags.length === 0) {
    return JSON.stringify({ error: `タグ「${tag_name}」が付いた友だちがいません。` })
  }

  const friendIds = friendTags.map((ft: any) => ft.friend_id)

  const { data: friends } = await supabase
    .from('friends')
    .select('id, line_user_id, display_name')
    .in('id', friendIds)
    .eq('status', 'active')

  if (!friends || friends.length === 0) {
    return JSON.stringify({ error: 'アクティブな送信先が見つかりませんでした。' })
  }

  const lineUserIds = friends.map((f: any) => f.line_user_id)
  const messages = [textMessage(message)]

  try {
    if (lineUserIds.length === 1) {
      await pushMessage(lineUserIds[0], messages)
    } else {
      // Multicast supports max 500 recipients per call
      for (let i = 0; i < lineUserIds.length; i += 500) {
        const chunk = lineUserIds.slice(i, i + 500)
        await multicast(chunk, messages)
      }
    }
  } catch (err: any) {
    return JSON.stringify({ error: `LINE API送信エラー: ${err.message}` })
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

  return JSON.stringify({
    success: true,
    tag: tag_name,
    sent_to: friends.length,
  })
}

// ---------------------------------------------------------------------------
// broadcast_message
// ---------------------------------------------------------------------------

async function doBroadcastMessage(supabase: any, channelId: string, input: any): Promise<string> {
  const { message } = input

  if (!message) {
    return JSON.stringify({ error: 'メッセージが指定されていません。' })
  }

  const messages = [textMessage(message)]

  try {
    await broadcastMessage(messages)
  } catch (err: any) {
    return JSON.stringify({ error: `LINE API一斉送信エラー: ${err.message}` })
  }

  // Record broadcast in broadcasts table
  await supabase.from('broadcasts').insert({
    channel_id: channelId,
    message_type: 'text',
    content: message,
    status: 'sent',
    sent_at: new Date().toISOString(),
  })

  // Get active friend count for reporting
  const { count } = await supabase
    .from('friends')
    .select('id', { count: 'exact', head: true })
    .eq('channel_id', channelId)
    .eq('status', 'active')

  return JSON.stringify({
    success: true,
    message: '一斉送信が完了しました。',
    estimated_recipients: count ?? 0,
  })
}

// ---------------------------------------------------------------------------
// manage_tags
// ---------------------------------------------------------------------------

async function manageTags(supabase: any, channelId: string, input: any): Promise<string> {
  const { action, tag_name, color, friend_ids } = input

  switch (action) {
    case 'create': {
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
        if (error.code === '23505') {
          return JSON.stringify({ error: `タグ「${tag_name}」は既に存在します。` })
        }
        return JSON.stringify({ error: error.message })
      }
      return JSON.stringify({ success: true, message: `タグ「${tag_name}」を作成しました。`, tag: data })
    }

    case 'delete': {
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('channel_id', channelId)
        .eq('name', tag_name)

      if (error) {
        return JSON.stringify({ error: error.message })
      }
      return JSON.stringify({ success: true, message: `タグ「${tag_name}」を削除しました。` })
    }

    case 'assign': {
      if (!friend_ids || friend_ids.length === 0) {
        return JSON.stringify({ error: '友だちIDが指定されていません。' })
      }

      const { data: tag } = await supabase
        .from('tags')
        .select('id')
        .eq('channel_id', channelId)
        .eq('name', tag_name)
        .single()

      if (!tag) {
        return JSON.stringify({ error: `タグ「${tag_name}」が見つかりません。` })
      }

      const rows = friend_ids.map((fid: string) => ({
        friend_id: fid,
        tag_id: tag.id,
      }))

      const { error } = await supabase
        .from('friend_tags')
        .upsert(rows, { onConflict: 'friend_id,tag_id' })

      if (error) {
        return JSON.stringify({ error: error.message })
      }
      return JSON.stringify({
        success: true,
        message: `${friend_ids.length}人の友だちにタグ「${tag_name}」を付与しました。`,
      })
    }

    case 'unassign': {
      if (!friend_ids || friend_ids.length === 0) {
        return JSON.stringify({ error: '友だちIDが指定されていません。' })
      }

      const { data: tag } = await supabase
        .from('tags')
        .select('id')
        .eq('channel_id', channelId)
        .eq('name', tag_name)
        .single()

      if (!tag) {
        return JSON.stringify({ error: `タグ「${tag_name}」が見つかりません。` })
      }

      const { error } = await supabase
        .from('friend_tags')
        .delete()
        .eq('tag_id', tag.id)
        .in('friend_id', friend_ids)

      if (error) {
        return JSON.stringify({ error: error.message })
      }
      return JSON.stringify({
        success: true,
        message: `${friend_ids.length}人の友だちからタグ「${tag_name}」を解除しました。`,
      })
    }

    default:
      return JSON.stringify({ error: `不明な操作: ${action}` })
  }
}

// ---------------------------------------------------------------------------
// list_tags
// ---------------------------------------------------------------------------

async function listTags(supabase: any, channelId: string): Promise<string> {
  const { data: tags, error } = await supabase
    .from('tags')
    .select('id, name, color, created_at')
    .eq('channel_id', channelId)
    .order('name')

  if (error) {
    return JSON.stringify({ error: error.message })
  }

  // Get friend counts per tag
  const tagResults = []
  for (const tag of tags ?? []) {
    const { count } = await supabase
      .from('friend_tags')
      .select('id', { count: 'exact', head: true })
      .eq('tag_id', tag.id)

    tagResults.push({
      ...tag,
      friend_count: count ?? 0,
    })
  }

  return JSON.stringify({ tags: tagResults, total: tagResults.length })
}

// ---------------------------------------------------------------------------
// create_reminder
// ---------------------------------------------------------------------------

async function createReminder(supabase: any, channelId: string, input: any): Promise<string> {
  const { name, message, send_at, target_type, tag_name, friend_ids } = input

  if (!name || !message || !send_at || !target_type) {
    return JSON.stringify({ error: '必須パラメータが不足しています（name, message, send_at, target_type）。' })
  }

  const sendDate = new Date(send_at)
  if (isNaN(sendDate.getTime())) {
    return JSON.stringify({ error: '送信日時の形式が正しくありません。ISO 8601形式で指定してください。' })
  }

  if (sendDate <= new Date()) {
    return JSON.stringify({ error: '送信日時は未来の日時を指定してください。' })
  }

  // Build target configuration
  const targetConfig: any = { type: target_type }
  if (target_type === 'tag' && tag_name) {
    const { data: tag } = await supabase
      .from('tags')
      .select('id')
      .eq('channel_id', channelId)
      .eq('name', tag_name)
      .single()

    if (!tag) {
      return JSON.stringify({ error: `タグ「${tag_name}」が見つかりません。` })
    }
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

  if (error) {
    return JSON.stringify({ error: error.message })
  }

  return JSON.stringify({
    success: true,
    message: `リマインダー「${name}」を作成しました。`,
    reminder: data,
    send_at: sendDate.toISOString(),
  })
}

// ---------------------------------------------------------------------------
// get_analytics
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

async function getAnalytics(supabase: any, channelId: string, input: any): Promise<string> {
  const { metric, period } = input
  const since = getPeriodStart(period).toISOString()

  switch (metric) {
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

      return JSON.stringify({
        metric: 'friend_growth',
        period: period ?? 'month',
        total_active: total ?? 0,
        new_friends: newFriends ?? 0,
        unfollowed: unfollowed ?? 0,
        net_growth: (newFriends ?? 0) - (unfollowed ?? 0),
      })
    }

    case 'messages_sent': {
      const { count } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', channelId)
        .eq('direction', 'outbound')
        .gte('sent_at', since)

      return JSON.stringify({
        metric: 'messages_sent',
        period: period ?? 'month',
        count: count ?? 0,
      })
    }

    case 'messages_received': {
      const { count } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', channelId)
        .eq('direction', 'inbound')
        .gte('sent_at', since)

      return JSON.stringify({
        metric: 'messages_received',
        period: period ?? 'month',
        count: count ?? 0,
      })
    }

    case 'broadcasts_sent': {
      const { count } = await supabase
        .from('broadcasts')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', channelId)
        .eq('status', 'sent')
        .gte('sent_at', since)

      return JSON.stringify({
        metric: 'broadcasts_sent',
        period: period ?? 'month',
        count: count ?? 0,
      })
    }

    case 'url_clicks': {
      const { count } = await supabase
        .from('url_clicks')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', channelId)
        .gte('clicked_at', since)

      return JSON.stringify({
        metric: 'url_clicks',
        period: period ?? 'month',
        count: count ?? 0,
      })
    }

    default:
      return JSON.stringify({ error: `不明な指標: ${metric}` })
  }
}

// ---------------------------------------------------------------------------
// create_auto_response
// ---------------------------------------------------------------------------

async function createAutoResponse(supabase: any, channelId: string, input: any): Promise<string> {
  const { name, match_type, keywords, response_message } = input

  if (!name || !match_type || !keywords || !response_message) {
    return JSON.stringify({ error: '必須パラメータが不足しています（name, match_type, keywords, response_message）。' })
  }

  // Create one auto-response rule per keyword
  const rows = keywords.map((keyword: string, i: number) => ({
    channel_id: channelId,
    name: keywords.length > 1 ? `${name} (${i + 1})` : name,
    match_type,
    keyword,
    response_messages: [{ type: 'text', text: response_message }],
    is_active: true,
    priority: 100,
  }))

  const { data, error } = await supabase
    .from('auto_responses')
    .insert(rows)
    .select()

  if (error) {
    return JSON.stringify({ error: error.message })
  }

  return JSON.stringify({
    success: true,
    message: `自動応答ルール「${name}」を作成しました（キーワード: ${keywords.join(', ')}）。`,
    rules_created: data?.length ?? 0,
  })
}
