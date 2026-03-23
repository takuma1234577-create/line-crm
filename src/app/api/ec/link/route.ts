import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CHANNEL_ID = '00000000-0000-0000-0000-000000000010'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  const { friendId, storeId, email, phone, customerName } = await request.json()

  if (!friendId || !storeId) {
    return NextResponse.json({ error: 'friendId and storeId required' }, { status: 400 })
  }

  // Create/update customer link
  const { data, error } = await supabase
    .from('ec_customer_links')
    .upsert(
      {
        channel_id: CHANNEL_ID,
        friend_id: friendId,
        store_id: storeId,
        customer_email: email,
        customer_phone: phone,
        customer_name: customerName,
        linked_at: new Date().toISOString(),
      },
      { onConflict: 'friend_id,store_id' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Link existing orders by email/phone
  if (email) {
    await supabase
      .from('ec_orders')
      .update({ friend_id: friendId })
      .eq('store_id', storeId)
      .eq('customer_email', email)
      .is('friend_id', null)
  }

  if (phone) {
    await supabase
      .from('ec_orders')
      .update({ friend_id: friendId })
      .eq('store_id', storeId)
      .eq('customer_phone', phone)
      .is('friend_id', null)
  }

  // Recalculate customer stats
  const { data: orderStats } = await supabase
    .from('ec_orders')
    .select('id, total_amount, ordered_at')
    .eq('friend_id', friendId)
    .eq('store_id', storeId)

  if (orderStats && orderStats.length > 0) {
    const totalOrders = orderStats.length
    const totalSpent = orderStats.reduce((sum: number, o: any) => sum + parseFloat(o.total_amount || 0), 0)
    const dates = orderStats.map((o: any) => new Date(o.ordered_at))
    const firstOrder = new Date(Math.min(...dates.map(d => d.getTime())))
    const lastOrder = new Date(Math.max(...dates.map(d => d.getTime())))

    let tier = 'new'
    if (totalOrders >= 5 || totalSpent >= 50000) tier = 'vip'
    else if (totalOrders >= 2) tier = 'repeat'

    await supabase
      .from('ec_customer_links')
      .update({
        total_orders: totalOrders,
        total_spent: totalSpent,
        first_order_at: firstOrder.toISOString(),
        last_order_at: lastOrder.toISOString(),
        customer_tier: tier,
      })
      .eq('friend_id', friendId)
      .eq('store_id', storeId)
  }

  return NextResponse.json({ success: true, data })
}
