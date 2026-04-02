const SP_API_ENDPOINT = 'https://sellingpartnerapi-fe.amazon.com'
const LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token'

export interface SpApiCredentials {
  refreshToken: string
  clientId: string
  clientSecret: string
}

export interface InventorySummary {
  asin: string
  fnSku: string
  sellerSku: string
  condition: string
  inventoryDetails: {
    fulfillableQuantity: number
    inboundWorkingQuantity: number
    inboundShippedQuantity: number
    inboundReceivingQuantity: number
    reservedQuantity: {
      totalReservedQuantity: number
      pendingCustomerOrderQuantity: number
      pendingTransshipmentQuantity: number
      fcProcessingQuantity: number
    }
  }
  lastUpdatedTime: string
  productName: string
  totalQuantity: number
}

export interface FulfillmentOrderItem {
  sellerSku: string
  sellerFulfillmentOrderItemId: string
  quantity: number
}

export interface DestinationAddress {
  name: string
  addressLine1: string
  addressLine2?: string
  city: string
  stateOrRegion: string
  postalCode: string
  countryCode: string
  phone?: string
}

export interface CreateFulfillmentOrderParams {
  sellerFulfillmentOrderId: string
  displayableOrderId: string
  displayableOrderDate: string
  displayableOrderComment: string
  shippingSpeedCategory: 'Standard' | 'Expedited' | 'Priority'
  destinationAddress: DestinationAddress
  items: FulfillmentOrderItem[]
  notificationEmails?: string[]
}

export interface FulfillmentOrderStatus {
  sellerFulfillmentOrderId: string
  fulfillmentOrderStatus: string
  statusUpdatedDate: string
  fulfillmentShipments?: {
    amazonShipmentId: string
    fulfillmentShipmentStatus: string
    shippingDate?: string
    estimatedArrivalDate?: string
    fulfillmentShipmentPackage?: {
      packageNumber: number
      carrierCode: string
      trackingNumber: string
    }[]
  }[]
}

// Get LWA access token
export async function getAccessToken(creds: SpApiCredentials): Promise<string> {
  const res = await fetch(LWA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: creds.refreshToken,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LWA token error: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.access_token
}

// Get FBA inventory summaries
export async function getInventorySummaries(
  accessToken: string,
  marketplaceId: string,
  granularityType: string = 'Marketplace',
  sellerSkus?: string[]
): Promise<InventorySummary[]> {
  const params = new URLSearchParams({
    details: 'true',
    granularityType,
    granularityId: marketplaceId,
    marketplaceIds: marketplaceId,
  })

  if (sellerSkus?.length) {
    params.set('sellerSkus', sellerSkus.join(','))
  }

  const summaries: InventorySummary[] = []
  let nextToken: string | undefined

  do {
    if (nextToken) params.set('nextToken', nextToken)

    const res = await fetch(
      `${SP_API_ENDPOINT}/fba/inventory/v1/summaries?${params}`,
      {
        headers: {
          'x-amz-access-token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`SP-API inventory error: ${res.status} ${err}`)
    }

    const data = await res.json()
    const items = data.payload?.inventorySummaries ?? []
    summaries.push(...items)
    nextToken = data.pagination?.nextToken
  } while (nextToken)

  return summaries
}

// Get catalog item by ASIN
export async function getCatalogItem(
  accessToken: string,
  marketplaceId: string,
  asin: string
): Promise<any> {
  const params = new URLSearchParams({
    marketplaceIds: marketplaceId,
    includedData: 'summaries,images',
  })

  const res = await fetch(
    `${SP_API_ENDPOINT}/catalog/2022-04-01/items/${asin}?${params}`,
    {
      headers: {
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`SP-API catalog error: ${res.status} ${err}`)
  }

  return res.json()
}

// Create MCF fulfillment order
export async function createFulfillmentOrder(
  accessToken: string,
  params: CreateFulfillmentOrderParams
): Promise<void> {
  const body = {
    sellerFulfillmentOrderId: params.sellerFulfillmentOrderId,
    displayableOrderId: params.displayableOrderId,
    displayableOrderDate: params.displayableOrderDate,
    displayableOrderComment: params.displayableOrderComment,
    shippingSpeedCategory: params.shippingSpeedCategory,
    destinationAddress: params.destinationAddress,
    items: params.items,
    ...(params.notificationEmails?.length && { notificationEmails: params.notificationEmails }),
  }

  const res = await fetch(
    `${SP_API_ENDPOINT}/fba/outbound/2020-07-01/fulfillmentOrders`,
    {
      method: 'POST',
      headers: {
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`SP-API MCF create error: ${res.status} ${err}`)
  }
}

// Get fulfillment order status
export async function getFulfillmentOrder(
  accessToken: string,
  sellerFulfillmentOrderId: string
): Promise<FulfillmentOrderStatus> {
  const res = await fetch(
    `${SP_API_ENDPOINT}/fba/outbound/2020-07-01/fulfillmentOrders/${sellerFulfillmentOrderId}`,
    {
      headers: {
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`SP-API MCF status error: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.payload?.fulfillmentOrder
}
