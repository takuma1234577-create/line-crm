import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { messagingApi } from '@line/bot-sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
})

const BATCH_SIZE = 50

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date().toISOString()
  let processed = 0
  let failed = 0
  let completed = 0

  try {
    // Fetch active enrollments that are due
    const { data: enrollments, error: fetchError } = await supabase
      .from('step_enrollments')
      .select('id, sequence_id, friend_id, current_step')
      .eq('status', 'active')
      .lte('next_send_at', now)
      .limit(BATCH_SIZE)

    if (fetchError) {
      console.error('[step-delivery] fetch enrollments error:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch enrollments' }, { status: 500 })
    }

    if (!enrollments || enrollments.length === 0) {
      return NextResponse.json({ message: 'No enrollments to process', processed: 0 })
    }

    console.log(`[step-delivery] Processing ${enrollments.length} enrollments`)

    for (const enrollment of enrollments) {
      try {
        // Get the step message for the current step
        const { data: stepMessages, error: stepError } = await supabase
          .from('step_messages')
          .select('*')
          .eq('sequence_id', enrollment.sequence_id)
          .order('step_order', { ascending: true })

        if (stepError || !stepMessages) {
          console.error('[step-delivery] fetch step_messages error:', stepError)
          failed++
          continue
        }

        const currentStepIndex = enrollment.current_step
        const currentMessage = stepMessages[currentStepIndex]

        if (!currentMessage) {
          // No message at this step index - mark as completed
          await supabase
            .from('step_enrollments')
            .update({ status: 'completed', completed_at: now })
            .eq('id', enrollment.id)
          completed++
          continue
        }

        // Get the friend's line_user_id
        const { data: friend, error: friendError } = await supabase
          .from('friends')
          .select('line_user_id')
          .eq('id', enrollment.friend_id)
          .single()

        if (friendError || !friend) {
          console.error('[step-delivery] fetch friend error:', friendError)
          failed++
          continue
        }

        // Build LINE messages from step message content
        const messages = Array.isArray(currentMessage.content)
          ? currentMessage.content
          : [{ type: 'text', text: String(currentMessage.content) }]

        // Send via LINE push message
        await lineClient.pushMessage({
          to: friend.line_user_id,
          messages,
        })

        // Determine next step
        const nextStepIndex = currentStepIndex + 1
        const nextMessage = stepMessages[nextStepIndex]

        if (nextMessage) {
          // Calculate next_send_at based on next step's delay_minutes
          const delayMinutes = nextMessage.delay_minutes ?? 0
          const nextSendAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString()

          await supabase
            .from('step_enrollments')
            .update({
              current_step: nextStepIndex,
              next_send_at: nextSendAt,
              last_sent_at: now,
            })
            .eq('id', enrollment.id)
        } else {
          // No more steps - mark as completed
          await supabase
            .from('step_enrollments')
            .update({
              status: 'completed',
              current_step: nextStepIndex,
              last_sent_at: now,
              completed_at: now,
            })
            .eq('id', enrollment.id)
          completed++
        }

        processed++
      } catch (err) {
        console.error(`[step-delivery] error processing enrollment ${enrollment.id}:`, err)
        failed++
      }
    }

    console.log(
      `[step-delivery] Done: processed=${processed}, completed=${completed}, failed=${failed}`
    )

    return NextResponse.json({
      message: 'Step delivery completed',
      processed,
      completed,
      failed,
    })
  } catch (err) {
    console.error('[step-delivery] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
