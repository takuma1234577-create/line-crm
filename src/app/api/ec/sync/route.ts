import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncShopifyOrders } from '@/lib/ec/shopify'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  const { storeId } = await request.json()

  const { data: store } = await supabase
    .from('ec_stores')
    .select('*')
    .eq('id', storeId)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  let result
  if (store.platform === 'shopify') {
    result = await syncShopifyOrders(store.id, store.shopify_domain, store.shopify_access_token)
  } else {
    return NextResponse.json({ error: 'Platform not yet supported' }, { status: 400 })
  }

  return NextResponse.json(result)
}
