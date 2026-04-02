import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as tiktokShop from '@/lib/tiktok/shop'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST() {
  // Get all channel_products that have inventory sync enabled and ASIN mapped
  const { data: products } = await supabase
    .from('channel_products')
    .select('*, amazon_products(id, asin, fulfillable_qty)')
    .eq('sync_inventory', true)
    .not('amazon_product_id', 'is', null)

  if (!products || products.length === 0) {
    return NextResponse.json({ synced: 0, message: '同期対象の商品がありません' })
  }

  // Group by store for efficient API calls
  const storeIds = [...new Set(products.map((p) => p.store_id))]
  const { data: stores } = await supabase
    .from('channel_stores')
    .select('*')
    .in('id', storeIds)

  const storeMap = new Map((stores ?? []).map((s: any) => [s.id, s]))

  let synced = 0
  const errors: string[] = []

  for (const product of products) {
    const store = storeMap.get(product.store_id)
    if (!store) continue

    const amazonProduct = product.amazon_products as any
    if (!amazonProduct) continue

    const fbaStock = amazonProduct.fulfillable_qty ?? 0
    const previousStock = product.current_stock

    // Skip if stock hasn't changed
    if (previousStock === fbaStock) continue

    try {
      if (store.channel === 'shopify') {
        await updateShopifyInventory(store, product, fbaStock)
      } else if (store.channel === 'tiktok') {
        await updateTikTokInventory(store, product, fbaStock)
      }

      // Update local record
      await supabase
        .from('channel_products')
        .update({
          current_stock: fbaStock,
          last_inventory_sync: new Date().toISOString(),
        })
        .eq('id', product.id)

      // Log the sync
      await supabase.from('inventory_sync_logs').insert({
        channel_product_id: product.id,
        amazon_product_id: product.amazon_product_id,
        previous_stock: previousStock,
        new_stock: fbaStock,
        source: 'fba_sync',
      })

      synced++
    } catch (err: any) {
      errors.push(`${product.title}: ${err.message}`)
    }
  }

  return NextResponse.json({ synced, errors: errors.length > 0 ? errors : undefined })
}

async function updateShopifyInventory(store: any, product: any, quantity: number) {
  // Parse channel_product_id to get variant_id
  const parts = product.channel_product_id.split('_')
  const variantId = parts[parts.length - 1]

  // First get inventory_item_id from variant
  const variantRes = await fetch(
    `https://${store.shop_domain}/admin/api/2024-01/variants/${variantId}.json`,
    {
      headers: {
        'X-Shopify-Access-Token': store.access_token,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!variantRes.ok) throw new Error(`Shopify variant fetch error: ${variantRes.status}`)
  const { variant } = await variantRes.json()
  const inventoryItemId = variant.inventory_item_id

  // Get location ID
  const locRes = await fetch(
    `https://${store.shop_domain}/admin/api/2024-01/locations.json`,
    {
      headers: {
        'X-Shopify-Access-Token': store.access_token,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!locRes.ok) throw new Error(`Shopify locations error: ${locRes.status}`)
  const { locations } = await locRes.json()
  const locationId = locations[0]?.id

  if (!locationId) throw new Error('No Shopify location found')

  // Set inventory level
  const setRes = await fetch(
    `https://${store.shop_domain}/admin/api/2024-01/inventory_levels/set.json`,
    {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': store.access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        location_id: locationId,
        inventory_item_id: inventoryItemId,
        available: quantity,
      }),
    }
  )

  if (!setRes.ok) throw new Error(`Shopify inventory set error: ${setRes.status}`)
}

async function updateTikTokInventory(store: any, product: any, quantity: number) {
  if (!store.tiktok_access_token || !store.app_key || !store.app_secret || !store.shop_id) {
    throw new Error('TikTok credentials not configured')
  }

  const parts = product.channel_product_id.split('_')
  const productId = parts[0]
  const skuId = parts[1] || parts[0]

  await tiktokShop.updateInventory(
    store.tiktok_access_token,
    store.app_key,
    store.app_secret,
    store.shop_id,
    productId,
    skuId,
    quantity
  )
}
