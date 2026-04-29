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

const CHANNEL_ID = '00000000-0000-0000-0000-000000000010'

// Batch size for profile fetching (avoid rate limits)
const PROFILE_BATCH_SIZE = 20
const PROFILE_BATCH_DELAY_MS = 500

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(request: NextRequest) {
  try {
    // Collect all follower user IDs via pagination
    const allUserIds: string[] = []
    let nextToken: string | undefined = undefined

    do {
      const response = await getLineClient().getFollowers(nextToken, 1000)

      const userIds: string[] = response.userIds ?? []
      allUserIds.push(...userIds)
      nextToken = response.next
    } while (nextToken)

    if (allUserIds.length === 0) {
      return NextResponse.json({ message: 'No followers found', imported: 0 })
    }

    // Get existing friends to avoid unnecessary profile API calls
    const { data: existingFriends } = await getSupabase()
      .from('friends')
      .select('line_user_id')
      .eq('channel_id', CHANNEL_ID)

    const existingSet = new Set(
      (existingFriends ?? []).map((f: any) => f.line_user_id)
    )

    const newUserIds = allUserIds.filter((id) => !existingSet.has(id))

    let imported = 0
    let failed = 0

    // Process in batches
    for (let i = 0; i < newUserIds.length; i += PROFILE_BATCH_SIZE) {
      const batch = newUserIds.slice(i, i + PROFILE_BATCH_SIZE)

      const results = await Promise.allSettled(
        batch.map(async (lineUserId) => {
          let displayName = 'Unknown'
          let pictureUrl: string | null = null

          try {
            const profile = await getLineClient().getProfile(lineUserId)
            displayName = profile.displayName
            pictureUrl = profile.pictureUrl ?? null
          } catch (err) {
            // Profile fetch may fail for users who blocked the bot
            console.warn(`[sync] getProfile failed for ${lineUserId}:`, err)
          }

          const { error } = await getSupabase().from('friends').upsert(
            {
              channel_id: CHANNEL_ID,
              line_user_id: lineUserId,
              display_name: displayName,
              picture_url: pictureUrl,
              status: 'active',
              followed_at: new Date().toISOString(),
            },
            { onConflict: 'channel_id,line_user_id' }
          )

          if (error) {
            throw error
          }
        })
      )

      for (const r of results) {
        if (r.status === 'fulfilled') imported++
        else failed++
      }

      // Rate limit delay between batches
      if (i + PROFILE_BATCH_SIZE < newUserIds.length) {
        await sleep(PROFILE_BATCH_DELAY_MS)
      }
    }

    return NextResponse.json({
      message: 'Sync complete',
      total_followers: allUserIds.length,
      already_exists: existingSet.size,
      imported,
      failed,
    })
  } catch (err: any) {
    console.error('[friends/sync] error:', err)
    return NextResponse.json(
      { error: err.message ?? 'Sync failed' },
      { status: 500 }
    )
  }
}
