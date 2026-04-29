import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
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

export async function GET(request: NextRequest) {
  const storeId = request.nextUrl.searchParams.get('store_id')

  let query = getSupabase()
    .from('channel_products')
    .select('*, amazon_products(id, asin, title, fulfillable_qty)')
    .order('title')

  if (storeId) query = query.eq('store_id', storeId)

  const { data } = await query
  return NextResponse.json({ products: data ?? [] })
}

// Sync products from a channel store
export async function POST(request: NextRequest) {
  const { store_id } = await request.json()

  const { data: store } = await getSupabase()
    .from('channel_stores')
    .select('*')
    .eq('id', store_id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  let synced = 0

  try {
    if (store.channel === 'shopify') {
      synced = await syncShopifyProducts(store)
    } else if (store.channel === 'tiktok') {
      synced = await syncTikTokProducts(store)
    } else {
      return NextResponse.json({ error: 'Unsupported channel' }, { status: 400 })
    }

    await getSupabase()
      .from('channel_stores')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', store_id)

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ synced })
}

// Update ASIN mapping
export async function PUT(request: NextRequest) {
  const { channel_product_id, amazon_product_id, amazon_asin } = await request.json()

  if (!channel_product_id || !amazon_product_id || !amazon_asin) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { error } = await getSupabase()
    .from('channel_products')
    .update({
      amazon_product_id,
      amazon_asin,
      sync_inventory: true,
    })
    .eq('id', channel_product_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

async function syncShopifyProducts(store: any): Promise<number> {
  const res = await fetch(
    `https://${store.shop_domain}/admin/api/2024-01/products.json?limit=250`,
    {
      headers: {
        'X-Shopify-Access-Token': store.access_token,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!res.ok) throw new Error(`Shopify API error: ${res.status}`)

  const { products } = await res.json()
  let synced = 0

  for (const product of products) {
    for (const variant of product.variants) {
      await getSupabase().from('channel_products').upsert(
        {
          store_id: store.id,
          channel: 'shopify',
          channel_product_id: `${product.id}_${variant.id}`,
          channel_sku: variant.sku || null,
          title: variant.title === 'Default Title' ? product.title : `${product.title} - ${variant.title}`,
          image_url: product.image?.src || null,
          price: parseFloat(variant.price) || null,
          current_stock: variant.inventory_quantity ?? null,
        },
        { onConflict: 'store_id,channel_product_id' }
      )
      synced++
    }
  }

  return synced
}

async function syncTikTokProducts(store: any): Promise<number> {
  if (!store.tiktok_access_token || !store.app_key || !store.app_secret || !store.shop_id) {
    throw new Error('TikTok credentials not configured')
  }

  const products = await tiktokShop.getProducts(
    store.tiktok_access_token,
    store.app_key,
    store.app_secret,
    store.shop_id
  )

  let synced = 0

  for (const product of products) {
    const skus = product.skus || [{ id: product.id, seller_sku: '', stock_infos: [] }]
    for (const sku of skus) {
      const stock = sku.stock_infos?.[0]?.available_stock ?? null
      await getSupabase().from('channel_products').upsert(
        {
          store_id: store.id,
          channel: 'tiktok',
          channel_product_id: `${product.id}_${sku.id}`,
          channel_sku: sku.seller_sku || null,
          title: product.product_name || product.title || '',
          image_url: product.images?.[0]?.url || null,
          price: sku.price?.sale_price ? parseFloat(sku.price.sale_price) : null,
          current_stock: stock,
        },
        { onConflict: 'store_id,channel_product_id' }
      )
      synced++
    }
  }

  return synced
}
