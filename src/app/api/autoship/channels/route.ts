import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  const { data } = await supabase
    .from('channel_stores')
    .select('*')
    .order('created_at', { ascending: false })

  return NextResponse.json({ stores: data ?? [] })
}

export async function POST(request: NextRequest) {
  const { channel, store_name, shop_domain, access_token, app_key, app_secret, shop_id } = await request.json()

  if (!channel || !store_name) {
    return NextResponse.json({ error: 'channel and store_name are required' }, { status: 400 })
  }

  const insertData: Record<string, any> = {
    channel,
    store_name,
    is_active: true,
  }

  if (channel === 'shopify') {
    if (!shop_domain || !access_token) {
      return NextResponse.json({ error: 'Shopify requires shop_domain and access_token' }, { status: 400 })
    }
    insertData.shop_domain = shop_domain
    insertData.access_token = access_token
  } else if (channel === 'tiktok') {
    if (!app_key || !app_secret) {
      return NextResponse.json({ error: 'TikTok requires app_key and app_secret' }, { status: 400 })
    }
    insertData.app_key = app_key
    insertData.app_secret = app_secret
    insertData.shop_id = shop_id || null
    insertData.tiktok_access_token = access_token || null
  }

  const { data, error } = await supabase
    .from('channel_stores')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ store: data })
}
