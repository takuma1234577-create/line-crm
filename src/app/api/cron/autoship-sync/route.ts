import { NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getAccessToken, getInventorySummaries, getFulfillmentOrder } from '@/lib/amazon/sp-api'
import * as tiktokShop from '@/lib/tiktok/shop'

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

export async function GET() {
  const results: Record<string, any> = {}

  try {
    // 1. Sync Amazon inventory for all active accounts
    results.inventory = await syncAmazonInventory()

    // 2. Check for new orders from channel stores
    results.orders = await syncChannelOrders()

    // 3. Auto-fulfill new paid orders with ASIN-mapped items
    results.fulfillment = await autoFulfillOrders()

    // 4. Sync FBA inventory to channels (stop selling if stock = 0)
    results.inventorySync = await syncInventoryToChannels()

    // 5. Check fulfillment status and update tracking
    results.tracking = await updateTrackingInfo()

  } catch (err: any) {
    return NextResponse.json({ error: err.message, partial: results }, { status: 500 })
  }

  return NextResponse.json({ success: true, results })
}

// Step 1: Sync Amazon FBA inventory
async function syncAmazonInventory() {
  const { data: accounts } = await getSupabase()
    .from('amazon_sp_accounts')
    .select('*')
    .eq('is_active', true)

  let totalSynced = 0

  for (const account of accounts ?? []) {
    try {
      const accessToken = await getAccessToken({
        refreshToken: account.refresh_token,
        clientId: account.client_id,
        clientSecret: account.client_secret,
      })

      const summaries = await getInventorySummaries(accessToken, account.marketplace_id)

      for (const item of summaries) {
        const details = item.inventoryDetails || {}
        await getSupabase().from('amazon_products').upsert(
          {
            sp_account_id: account.id,
            asin: item.asin,
            seller_sku: item.sellerSku,
            title: item.productName || '',
            fulfillable_qty: details.fulfillableQuantity ?? 0,
            inbound_qty: (details.inboundWorkingQuantity ?? 0) + (details.inboundShippedQuantity ?? 0) + (details.inboundReceivingQuantity ?? 0),
            reserved_qty: details.reservedQuantity?.totalReservedQuantity ?? 0,
            total_qty: item.totalQuantity ?? 0,
            last_inventory_sync: new Date().toISOString(),
          },
          { onConflict: 'sp_account_id,asin' }
        )
        totalSynced++
      }

      await getSupabase().from('amazon_sp_accounts').update({ last_synced_at: new Date().toISOString() }).eq('id', account.id)
    } catch (err: any) {
      console.error(`[autoship-sync] inventory error for ${account.account_name}:`, err.message)
    }
  }

  return { synced: totalSynced }
}

// Step 2: Sync orders from Shopify/TikTok
async function syncChannelOrders() {
  const { data: stores } = await getSupabase()
    .from('channel_stores')
    .select('*')
    .eq('is_active', true)

  let totalSynced = 0

  for (const store of stores ?? []) {
    try {
      if (store.channel === 'shopify') {
        totalSynced += await syncShopifyOrders(store)
      } else if (store.channel === 'tiktok') {
        totalSynced += await syncTikTokOrders(store)
      }
    } catch (err: any) {
      console.error(`[autoship-sync] order sync error for ${store.store_name}:`, err.message)
    }
  }

  return { synced: totalSynced }
}

async function syncShopifyOrders(store: any): Promise<number> {
  const since = store.last_synced_at ? `&created_at_min=${store.last_synced_at}` : ''
  const res = await fetch(
    `https://${store.shop_domain}/admin/api/2024-01/orders.json?status=any&limit=50${since}`,
    { headers: { 'X-Shopify-Access-Token': store.access_token } }
  )

  if (!res.ok) return 0
  const { orders } = await res.json()
  let synced = 0

  for (const order of orders ?? []) {
    // Check if order items have ASIN mappings
    const { error } = await getSupabase().from('autoship_orders').upsert(
      {
        store_id: store.id,
        external_order_id: String(order.id),
        platform: 'shopify',
        order_status: order.financial_status === 'paid' && !order.fulfillment_status ? 'confirmed' : 'pending',
        payment_status: order.financial_status === 'paid' ? 'paid' : 'unpaid',
        total_amount: parseFloat(order.total_price),
        currency: order.currency,
        customer_name: order.customer ? `${order.customer.last_name || ''} ${order.customer.first_name || ''}`.trim() : '',
        customer_email: order.email,
        customer_phone: order.phone,
        shipping_address: order.shipping_address,
        raw_data: order,
        ordered_at: order.created_at,
      },
      { onConflict: 'store_id,external_order_id' }
    )

    if (!error) {
      // Upsert order items with ASIN from channel_products mapping
      const { data: ecOrder } = await getSupabase()
        .from('autoship_orders')
        .select('id')
        .eq('store_id', store.id)
        .eq('external_order_id', String(order.id))
        .single()

      if (ecOrder) {
        for (const item of order.line_items ?? []) {
          // Look up ASIN from channel_products mapping
          const { data: channelProduct } = await getSupabase()
            .from('channel_products')
            .select('amazon_asin')
            .eq('store_id', store.id)
            .eq('channel_sku', item.sku)
            .single()

          await getSupabase().from('autoship_order_items').upsert(
            {
              order_id: ecOrder.id,
              external_product_id: String(item.product_id),
              product_name: item.title,
              variant_name: item.variant_title,
              sku: item.sku,
              asin: channelProduct?.amazon_asin || null,
              quantity: item.quantity,
              unit_price: parseFloat(item.price),
              total_price: parseFloat(item.price) * item.quantity,
            },
            { onConflict: 'order_id,external_product_id' }
          )
        }
      }
      synced++
    }
  }

  await getSupabase().from('channel_stores').update({ last_synced_at: new Date().toISOString() }).eq('id', store.id)
  return synced
}

