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

// Schedule followup jobs for a new order
export async function scheduleFollowups(orderId: string) {
  const { data: order } = await getSupabase()
    .from('ec_orders')
    .select('*, ec_order_items(*), friends(id, line_user_id, display_name)')
    .eq('id', orderId)
    .single()

  if (!order || !order.friend_id || !order.friends) return

  const items = order.ec_order_items ?? []
  const productNames = items.map((i: any) => i.product_name).join('、')
  const friendName = order.friends.display_name ?? 'お客様'
  const channelId = order.channel_id

  const jobs: any[] = []
  const now = new Date()

  // 1. Delivery followup: 配達予定 + 3日後
  jobs.push({
    channel_id: channelId,
    friend_id: order.friend_id,
    order_id: orderId,
    job_type: 'delivery_followup',
    scheduled_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    message: `${friendName}様、先日ご注文いただいた「${productNames}」は無事届きましたでしょうか？\n\n何かお気づきの点がございましたら、お気軽にメッセージください😊`,
    status: 'scheduled',
  })

  // 2. Product followup: 到着 + 7日後
  jobs.push({
    channel_id: channelId,
    friend_id: order.friend_id,
    order_id: orderId,
    job_type: 'product_followup',
    scheduled_at: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    message: `${friendName}様、「${productNames}」のご使用感はいかがでしょうか？\n\nご不明な点やご要望がございましたら、いつでもお声がけください✨`,
    status: 'scheduled',
  })

  // 3. Review request: 到着 + 14日後 (Amazon規約配慮: 直接レビューを求めない)
  if (order.platform === 'amazon') {
    jobs.push({
      channel_id: channelId,
      friend_id: order.friend_id,
      order_id: orderId,
      job_type: 'review_request',
      scheduled_at: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString(),
      message: `${friendName}様、「${productNames}」をご利用いただきありがとうございます。\n\nお客様のご感想は、私たちの商品改善に大変参考になります。Amazonの注文履歴からご感想をお寄せいただけますと幸いです🙏\n\n今後ともよろしくお願いいたします。`,
      status: 'scheduled',
    })
  } else {
    jobs.push({
      channel_id: channelId,
      friend_id: order.friend_id,
      order_id: orderId,
      job_type: 'review_request',
      scheduled_at: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString(),
      message: `${friendName}様、「${productNames}」のご使用ありがとうございます！\n\nもしよろしければ、レビューをいただけると大変嬉しいです⭐\n\nいただいたお声は今後の商品開発に活かしてまいります。`,
      status: 'scheduled',
    })
  }

  // 4. Repeat suggestion: 30日後
  jobs.push({
    channel_id: channelId,
    friend_id: order.friend_id,
    order_id: orderId,
    job_type: 'repeat_suggestion',
    scheduled_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    message: `${friendName}様、「${productNames}」はそろそろなくなる頃でしょうか？\n\nリピートのご注文もお待ちしております😊\nお得なクーポンもご用意しておりますので、お気軽にお問い合わせください！`,
    status: 'scheduled',
  })

  await getSupabase().from('ec_followup_jobs').insert(jobs)
}

// Process pending followup jobs (called by cron)
export async function processFollowupJobs(): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0

  const { data: jobs } = await getSupabase()
    .from('ec_followup_jobs')
    .select('*, friends(line_user_id)')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .limit(50)

  if (!jobs || jobs.length === 0) return { sent: 0, failed: 0 }

  for (const job of jobs) {
    try {
      const lineUserId = (job as any).friends?.line_user_id
      if (!lineUserId) {
        await getSupabase().from('ec_followup_jobs').update({ status: 'failed' }).eq('id', job.id)
        failed++
        continue
      }

      // Check if order was cancelled
      const { data: order } = await getSupabase()
        .from('ec_orders')
        .select('order_status')
        .eq('id', job.order_id)
        .single()

      if (order?.order_status === 'cancelled' || order?.order_status === 'returned') {
        await getSupabase().from('ec_followup_jobs').update({ status: 'cancelled' }).eq('id', job.id)
        continue
      }

      // Send LINE message
      await getLineClient().pushMessage({
        to: lineUserId,
        messages: [{ type: 'text', text: job.message }],
      })

      // Store in chat_messages
      await getSupabase().from('chat_messages').insert({
        channel_id: job.channel_id,
        friend_id: job.friend_id,
        direction: 'outbound',
        message_type: 'text',
        content: { text: job.message },
      })

      await getSupabase()
        .from('ec_followup_jobs')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', job.id)

      sent++
    } catch (err) {
      console.error('[followup] job error:', err)
      await getSupabase().from('ec_followup_jobs').update({ status: 'failed' }).eq('id', job.id)
      failed++
    }
  }

  return { sent, failed }
}
