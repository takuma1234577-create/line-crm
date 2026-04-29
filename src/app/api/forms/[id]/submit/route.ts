import { NextRequest, NextResponse } from 'next/server'
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: formId } = await params

  try {
    // Validate form exists and is active
    const { data: form, error: formError } = await getSupabase()
      .from('forms')
      .select('*')
      .eq('id', formId)
      .eq('is_active', true)
      .single()

    if (formError || !form) {
      return NextResponse.json(
        { error: 'Form not found or inactive' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { data: submissionData, friend_id: friendId } = body

    if (!submissionData || typeof submissionData !== 'object') {
      return NextResponse.json(
        { error: 'Invalid submission data' },
        { status: 400 }
      )
    }

    // Insert the form submission
    const { data: submission, error: insertError } = await getSupabase()
      .from('form_submissions')
      .insert({
        form_id: formId,
        friend_id: friendId ?? null,
        data: submissionData,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error('[form-submit] insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to submit form' },
        { status: 500 }
      )
    }

    // Execute post_actions from form config
    if (form.post_actions && Array.isArray(form.post_actions)) {
      for (const action of form.post_actions) {
        try {
          switch (action.type) {
            case 'add_tag': {
              if (friendId && action.tag_id) {
                await getSupabase().from('friend_tags').upsert(
                  {
                    friend_id: friendId,
                    tag_id: action.tag_id,
                  },
                  { onConflict: 'friend_id,tag_id' }
                )
              }
              break
            }

            case 'enroll_sequence': {
              if (friendId && action.sequence_id) {
                // Get the first step to determine initial next_send_at
                const { data: firstStep } = await getSupabase()
                  .from('step_messages')
                  .select('delay_minutes')
                  .eq('sequence_id', action.sequence_id)
                  .order('step_order', { ascending: true })
                  .limit(1)
                  .single()

                const delayMinutes = firstStep?.delay_minutes ?? 0
                const nextSendAt = new Date(
                  Date.now() + delayMinutes * 60 * 1000
                ).toISOString()

                await getSupabase().from('step_enrollments').upsert(
                  {
                    sequence_id: action.sequence_id,
                    friend_id: friendId,
                    status: 'active',
                    current_step: 0,
                    enrolled_at: new Date().toISOString(),
                    next_send_at: nextSendAt,
                  },
                  { onConflict: 'sequence_id,friend_id' }
                )
              }
              break
            }

            default:
              console.warn(
                `[form-submit] unknown post_action type: ${action.type}`
              )
              break
          }
        } catch (actionErr) {
          console.error(
            `[form-submit] post_action error (${action.type}):`,
            actionErr
          )
          // Continue processing other actions
        }
      }
    }

    return NextResponse.json({
      message: 'Form submitted successfully',
      submission_id: submission.id,
    })
  } catch (err) {
    console.error('[form-submit] unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
