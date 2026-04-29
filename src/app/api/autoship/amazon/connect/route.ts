import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getAccessToken } from '@/lib/amazon/sp-api'

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

export async function POST(request: NextRequest) {
  const { account_name, seller_id, marketplace_id, refresh_token, client_id, client_secret } = await request.json()

  if (!account_name || !seller_id || !refresh_token || !client_id || !client_secret) {
    return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
  }

  // Validate credentials by getting an access token
  try {
    await getAccessToken({ refreshToken: refresh_token, clientId: client_id, clientSecret: client_secret })
  } catch (err: any) {
    return NextResponse.json({ error: 'API認証に失敗しました: ' + err.message }, { status: 400 })
  }

  const { data, error } = await getSupabase()
    .from('amazon_sp_accounts')
    .insert({
      account_name,
      seller_id,
      marketplace_id: marketplace_id || 'A1VC38T7YXB528',
      refresh_token,
      client_id,
      client_secret,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, account: { id: data.id, account_name: data.account_name } })
}
