import { createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/ai/conversations?channelId=...
 * Returns a list of conversations (id, title, updated_at) ordered by most recent.
 *
 * GET /api/ai/conversations?channelId=...&id=<convId>
 * Returns a single conversation with its messages restored to ChatMessage format.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const channelId = searchParams.get('channelId')
  const convId = searchParams.get('id')

  if (!channelId) {
    return Response.json({ error: 'channelId is required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // ------------------------------------------------------------------
  // Single conversation detail
  // ------------------------------------------------------------------
  if (convId) {
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('id, messages, updated_at')
      .eq('id', convId)
      .single()

    if (error || !data) {
      return Response.json({ error: 'conversation not found' }, { status: 404 })
    }

    // Convert Anthropic MessageParam[] → ChatMessage[] for the frontend
    const chatMessages = convertToChatMessages(data.messages ?? [])

    return Response.json({ id: data.id, messages: chatMessages })
  }

  // ------------------------------------------------------------------
  // Conversation list
  // ------------------------------------------------------------------
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('id, messages, updated_at')
    .eq('channel_id', channelId)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const list = (data ?? []).map((row) => {
    const msgs: any[] = row.messages ?? []
    // Find the first user message for the title
    const firstUser = msgs.find((m: any) => m.role === 'user')
    const title = extractPlainText(firstUser).slice(0, 60) || '新しい会話'
    // Find the last assistant message for preview
    const lastAssistant = [...msgs].reverse().find((m: any) => m.role === 'assistant')
    const lastMessage = extractPlainText(lastAssistant).slice(0, 80) || ''

    return {
      id: row.id,
      title,
      lastMessage,
      timestamp: row.updated_at,
    }
  })

  return Response.json(list)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractPlainText(msg: any): string {
  if (!msg) return ''
  if (typeof msg.content === 'string') return msg.content
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join(' ')
  }
  return ''
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

/**
 * Convert raw Anthropic MessageParam[] (which may include tool_use /
 * tool_result blocks) into a flat ChatMessage list suitable for the UI.
 * Only user text and assistant text are surfaced — tool exchanges are hidden.
 */
function convertToChatMessages(messages: any[]): ChatMessage[] {
  const out: ChatMessage[] = []
  let idx = 0

  for (const msg of messages) {
    if (msg.role !== 'user' && msg.role !== 'assistant') continue

    const text = extractPlainText(msg)

    // Skip tool_result-only user messages (no readable text)
    if (msg.role === 'user' && Array.isArray(msg.content)) {
      const hasToolResult = msg.content.some((b: any) => b.type === 'tool_result')
      if (hasToolResult && !text.trim()) continue
    }

    // Skip assistant messages that are only tool_use (no text)
    if (msg.role === 'assistant' && !text.trim()) continue

    out.push({
      id: `${msg.role}-restored-${idx++}`,
      role: msg.role,
      content: text,
    })
  }

  return out
}
