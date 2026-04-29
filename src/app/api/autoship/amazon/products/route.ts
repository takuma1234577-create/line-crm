import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getAccessToken, getInventorySummaries, getCatalogItem } from '@/lib/amazon/sp-api'

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

export async function GET(request: NextRequest) {
  const spAccountId = request.nextUrl.searchParams.get('sp_account_id')
  if (!spAccountId) {
    return NextResponse.json({ error: 'sp_account_id is required' }, { status: 400 })
  }

  const { data } = await getSupabase()
    .from('amazon_products')
    .select('*')
    .eq('sp_account_id', spAccountId)
    .order('title')

  return NextResponse.json({ products: data ?? [] })
}

export async function POST(request: NextRequest) {
  const { sp_account_id } = await request.json()

  const { data: account } = await getSupabase()
    .from('amazon_sp_accounts')
    .select('*')
    .eq('id', sp_account_id)
    .single()

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  let synced = 0

  try {
    const accessToken = await getAccessToken({
      refreshToken: account.refresh_token,
      clientId: account.client_id,
      clientSecret: account.client_secret,
    })

    const summaries = await getInventorySummaries(accessToken, account.marketplace_id)

    for (const item of summaries) {
      // Try to get catalog info for image/price
      let imageUrl: string | null = null
      let price: number | null = null
      let title = item.productName || ''

      try {
        const catalogItem = await getCatalogItem(accessToken, account.marketplace_id, item.asin)
        const summary = catalogItem?.summaries?.[0]
        title = summary?.itemName || title
        imageUrl = catalogItem?.images?.[0]?.images?.[0]?.link || null
      } catch {
        // Catalog info is optional
      }

      const details = item.inventoryDetails || {}
      const reserved = details.reservedQuantity?.totalReservedQuantity ?? 0

      await getSupabase().from('amazon_products').upsert(
        {
          sp_account_id,
          asin: item.asin,
          seller_sku: item.sellerSku,
          title,
          image_url: imageUrl,
          fulfillable_qty: details.fulfillableQuantity ?? 0,
          inbound_qty: (details.inboundWorkingQuantity ?? 0) + (details.inboundShippedQuantity ?? 0) + (details.inboundReceivingQuantity ?? 0),
          reserved_qty: reserved,
          total_qty: item.totalQuantity ?? 0,
          condition: item.condition || 'NewItem',
          status: 'Active',
          last_inventory_sync: new Date().toISOString(),
        },
        { onConflict: 'sp_account_id,asin' }
      )

      synced++
    }

    // Update account last sync time
    await getSupabase()
      .from('amazon_sp_accounts')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', sp_account_id)

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ synced })
}