async function syncTikTokOrders(store: any): Promise<number> {
  if (!store.tiktok_access_token || !store.app_key || !store.app_secret || !store.shop_id) return 0

  const orders = await tiktokShop.getOrders(
    store.tiktok_access_token,
    store.app_key,
    store.app_secret,
    store.shop_id,
    { status: 'AWAITING_SHIPMENT' }
  )

  let synced = 0

  for (const order of orders) {
    const detail = await tiktokShop.getOrderDetail(
      store.tiktok_access_token, store.app_key, store.app_secret, store.shop_id, order.order_id
    )

    if (!detail) continue

    const addr = detail.recipient_address || {}

    await getSupabase().from('autoship_orders').upsert(
      {
        store_id: store.id,
        external_order_id: order.order_id,
        platform: 'tiktok',
        order_status: 'confirmed',
        payment_status: 'paid',
        total_amount: parseFloat(detail.payment?.total_amount || '0'),
        currency: detail.payment?.currency || 'JPY',
        customer_name: addr.name || '',
        customer_phone: addr.phone || '',
        shipping_address: addr,
        raw_data: detail,
        ordered_at: new Date((detail.create_time || 0) * 1000).toISOString(),
      },
      { onConflict: 'store_id,external_order_id' }
    )

    // Upsert items
    const { data: ecOrder } = await getSupabase()
      .from('autoship_orders')
      .select('id')
      .eq('store_id', store.id)
      .eq('external_order_id', order.order_id)
      .single()

    if (ecOrder) {
      for (const item of detail.item_list ?? []) {
        const { data: channelProduct } = await getSupabase()
          .from('channel_products')
          .select('amazon_asin')
          .eq('store_id', store.id)
          .eq('channel_sku', item.seller_sku)
          .single()

        await getSupabase().from('autoship_order_items').upsert(
          {
            order_id: ecOrder.id,
            external_product_id: item.product_id,
            product_name: item.product_name,
            sku: item.seller_sku,
            asin: channelProduct?.amazon_asin || null,
            quantity: item.quantity || 1,
            unit_price: parseFloat(item.sale_price || '0'),
            total_price: parseFloat(item.sale_price || '0') * (item.quantity || 1),
          },
          { onConflict: 'order_id,external_product_id' }
        )
      }
    }

    synced++
  }

  await getSupabase().from('channel_stores').update({ last_synced_at: new Date().toISOString() }).eq('id', store.id)
  return synced
}

// Step 3: Auto-fulfill confirmed orders
async function autoFulfillOrders() {
  const { data: orders } = await getSupabase()
    .from('autoship_orders')
    .select('*, autoship_order_items(*)')
    .eq('order_status', 'confirmed')
    .eq('payment_status', 'paid')
    .is('mcf_fulfillment_id', null)
    .limit(20)

  let fulfilled = 0

  for (const order of orders ?? []) {
    // Check if all items have ASINs
    const items = order.autoship_order_items || []
    const allHaveAsin = items.length > 0 && items.every((i: any) => i.asin)
    if (!allHaveAsin) continue

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL ? '' : 'http://localhost:3000'}/api/autoship/fulfillment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: order.id }),
      })

      if (res.ok) fulfilled++
    } catch (err: any) {
      console.error(`[autoship-sync] auto-fulfill error for order ${order.id}:`, err.message)
    }
  }

  return { fulfilled }
}

