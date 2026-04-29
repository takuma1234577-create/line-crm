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

const CHANNEL_ID = '00000000-0000-0000-0000-000000000010'

interface ShopifyOrder {
  id: number
  order_number: number
  email: string
  phone: string
  total_price: string
  currency: string
  financial_status: string
  fulfillment_status: string | null
  customer: { id: number; email: string; first_name: string; last_name: string; phone: string }
  line_items: { id: number; product_id: number; title: string; variant_title: string; sku: string; quantity: number; price: string; image?: { src: string } }[]
  shipping_address: any
  created_at: string
  fulfillments: { tracking_number: string; tracking_company: string; created_at: string }[]
}

// Sync orders from Shopify
export async function syncShopifyOrders(storeId: string, domain: string, accessToken: string): Promise<{ synced: number; errors: number }> {
  let synced = 0
  let errors = 0

  try {
    // Get last sync time
    const { data: store } = await getSupabase()
      .from('ec_stores')
      .select('last_synced_at')
      .eq('id', storeId)
      .single()

    const since = store?.last_synced_at
      ? `&created_at_min=${store.last_synced_at}`
      : ''

    const res = await fetch(
      `https://${domain}/admin/api/2024-01/orders.json?status=any&limit=50${since}`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!res.ok) throw new Error(`Shopify API error: ${res.status}`)

    const { orders } = (await res.json()) as { orders: ShopifyOrder[] }

    for (const order of orders) {
      try {
        // Upsert order
        const { data: ecOrder, error: orderError } = await getSupabase()
          .from('ec_orders')
          .upsert(
            {
              channel_id: CHANNEL_ID,
              store_id: storeId,
              external_order_id: String(order.id),
              platform: 'shopify',
              order_status: mapShopifyStatus(order.fulfillment_status, order.financial_status),
              payment_status: order.financial_status === 'paid' ? 'paid' : 'unpaid',
              total_amount: parseFloat(order.total_price),
              currency: order.currency,
              customer_name: order.customer
                ? `${order.customer.last_name} ${order.customer.first_name}`
                : '',
              customer_email: order.email,
              customer_phone: order.phone,
              shipping_address: order.shipping_address,
              tracking_number: order.fulfillments?.[0]?.tracking_number,
              carrier: order.fulfillments?.[0]?.tracking_company,
              shipped_at: order.fulfillments?.[0]?.created_at,
              raw_data: order,
              ordered_at: order.created_at,
            },
            { onConflict: 'store_id,external_order_id' }
          )
          .select()
          .single()

        if (orderError) {
          console.error('[shopify] order upsert error:', orderError)
          errors++
          continue
        }

        // Upsert order items
        if (ecOrder) {
          for (const item of order.line_items) {
            await getSupabase().from('ec_order_items').upsert(
              {
                order_id: ecOrder.id,
                external_product_id: String(item.product_id),
                product_name: item.title,
                variant_name: item.variant_title,
                sku: item.sku,
                quantity: item.quantity,
                unit_price: parseFloat(item.price),
                total_price: parseFloat(item.price) * item.quantity,
                image_url: (item as any).image?.src,
              },
              { onConflict: 'order_id,external_product_id' }
            )
          }

          // Try to link order to LINE friend by email or phone
          await linkOrderToFriend(ecOrder.id, order.email, order.phone, storeId)
        }

        synced++
      } catch (err) {
        console.error('[shopify] order processing error:', err)
        errors++
      }
    }

    // Update last_synced_at
    await getSupabase()
      .from('ec_stores')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', storeId)

  } catch (err) {
    console.error('[shopify] sync error:', err)
    errors++
  }

  return { synced, errors }
}

function mapShopifyStatus(fulfillment: string | null, financial: string): string {
  if (financial === 'refunded') return 'returned'
  if (fulfillment === 'fulfilled') return 'delivered'
  if (fulfillment === 'partial') return 'shipped'
  if (financial === 'paid') return 'confirmed'
  return 'pending'
}

// Link an order to a LINE friend by email or phone match
async function linkOrderToFriend(orderId: string, email: string, phone: string, storeId: string) {
  // Try to find friend by email in custom_fields or by customer link
  let friendId: string | null = null

  if (email) {
    const { data: link } = await getSupabase()
      .from('ec_customer_links')
      .select('friend_id')
      .eq('customer_email', email)
      .eq('store_id', storeId)
      .single()

    friendId = link?.friend_id ?? null
  }

  if (!friendId && phone) {
    const { data: link } = await getSupabase()
      .from('ec_customer_links')
      .select('friend_id')
      .eq('customer_phone', phone)
      .eq('store_id', storeId)
      .single()

    friendId = link?.friend_id ?? null
  }

  if (friendId) {
    await getSupabase()
      .from('ec_orders')
      .update({ friend_id: friendId })
      .eq('id', orderId)
  }
}

export async function getShopifyOrderTracking(domain: string, accessToken: string, orderId: string): Promise<any> {
  const res = await fetch(
    `https://${domain}/admin/api/2024-01/orders/${orderId}/fulfillments.json`,
    {
      headers: { 'X-Shopify-Access-Token': accessToken },
    }
  )
  if (!res.ok) return null
  return res.json()
}
