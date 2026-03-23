import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { messagingApi } from '@line/bot-sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
})

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
  const { data } = await supabase
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
  const { data, error } = await supabase
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
    profile = await lineClient.getProfile(lineUserId)
  } catch (err) {
    console.error('[handleFollow] getProfile failed:', err)
    profile = { displayName: 'Unknown' }
  }

  const friend = await upsertFriend(channelId, lineUserId, profile)
  if (!friend) return

  // Enroll in active follow-triggered step sequences
  try {
    const { data: sequences } = await supabase
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

      const { error } = await supabase
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

  const { error } = await supabase
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
  let { data: friend } = await supabase
    .from('friends')
    .select('id')
    .eq('channel_id', channelId)
    .eq('line_user_id', lineUserId)
    .single()

  if (!friend) {
    // Auto-create friend record for existing followers not yet in DB
    let profile: { displayName: string; pictureUrl?: string }
    try {
      profile = await lineClient.getProfile(lineUserId)
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
  const { error: insertError } = await supabase.from('chat_messages').insert({
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

  await matchAutoResponse(channelId, messageText, event.replyToken)
}

async function matchAutoResponse(
  channelId: string,
  messageText: string,
  replyToken: string
) {
  const { data: autoResponses } = await supabase
    .from('auto_responses')
    .select('*')
    .eq('channel_id', channelId)
    .eq('is_active', true)
    .order('priority', { ascending: true })

  if (!autoResponses || autoResponses.length === 0) return

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
        // rule.response_messages is expected to be a JSON array of LINE message objects
        const messages = Array.isArray(rule.response_messages)
          ? rule.response_messages
          : [{ type: 'text', text: String(rule.response_messages) }]

        await lineClient.replyMessage({
          replyToken,
          messages,
        })
      } catch (err) {
        console.error('[matchAutoResponse] reply failed:', err)
      }
      // Stop after the first match
      return
    }
  }
}

async function handlePostback(event: any, channelId: string) {
  const lineUserId: string = event.source.userId
  if (!lineUserId) return

  const postbackData: string = event.postback?.data ?? ''

  // Parse key=value pairs from postback data
  const params = new URLSearchParams(postbackData)
  const action = params.get('action')

  // Resolve friend
  const { data: friend } = await supabase
    .from('friends')
    .select('id')
    .eq('channel_id', channelId)
    .eq('line_user_id', lineUserId)
    .single()

  // Store postback event for auditing / admin visibility
  await supabase.from('chat_messages').insert({
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
        await supabase.from('form_submissions').insert({
          form_id: formId,
          friend_id: friend.id,
          answers: fieldEntries,
        })
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
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
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
      const { data } = await supabase
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