// Step 4: Sync inventory to channels
async function syncInventoryToChannels() {
  const { data: products } = await getSupabase()
    .from('channel_products')
    .select('*, amazon_products(fulfillable_qty)')
    .eq('sync_inventory', true)
    .not('amazon_product_id', 'is', null)

  let synced = 0

  for (const product of products ?? []) {
    const fbaStock = (product.amazon_products as any)?.fulfillable_qty ?? 0
    if (product.current_stock === fbaStock) continue

    try {
      const store = await getSupabase().from('channel_stores').select('*').eq('id', product.store_id).single()
      if (!store.data) continue

      if (store.data.channel === 'shopify') {
        // Simplified - actual implementation in inventory-sync route
        await getSupabase().from('channel_products').update({ current_stock: fbaStock, last_inventory_sync: new Date().toISOString() }).eq('id', product.id)
      }

      await getSupabase().from('inventory_sync_logs').insert({
        channel_product_id: product.id,
        amazon_product_id: product.amazon_product_id,
        previous_stock: product.current_stock,
        new_stock: fbaStock,
        source: 'cron_sync',
      })

      synced++
    } catch (err: any) {
      console.error(`[autoship-sync] inventory sync error for ${product.title}:`, err.message)
    }
  }

  return { synced }
}

// Step 5: Check MCF fulfillment status and update tracking
async function updateTrackingInfo() {
  const { data: pendingOrders } = await getSupabase()
    .from('autoship_orders')
    .select('*')
    .not('mcf_fulfillment_id', 'is', null)
    .in('mcf_status', ['submitted', 'processing'])
    .limit(50)

  const { data: spAccount } = await getSupabase()
    .from('amazon_sp_accounts')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!spAccount || !pendingOrders?.length) return { updated: 0 }

  let updated = 0

  try {
    const accessToken = await getAccessToken({
      refreshToken: spAccount.refresh_token,
      clientId: spAccount.client_id,
      clientSecret: spAccount.client_secret,
    })

    for (const order of pendingOrders) {
      try {
        const fulfillment = await getFulfillmentOrder(accessToken, order.mcf_fulfillment_id)

        const newStatus = fulfillment.fulfillmentOrderStatus?.toLowerCase() || order.mcf_status
        const shipment = fulfillment.fulfillmentShipments?.[0]
        const pkg = shipment?.fulfillmentShipmentPackage?.[0]
        const trackingNumber = pkg?.trackingNumber
        const carrier = pkg?.carrierCode

        if (newStatus !== order.mcf_status || trackingNumber) {
          const updateData: Record<string, any> = { mcf_status: newStatus }

          if (trackingNumber) {
            updateData.tracking_number = trackingNumber
            updateData.carrier = carrier
          }

          if (newStatus === 'complete' || shipment?.fulfillmentShipmentStatus === 'SHIPPED') {
            updateData.order_status = 'shipped'
            updateData.shipped_at = new Date().toISOString()

            // Update tracking on the channel platform
            const store = await getSupabase().from('channel_stores').select('*').eq('id', order.store_id).single()
            if (store.data && trackingNumber) {
              await updateChannelTracking(store.data, order, trackingNumber, carrier || '')
            }
          }

          await getSupabase().from('autoship_orders').update(updateData).eq('id', order.id)

          await getSupabase().from('fulfillment_logs').insert({
            autoship_order_id: order.id,
            event: trackingNumber ? 'tracking_updated' : 'processing',
            message: trackingNumber
              ? `追跡番号更新: ${trackingNumber} (${carrier})`
              : `ステータス更新: ${newStatus}`,
            payload: { fulfillment, trackingNumber, carrier },
          })

          updated++
        }
      } catch (err: any) {
        console.error(`[autoship-sync] tracking update error for ${order.mcf_fulfillment_id}:`, err.message)
      }
    }
  } catch (err: any) {
    console.error('[autoship-sync] tracking auth error:', err.message)
  }

  return { updated }
}

async function updateChannelTracking(store: any, order: any, trackingNumber: string, carrier: string) {
  try {
    if (store.channel === 'shopify') {
      // Create fulfillment in Shopify
      await fetch(
        `https://${store.shop_domain}/admin/api/2024-01/orders/${order.external_order_id}/fulfillments.json`,
        {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': store.access_token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fulfillment: {
              tracking_number: trackingNumber,
              tracking_company: carrier,
              notify_customer: true,
            },
          }),
        }
      )
    } else if (store.channel === 'tiktok' && store.tiktok_access_token) {
      await tiktokShop.updateShippingInfo(
        store.tiktok_access_token,
        store.app_key,
        store.app_secret,
        store.shop_id,
        order.external_order_id,
        trackingNumber,
        carrier
      )
    }
  } catch (err: any) {
    console.error(`[autoship-sync] channel tracking update error:`, err.message)
  }
}
