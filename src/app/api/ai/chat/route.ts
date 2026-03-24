import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { crmTools } from '@/lib/ai/tools'
import { getSystemPrompt } from '@/lib/ai/prompts'
import { executeToolCall } from '@/lib/ai/executor'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadConversation(
  supabase: any,
  conversationId: string
): Promise<Anthropic.MessageParam[]> {
  const { data } = await supabase
    .from('ai_conversations')
    .select('messages')
    .eq('id', conversationId)
    .single()

  if (data?.messages && Array.isArray(data.messages)) {
    return data.messages
  }
  return []
}

async function saveConversation(
  supabase: any,
  conversationId: string,
  channelId: string,
  messages: Anthropic.MessageParam[]
) {
  await supabase.from('ai_conversations').upsert(
    {
      id: conversationId,
      channel_id: channelId,
      messages,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )
}

async function getChannelInfo(supabase: any, channelId: string) {
  const { data: channel } = await supabase
    .from('line_channels')
    .select('display_name')
    .eq('id', channelId)
    .single()

  const { count } = await supabase
    .from('friends')
    .select('id', { count: 'exact', head: true })
    .eq('channel_id', channelId)
    .eq('status', 'active')

  return {
    display_name: channel?.display_name ?? undefined,
    friend_count: count ?? 0,
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Attachment handling
// ---------------------------------------------------------------------------

interface Attachment {
  type: string // MIME type
  name: string
  base64: string
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const PDF_TYPES = ['application/pdf']

function buildContentBlocks(
  message: string,
  attachments?: Attachment[]
): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] = []

  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      if (IMAGE_TYPES.includes(att.type)) {
        blocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: att.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: att.base64,
          },
        })
      } else if (PDF_TYPES.includes(att.type)) {
        blocks.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: att.base64,
          },
        })
      }
    }
  }

  if (message) {
    blocks.push({ type: 'text', text: message })
  }

  return blocks
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { message, conversationId, channelId, attachments } = body as {
      message: string
      conversationId?: string
      channelId: string
      attachments?: Attachment[]
    }

    if ((!message && (!attachments || attachments.length === 0)) || !channelId) {
      return Response.json(
        { error: 'message or attachments, and channelId are required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Load existing conversation or start fresh
    let history: Anthropic.MessageParam[] = []
    const convId = conversationId ?? crypto.randomUUID()

    if (conversationId) {
      history = await loadConversation(supabase, conversationId)
    }

    // Build content blocks with attachments
    const hasAttachments = attachments && attachments.length > 0
    const userContent = hasAttachments
      ? buildContentBlocks(message || '', attachments)
      : message

    // Add the new user message
    history.push({ role: 'user', content: userContent as any })

    // Get channel info for system prompt
    const channelInfo = await getChannelInfo(supabase, channelId)
    const systemPrompt = getSystemPrompt(channelInfo)

    // Run the agentic loop: call Claude, handle tool use, repeat until text response
    let currentMessages = [...history]
    let finalText = ''

    // Cap iterations to prevent infinite loops
    const MAX_ITERATIONS = 10
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: systemPrompt,
        tools: crmTools as any,
        messages: currentMessages,
      })

      // Check if the response includes tool use
      const toolUseBlocks = response.content.filter(
        (block) => block.type === 'tool_use'
      )

      const textBlocks = response.content.filter(
        (block) => block.type === 'text'
      )

      if (toolUseBlocks.length > 0) {
        // Add assistant response with tool_use to messages
        currentMessages.push({ role: 'assistant', content: response.content as any })

        // Execute each tool call and build tool_result blocks
        const toolResults: any[] = []
        for (const toolUse of toolUseBlocks) {
          const tu = toolUse as any
          const result = await executeToolCall(tu.name, tu.input, channelId)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: result,
          })
        }

        // Add tool results to messages
        currentMessages.push({ role: 'user', content: toolResults })

        // If there was also text in this response, accumulate it
        if (textBlocks.length > 0) {
          finalText += textBlocks.map((b) => (b as any).text).join('')
        }

        // Continue the loop to let Claude process tool results
        continue
      }

      // No tool use - extract final text response
      if (textBlocks.length > 0) {
        finalText += textBlocks.map((b) => (b as any).text).join('')
      }

      // Add the final assistant message to history
      currentMessages.push({ role: 'assistant', content: finalText })
      break
    }

    // Strip base64 data from messages before saving (to avoid bloating DB)
    const messagesForSave = currentMessages.map((msg) => {
      if (Array.isArray(msg.content)) {
        return {
          ...msg,
          content: (msg.content as any[]).map((block: any) => {
            if (
              (block.type === 'image' || block.type === 'document') &&
              block.source?.type === 'base64'
            ) {
              return {
                type: 'text',
                text: `[${block.type === 'image' ? '画像' : 'PDF'}ファイル添付]`,
              }
            }
            return block
          }),
        }
      }
      return msg
    })

    // Save updated conversation
    await saveConversation(supabase, convId, channelId, messagesForSave as any)

    // Stream the response back
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        // Send conversation ID as first chunk
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'conversation_id', id: convId })}\n\n`
          )
        )

        // Stream text in chunks to simulate streaming behavior
        const chunkSize = 20
        for (let i = 0; i < finalText.length; i += chunkSize) {
          const chunk = finalText.slice(i, i + chunkSize)
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'text', text: chunk })}\n\n`
            )
          )
        }

        // Send done signal
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
        )
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err: any) {
    const errType = err?.error?.error?.type ?? 'unknown'
    const errMsg = err?.error?.error?.message ?? err?.message ?? 'unknown'
    console.error(`[ai/chat] status=${err?.status} type=${errType} msg=${errMsg}`)
    return Response.json(
      { error: errMsg },
      { status: 500 }
    )
  }
}
