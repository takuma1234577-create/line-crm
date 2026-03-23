import crypto from 'crypto'

export function validateSignature(body: string, signature: string): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET!
  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(body)
    .digest('base64')
  return hash === signature
}

export type WebhookEvent = {
  type: string
  timestamp: number
  source: { type: string; userId?: string; groupId?: string; roomId?: string }
  replyToken?: string
  message?: { id: string; type: string; text?: string }
  postback?: { data: string }
}
