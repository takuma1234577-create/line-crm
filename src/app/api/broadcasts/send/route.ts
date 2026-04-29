import { createServiceClient } from '@/lib/supabase/server'
import { messagingApi } from '@line/bot-sdk'

const CHANNEL_ID = '00000000-0000-0000-0000-000000000010'

let _lineClient: messagingApi.MessagingApiClient | null = null
function getLineClient() {
  if (!_lineClient) {
    _lineClient = new messagingApi.MessagingApiClient({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
    })
  }
  return _lineClient
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { message, tagId } = body as {
      message: string
      tagId?: string
    }

    if (!message) {
      return Response.json(
        { error: 'message is required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Get target friends
    let friendLineUserIds: string[] = []

    if (tagId) {
      // Get friends with the specified tag
      const { data: friendTags, error } = await supabase
        .from('friend_tags')
        .select('friends(line_user_id, status)')
        .eq('tag_id', tagId)

      if (error) {
        console.error('[broadcasts/send] friend_tags query error:', error)
        return Response.json(
          { error: 'Failed to fetch friends for tag' },
          { status: 500 }
        )
      }

      friendLineUserIds = (friendTags ?? [])
        .map((ft: any) => ft.friends)
        .filter((f: any) => f && f.status === 'active')
        .map((f: any) => f.line_user_id)
    } else {
      // Get all active friends
      const { data: friends, error } = await supabase
        .from('friends')
        .select('line_user_id')
        .eq('channel_id', CHANNEL_ID)
        .eq('status', 'active')

      if (error) {
        console.error('[broadcasts/send] friends query error:', error)
        return Response.json(
          { error: 'Failed to fetch friends' },
          { status: 500 }
        )
      }

      friendLineUserIds = (friends ?? []).map((f: any) => f.line_user_id)
    }

    if (friendLineUserIds.length === 0) {
      return Response.json(
        { error: 'No friends to send to' },
        { status: 400 }
      )
    }

    // Send via LINE multicast (max 500 per call)
    let sentCount = 0
    const batchSize = 500

    for (let i = 0; i < friendLineUserIds.length; i += batchSize) {
      const batch = friendLineUserIds.slice(i, i + batchSize)
      try {
        await getLineClient().multicast({
          to: batch,
          messages: [{ type: 'text', text: message }],
        })
        sentCount += batch.length
      } catch (lineError: any) {
        console.error('[broadcasts/send] LINE multicast error:', lineError)
        // Continue with other batches
      }
    }

    // Insert broadcast record
    const { error: insertError } = await supabase.from('broadcasts').insert({
      channel_id: CHANNEL_ID,
      messages: [{ type: 'text', text: message }],
      status: 'sent',
      total_recipients: friendLineUserIds.length,
      success_count: sentCount,
      sent_at: new Date().toISOString(),
    })

    if (insertError) {
      console.error('[broadcasts/send] insert error:', insertError)
    }

    return Response.json({ success: true, sentCount })
  } catch (err: any) {
    console.error('[broadcasts/send] error:', err)
    return Response.json(
      { error: err.message ?? 'Internal server error' },
      { status: 500 }
    )
  }
}
