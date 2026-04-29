import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  try {
    // Look up the tracked URL by short code
    const { data: trackedUrl, error } = await getSupabase()
      .from('tracked_urls')
      .select('id, original_url')
      .eq('short_code', code)
      .single()

    if (error || !trackedUrl) {
      return NextResponse.json({ error: 'URL not found' }, { status: 404 })
    }

    // Extract tracking info from request
    const userAgent = request.headers.get('user-agent') ?? null
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : null

    // Try to identify friend from query param
    const uid = request.nextUrl.searchParams.get('uid')
    let friendId: string | null = null

    if (uid) {
      const { data: friend } = await getSupabase()
        .from('friends')
        .select('id')
        .eq('line_user_id', uid)
        .single()

      friendId = friend?.id ?? null
    }

    // Record the click (non-blocking - don't wait for insert)
    getSupabase()
      .from('url_clicks')
      .insert({
        tracked_url_id: trackedUrl.id,
        friend_id: friendId,
        user_agent: userAgent,
        ip_address: ip,
        clicked_at: new Date().toISOString(),
      })
      .then(({ error: insertError }) => {
        if (insertError) {
          console.error('[track] click insert error:', insertError)
        }
      })

    // Redirect to the original URL
    return NextResponse.redirect(trackedUrl.original_url, 307)
  } catch (err) {
    console.error('[track] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
