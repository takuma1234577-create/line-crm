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

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date().toISOString()
  let sent = 0
  let failed = 0

  try {
    // Fetch scheduled reminders that are due
    const { data: reminders, error: fetchError } = await getSupabase()
      .from('reminders')
      .select('*')
      .eq('status', 'scheduled')
      .lte('send_at', now)

    if (fetchError) {
      console.error('[reminders] fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch reminders' }, { status: 500 })
    }

    if (!reminders || reminders.length === 0) {
      return NextResponse.json({ message: 'No reminders to process', sent: 0 })
    }

    console.log(`[reminders] Processing ${reminders.length} reminders`)

    for (const reminder of reminders) {
      try {
        const messages = Array.isArray(reminder.messages)
          ? reminder.messages
          : [{ type: 'text', text: String(reminder.messages) }]

        let lineUserIds: string[] = []

        switch (reminder.target_type) {
          case 'all': {
            // Get all active friends
            const { data: friends, error } = await getSupabase()
              .from('friends')
              .select('line_user_id')
              .eq('status', 'active')
              .eq('channel_id', reminder.channel_id)

            if (error) {
              console.error('[reminders] fetch all friends error:', error)
              break
            }
            lineUserIds = (friends ?? []).map((f: any) => f.line_user_id)
            break
          }

          case 'tag': {
            // Get friends with specific tag
            const { data: taggedFriends, error } = await getSupabase()
              .from('friend_tags')
              .select('friend:friends(line_user_id)')
              .eq('tag_id', reminder.target_id)

            if (error) {
              console.error('[reminders] fetch tagged friends error:', error)
              break
            }
            lineUserIds = (taggedFriends ?? [])
              .map((ft: any) => ft.friend?.line_user_id)
              .filter(Boolean)
            break
          }

          case 'friends': {
            // Use provided friend_ids
            const friendIds: string[] = Array.isArray(reminder.target_ids)
              ? reminder.target_ids
              : []

            if (friendIds.length > 0) {
              const { data: friends, error } = await getSupabase()
                .from('friends')
                .select('line_user_id')
                .in('id', friendIds)

              if (error) {
                console.error('[reminders] fetch specific friends error:', error)
                break
              }
              lineUserIds = (friends ?? []).map((f: any) => f.line_user_id)
            }
            break
          }

          case 'reservation': {
            // Get friends from a specific reservation slot
            const { data: reservations, error } = await getSupabase()
              .from('reservations')
              .select('friend:friends(line_user_id)')
              .eq('slot_id', reminder.target_id)
              .eq('status', 'confirmed')

            if (error) {
              console.error('[reminders] fetch reservation friends error:', error)
              break
            }
            lineUserIds = (reservations ?? [])
              .map((r: any) => r.friend?.line_user_id)
              .filter(Boolean)
            break
          }

          default:
            console.warn(`[reminders] unknown target_type: ${reminder.target_type}`)
            break
        }

        if (lineUserIds.length === 0) {
          console.warn(`[reminders] no recipients for reminder ${reminder.id}`)
          // Still mark as sent to avoid re-processing
          await getSupabase()
            .from('reminders')
            .update({ status: 'sent', sent_at: now })
            .eq('id', reminder.id)
          sent++
          continue
        }

        // LINE multicast supports up to 500 recipients at a time
        const chunks: string[][] = []
        for (let i = 0; i < lineUserIds.length; i += 500) {
          chunks.push(lineUserIds.slice(i, i + 500))
        }

        for (const chunk of chunks) {
          await getLineClient().multicast({
            to: chunk,
            messages,
          })
        }

        // Update reminder status
        await getSupabase()
          .from('reminders')
          .update({
            status: 'sent',
            sent_at: now,
            recipient_count: lineUserIds.length,
          })
          .eq('id', reminder.id)

        sent++
        console.log(
          `[reminders] Sent reminder ${reminder.id} to ${lineUserIds.length} recipients`
        )
      } catch (err) {
        console.error(`[reminders] error processing reminder ${reminder.id}:`, err)
        failed++

        // Mark as failed to avoid infinite retries
        await getSupabase()
          .from('reminders')
          .update({ status: 'failed', error_message: String(err) })
          .eq('id', reminder.id)
      }
    }

    console.log(`[reminders] Done: sent=${sent}, failed=${failed}`)

    return NextResponse.json({
      message: 'Reminder delivery completed',
      sent,
      failed,
    })
  } catch (err) {
    console.error('[reminders] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
