import { NextRequest, NextResponse } from 'next/server'
import { processFollowupJobs } from '@/lib/ec/followup'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await processFollowupJobs()
  return NextResponse.json({ ...result, processed_at: new Date().toISOString() })
}
