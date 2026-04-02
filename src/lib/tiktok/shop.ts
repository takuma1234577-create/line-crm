import crypto from 'crypto'

const TIKTOK_API_BASE = 'https://open-api.tiktokglobalshop.com'

// Generate HMAC-SHA256 signature for TikTok Shop API
function generateSignature(path: string, params: Record<string, string>, appSecret: string, body?: string): string {
  const sortedKeys = Object.keys(params).filter(k => k !== 'sign' && k !== 'access_token').sort()
  let baseString = appSecret + path
  for (const key of sortedKeys) {
    baseString += key + params[key]
  }
  if (body) baseString += body
  baseString += appSecret
  return crypto.createHmac('sha256', appSecret).update(baseString).digest('hex')
}

function buildUrl(path: string, params: Record<string, string>, appKey: string, appSecret: string, accessToken?: string): string {
  const allParams: Record<string, string> = {
    ...params,
    app_key: appKey,
    timestamp: Math.floor(Date.now() / 1000).toString(),
  }
  if (accessToken) allParams.access_token = accessToken
  allParams.sign = generateSignature(path, allParams, appSecret)

  const qs = new URLSearchParams(allParams)
  return `${TIKTOK_API_BASE}${path}?${qs}`
}

// Get access token from auth code
export async function getAccessToken(appKey: string, appSecret: string, authCode: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const path = '/api/v2/token/get'
  const params: Record<string, string> = {
    app_key: appKey,
    app_secret: appSecret,
    auth_code: authCode,
    grant_type: 'authorized_code',
  }
  const url = `${TIKTOK_API_BASE}${path}?${new URLSearchParams(params)}`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`TikTok token error: ${res.status}`)
  const data = await res.json()
  if (data.code !== 0) throw new Error(`TikTok token error: ${data.message}`)
  return data.data
}

// Refresh access token
export async function refreshAccessToken(appKey: string, appSecret: string, refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const path = '/api/v2/token/refresh'
  const params: Record<string, string> = {
    app_key: appKey,
    app_secret: appSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }
  const url = `${TIKTOK_API_BASE}${path}?${new URLSearchParams(params)}`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`TikTok refresh error: ${res.status}`)
  const data = await res.json()
  if (data.code !== 0) throw new Error(`TikTok refresh error: ${data.message}`)
  return data.data
}

// Get products
export async function getProducts(accessToken: string, appKey: string, appSecret: string, shopId: string): Promise<any[]> {
  const path = `/api/products/search`
  const body = JSON.stringify({ page_size: 100 })
  const url = buildUrl(path, { shop_id: shopId }, appKey, appSecret, accessToken)

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })

  if (!res.ok) throw new Error(`TikTok products error: ${res.status}`)
  const data = await res.json()
  if (data.code !== 0) throw new Error(`TikTok products error: ${data.message}`)
  return data.data?.products ?? []
}

// Get orders
export async function getOrders(
  accessToken: string,
  appKey: string,
  appSecret: string,
  shopId: string,
  params?: { status?: string; create_time_from?: number; create_time_to?: number; page_size?: number }
): Promise<any[]> {
  const path = `/api/orders/search`
  const body = JSON.stringify({
    page_size: params?.page_size ?? 50,
    ...(params?.status && { order_status: params.status }),
    ...(params?.create_time_from && { create_time_from: params.create_time_from }),
    ...(params?.create_time_to && { create_time_to: params.create_time_to }),
  })
  const url = buildUrl(path, { shop_id: shopId }, appKey, appSecret, accessToken)

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })

  if (!res.ok) throw new Error(`TikTok orders error: ${res.status}`)
  const data = await res.json()
  if (data.code !== 0) throw new Error(`TikTok orders error: ${data.message}`)
  return data.data?.order_list ?? []
}

// Get order detail
export async function getOrderDetail(
  accessToken: string,
  appKey: string,
  appSecret: string,
  shopId: string,
  orderId: string
): Promise<any> {
  const path = `/api/orders/detail/query`
  const body = JSON.stringify({ order_id_list: [orderId] })
  const url = buildUrl(path, { shop_id: shopId }, appKey, appSecret, accessToken)

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })

  if (!res.ok) throw new Error(`TikTok order detail error: ${res.status}`)
  const data = await res.json()
  if (data.code !== 0) throw new Error(`TikTok order detail error: ${data.message}`)
  return data.data?.order_list?.[0]
}

// Update shipping info (tracking)
export async function updateShippingInfo(
  accessToken: string,
  appKey: string,
  appSecret: string,
  shopId: string,
  orderId: string,
  trackingNumber: string,
  shippingProvider: string
): Promise<void> {
  const path = `/api/fulfillment/ship`
  const body = JSON.stringify({
    order_id: orderId,
    tracking_number: trackingNumber,
    shipping_provider_id: shippingProvider,
  })
  const url = buildUrl(path, { shop_id: shopId }, appKey, appSecret, accessToken)

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })

  if (!res.ok) throw new Error(`TikTok shipping update error: ${res.status}`)
  const data = await res.json()
  if (data.code !== 0) throw new Error(`TikTok shipping update error: ${data.message}`)
}

// Update inventory
export async function updateInventory(
  accessToken: string,
  appKey: string,
  appSecret: string,
  shopId: string,
  productId: string,
  skuId: string,
  quantity: number
): Promise<void> {
  const path = `/api/products/stocks`
  const body = JSON.stringify({
    product_id: productId,
    skus: [{ id: skuId, stock_infos: [{ available_stock: quantity, warehouse_id: '' }] }],
  })
  const url = buildUrl(path, { shop_id: shopId }, appKey, appSecret, accessToken)

  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
  })

  if (!res.ok) throw new Error(`TikTok inventory update error: ${res.status}`)
  const data = await res.json()
  if (data.code !== 0) throw new Error(`TikTok inventory update error: ${data.message}`)
}
