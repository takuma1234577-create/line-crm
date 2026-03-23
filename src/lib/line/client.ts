import { messagingApi, MessageAPIResponseBase } from '@line/bot-sdk'

const { MessagingApiClient } = messagingApi

let client: InstanceType<typeof MessagingApiClient> | null = null

export function getLineClient(): InstanceType<typeof MessagingApiClient> {
  if (!client) {
    client = new MessagingApiClient({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
    })
  }
  return client
}

export async function pushMessage(userId: string, messages: any[]) {
  const client = getLineClient()
  return client.pushMessage({ to: userId, messages })
}

export async function replyMessage(replyToken: string, messages: any[]) {
  const client = getLineClient()
  return client.replyMessage({ replyToken, messages })
}

export async function getProfile(userId: string) {
  const client = getLineClient()
  return client.getProfile(userId)
}

export async function multicast(userIds: string[], messages: any[]) {
  const client = getLineClient()
  return client.multicast({ to: userIds, messages })
}

export async function broadcastMessage(messages: any[]) {
  const client = getLineClient()
  return client.broadcast({ messages })
}
