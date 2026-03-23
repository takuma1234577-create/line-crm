import { nanoid } from 'nanoid'

export function generateShortCode(length = 8): string {
  return nanoid(length)
}

export function getTrackingUrl(shortCode: string): string {
  return `${process.env.NEXT_PUBLIC_APP_URL}/api/track/${shortCode}`
}
