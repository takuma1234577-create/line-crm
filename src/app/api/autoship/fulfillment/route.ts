import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAccessToken, createFulfillmentOrder } from '@/lib/amazon/sp-api'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  const { data } = await supabase
    .from('fulfillment_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  return NextResponse.json({ logs: data ?? [] })
}

export async function POST(request: NextRequest) {
  const { order_id } = await request.json()

  // Get the order with items
  const { data: order } = await supabase
    .from('autoship_orders')
    .select('*, autoship_order_items(*)')
    .eq('id', order_id)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Find items with ASIN mappings
  const items = order.autoship_order_items || []
  const fulfillableItems: { sellerSku: string; asin: string; quantity: number; itemId: string }[] = []

  for (const item of items) {
    if (item.asin) {
      // Look up the amazon_product to get seller_sku
      const { data: amazonProduct } = await supabase
        .from('amazon_products')
        .select('seller_sku')
        .eq('asin', item.asin)
        .single()

      if (amazonProduct) {
        fulfillableItems.push({
          sellerSku: amazonProduct.seller_sku,
          asin: item.asin,
          quantity: item.quantity,
          itemId: item.id,
        })
      }
    }
  }

  if (fulfillableItems.length === 0) {
    return NextResponse.json({ error: 'ASIN紐付けされた商品がありません' }, { status: 400 })
  }

  // Get the first active Amazon SP account
  const { data: spAccount } = await supabase
    .from('amazon_sp_accounts')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!spAccount) {
    return NextResponse.json({ error: 'Amazon SP-APIアカウントが未設定です' }, { status: 400 })
  }

  try {
    const accessToken = await getAccessToken({
      refreshToken: spAccount.refresh_token,
      clientId: spAccount.client_id,
      clientSecret: spAccount.client_secret,
    })

    const mcfOrderId = `MCF-${order.external_order_id}-${Date.now()}`

    // Parse shipping address
    const addr = order.shipping_address || {}

    await createFulfillmentOrder(accessToken, {
      sellerFulfillmentOrderId: mcfOrderId,
      displayableOrderId: order.external_order_id,
      displayableOrderDate: order.ordered_at || new Date().toISOString(),
      displayableOrderComment: `${order.platform} order #${order.external_order_id}`,
      shippingSpeedCategory: 'Standard',
      destinationAddress: {
        name: addr.name || order.customer_name || '',
        addressLine1: addr.address1 || addr.line1 || addr.address || '',
        addressLine2: addr.address2 || addr.line2 || '',
        city: addr.city || '',
        stateOrRegion: addr.province || addr.state || addr.stateOrRegion || '',
        postalCode: addr.zip || addr.postal_code || addr.postalCode || '',
        countryCode: addr.country_code || addr.countryCode || 'JP',
        phone: addr.phone || order.customer_phone || '',
      },
      items: fulfillableItems.map((fi) => ({
        sellerSku: fi.sellerSku,
        sellerFulfillmentOrderItemId: fi.itemId,
        quantity: fi.quantity,
      })),
    })

    // Update order with MCF info
    await supabase
      .from('autoship_orders')
      .update({
        mcf_fulfillment_id: mcfOrderId,
        mcf_status: 'submitted',
        mcf_submitted_at: new Date().toISOString(),
        order_status: 'processing',
      })
      .eq('id', order_id)

    // Log the fulfillment
    await supabase.from('fulfillment_logs').insert({
      autoship_order_id: order_id,
      event: 'mcf_created',
      message: `MCF配送を作成: ${mcfOrderId} (${fulfillableItems.length}商品)`,
      payload: { mcfOrderId, items: fulfillableItems },
    })

    return NextResponse.json({ success: true, mcf_order_id: mcfOrderId })

  } catch (err: any) {
    // Log the error
    await supabase.from('fulfillment_logs').insert({
      autoship_order_id: order_id,
      event: 'error',
      message: `MCF配送作成エラー: ${err.message}`,
      payload: { error: err.message },
    })

    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
