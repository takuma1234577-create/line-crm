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
    const { friendId, message } = body as {
      friendId: string
      message: string
    }

    if (!friendId || !message) {
      return Response.json(
        { error: 'friendId and message are required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Get the friend's line_user_id
    const { data: friend, error: friendError } = await supabase
      .from('friends')
      .select('id, line_user_id')
      .eq('id', friendId)
      .single()

    if (friendError || !friend) {
      return Response.json(
        { error: 'Friend not found' },
        { status: 404 }
      )
    }

    // Send via LINE push message
    try {
      await getLineClient().pushMessage({
        to: friend.line_user_id,
        messages: [{ type: 'text', text: message }],
      })
    } catch (lineError: any) {
      console.error('[chat/send] LINE push error:', lineError)
      return Response.json(
        { error: 'Failed to send LINE message' },
        { status: 502 }
      )
    }

    // Insert into chat_messages with direction='outbound'
    const { error: insertError } = await supabase.from('chat_messages').insert({
      channel_id: CHANNEL_ID,
      friend_id: friend.id,
      direction: 'outbound',
      message_type: 'text',
      content: { text: message },
    })

    if (insertError) {
      console.error('[chat/send] insert error:', insertError)
      // Message was sent via LINE but failed to save locally
      return Response.json(
        { error: 'Message sent but failed to save' },
        { status: 500 }
      )
    }

    return Response.json({ success: true })
  } catch (err: any) {
    console.error('[chat/send] error:', err)
    return Response.json(
      { error: err.message ?? 'Internal server error' },
      { status: 500 }
    )
  }
}
