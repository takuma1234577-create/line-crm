import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { crmTools } from '@/lib/ai/tools'
import { getSystemPrompt } from '@/lib/ai/prompts'
import { executeToolCall } from '@/lib/ai/executor'

// Allow up to 5 minutes for long-running tool calls (CSV import, etc.)
export const maxDuration = 300

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

async function getAccountId(supabase: any, channelId: string): Promise<string | null> {
  const { data } = await supabase
    .from('line_channels')
    .select('account_id')
    .eq('id', channelId)
    .single()
  return data?.account_id ?? null
}

async function saveConversation(
  supabase: any,
  conversationId: string,
  channelId: string,
  accountId: string,
  messages: Anthropic.MessageParam[]
) {
  await supabase.from('ai_conversations').upsert(
    {
      id: conversationId,
      channel_id: channelId,
      account_id: accountId,
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
// Context window management
// ---------------------------------------------------------------------------

const MAX_HISTORY_CHARS = 120_000 // ~40K tokens — leave room for system prompt + new response
const TOOL_RESULT_MAX_CHARS = 600

/** Rough token estimate (Japanese ≈ 1 token per 2-3 chars) */
function estimateChars(messages: Anthropic.MessageParam[]): number {
  return JSON.stringify(messages).length
}

/** Truncate tool_result content that was already processed */
function truncateToolResults(
  messages: Anthropic.MessageParam[]
): Anthropic.MessageParam[] {
  return messages.map((msg) => {
    if (!Array.isArray(msg.content)) return msg
    return {
      ...msg,
      content: (msg.content as any[]).map((block: any) => {
        if (block.type === 'tool_result') {
          if (
            typeof block.content === 'string' &&
            block.content.length > TOOL_RESULT_MAX_CHARS
          ) {
            return {
              ...block,
              content:
                block.content.slice(0, TOOL_RESULT_MAX_CHARS) +
                '\n...(以下省略)',
            }
          }
          if (Array.isArray(block.content)) {
            return {
              ...block,
              content: block.content.map((b: any) => {
                if (
                  b.type === 'text' &&
                  typeof b.text === 'string' &&
                  b.text.length > TOOL_RESULT_MAX_CHARS
                ) {
                  return {
                    ...b,
                    text:
                      b.text.slice(0, TOOL_RESULT_MAX_CHARS) +
                      '\n...(以下省略)',
                  }
                }
                return b
              }),
            }
          }
        }
        return block
      }),
    }
  })
}

/**
 * When the conversation history exceeds the budget, build a summary of older
 * messages and keep only recent ones.  The summary is injected into the system
 * prompt so that the model retains context without the full raw history.
 */
function compressHistory(
  messages: Anthropic.MessageParam[]
): { messages: Anthropic.MessageParam[]; summary: string | null } {
  if (estimateChars(messages) <= MAX_HISTORY_CHARS) {
    return { messages, summary: null }
  }

  // Walk backwards — keep recent messages that fit within 60 % of the budget
  const recentBudget = MAX_HISTORY_CHARS * 0.6
  let keepFrom = 0
  let recentSize = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    recentSize += JSON.stringify(messages[i]).length
    if (recentSize > recentBudget) {
      keepFrom = i + 1
      break
    }
  }
  // Always keep at least the last 4 messages (2 exchanges)
  keepFrom = Math.min(keepFrom, messages.length - 4)
  keepFrom = Math.max(keepFrom, 0)

  // Summarise older messages
  const summaryParts: string[] = []
  for (let i = 0; i < keepFrom; i++) {
    const msg = messages[i]
    const text = extractText(msg)
    if (!text) continue
    const prefix = msg.role === 'user' ? 'ユーザー' : 'AI'
    summaryParts.push(`- ${prefix}: ${text.slice(0, 200)}`)
  }

  const summary =
    summaryParts.length > 0
      ? summaryParts.join('\n')
      : null

  return { messages: messages.slice(keepFrom), summary }
}

function extractText(msg: Anthropic.MessageParam): string {
  if (typeof msg.content === 'string') return msg.content
  if (Array.isArray(msg.content)) {
    return (msg.content as any[])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join(' ')
  }
  return ''
}

// ---------------------------------------------------------------------------
// Tool status labels for progress display
// ---------------------------------------------------------------------------

const TOOL_LABELS: Record<string, string> = {
  get_todays_messages: 'メッセージを確認中...',
  get_conversation: '会話履歴を取得中...',
  reply_to_friend: 'メッセージを送信中...',
  bulk_reply: '一括返信を送信中...',
  broadcast_message: '一斉配信を準備中...',
  search_friends: '友だちを検索中...',
  get_friend_count: '友だち数を取得中...',
  manage_tags: 'タグを管理中...',
  manage_step_sequence: 'ステップ配信を設定中...',
  manage_auto_response: '自動応答を設定中...',
  manage_rich_menu: 'リッチメニューを作成中...',
  manage_knowledge: 'ナレッジベースを更新中...',
  manage_ai_settings: 'AI設定を変更中...',
  get_analytics: 'データを分析中...',
  manage_reminders: 'リマインダーを設定中...',
  manage_forms: 'フォームを管理中...',
  manage_reservations: '予約を確認中...',
  ec_get_orders: '注文データを取得中...',
  ec_get_order_detail: '注文詳細を確認中...',
  ec_get_customer_profile: '顧客情報を取得中...',
  ec_link_friend: '顧客紐付けを実行中...',
  ec_send_delivery_notification: '配送通知を送信中...',
  ec_manage_followup: 'フォローアップを管理中...',
  ec_sync_orders: '注文データを同期中...',
  ec_get_stats: '売上統計を取得中...',
  ec_get_products: '商品情報を取得中...',
  ec_get_store_pages: 'ストアページを取得中...',
  import_friends_from_csv: 'CSVデータをインポート中...',
}

function toolStatusLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? `${toolName} を実行中...`
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
const CSV_TYPES = ['text/csv', 'application/vnd.ms-excel']

function isCSV(att: Attachment): boolean {
  return CSV_TYPES.includes(att.type) || att.name.toLowerCase().endsWith('.csv')
}

function decodeCSVBase64(base64: string): string {
  const buffer = Buffer.from(base64, 'base64')
  // Try UTF-8 first, fallback to Shift_JIS
  const text = buffer.toString('utf-8')
  if (text.includes('\ufffd')) {
    // Likely Shift_JIS, use iconv-lite
    try {
      const iconv = require('iconv-lite')
      return iconv.decode(buffer, 'Shift_JIS')
    } catch {
      return text
    }
  }
  return text
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

/**
 * Compact CSV by collapsing tag columns (0/1 flags) into a single "tags" column.
 * This dramatically reduces the size for Lメッセージ exports which have 90+ tag columns.
 */
function compactCSV(csvText: string): string {
  const lines = csvText.split('\n').filter((l) => l.trim())
  if (lines.length < 3) return csvText

  // Row 0: internal IDs, Row 1: human-readable headers, Row 2+: data
  const headerRow1 = parseCSVLine(lines[0])
  const headerRow2 = parseCSVLine(lines[1])

  // Detect tag columns (header starts with タグ_)
  const tagIndices: number[] = []
  const tagNames: string[] = []
  const nonTagIndices: number[] = []

  for (let i = 0; i < headerRow2.length; i++) {
    const h = headerRow2[i].trim()
    if (h.startsWith('タグ_')) {
      tagIndices.push(i)
      tagNames.push(h.replace('タグ_', ''))
    } else {
      nonTagIndices.push(i)
    }
  }

  // If no tag columns detected, return as-is (with size limit)
  if (tagIndices.length === 0) {
    return csvText
  }

  // Build compacted header
  const compactHeaders = nonTagIndices.map((i) => headerRow2[i]?.trim() || '')
  compactHeaders.push('タグ一覧')

  // Build compacted rows
  const compactRows: string[] = [compactHeaders.join(',')]

  for (let r = 2; r < lines.length; r++) {
    const cols = parseCSVLine(lines[r])
    const nonTagValues = nonTagIndices.map((i) => {
      const v = cols[i] ?? ''
      return v.includes(',') ? `"${v}"` : v
    })

    // Collect active tags
    const activeTags: string[] = []
    for (let t = 0; t < tagIndices.length; t++) {
      if (cols[tagIndices[t]]?.trim() === '1') {
        activeTags.push(tagNames[t])
      }
    }

    nonTagValues.push(activeTags.length > 0 ? `"${activeTags.join(', ')}"` : '')
    compactRows.push(nonTagValues.join(','))
  }

  return compactRows.join('\n')
}

async function uploadImageToStorage(
  supabase: any,
  base64: string,
  mimeType: string,
  filename: string
): Promise<string | null> {
  const ext = mimeType.split('/')[1] ?? 'png'
  const path = `auto-response/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}.${ext}`
  const buffer = Buffer.from(base64, 'base64')

  const { error } = await supabase.storage
    .from('images')
    .upload(path, buffer, { contentType: mimeType, upsert: true })

  if (error) {
    console.error('[uploadImageToStorage]', error.message)
    return null
  }

  const { data: urlData } = supabase.storage.from('images').getPublicUrl(path)
  return urlData?.publicUrl ?? null
}

async function buildContentBlocks(
  supabase: any,
  message: string,
  attachments?: Attachment[]
): Promise<{ blocks: Anthropic.ContentBlockParam[]; imageUrls: { name: string; url: string }[] }> {
  const blocks: Anthropic.ContentBlockParam[] = []
  const imageUrls: { name: string; url: string }[] = []

  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      if (IMAGE_TYPES.includes(att.type)) {
        // Show image to Claude for recognition
        blocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: att.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: att.base64,
          },
        })

        // Upload to storage and provide URL
        const url = await uploadImageToStorage(supabase, att.base64, att.type, att.name)
        if (url) {
          imageUrls.push({ name: att.name, url })
          blocks.push({
            type: 'text',
            text: `[画像「${att.name}」をアップロード済み。URL: ${url} ]`,
          })
        }
      } else if (PDF_TYPES.includes(att.type)) {
        blocks.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: att.base64,
          },
        })
      } else if (isCSV(att)) {
        // Decode CSV and compact tag columns
        const rawCSV = decodeCSVBase64(att.base64)
        const compacted = compactCSV(rawCSV)
        const compactedLines = compacted.split('\n').filter((l) => l.trim())
        const headerLine = compactedLines[0] ?? ''
        const dataLines = compactedLines.slice(1)
        const totalRows = dataLines.length

        // Send only a summary + sample rows (not the full CSV)
        const SAMPLE_ROWS = 15
        const sampleData = dataLines.slice(0, SAMPLE_ROWS)

        // Collect column stats for the summary
        const headers = parseCSVLine(headerLine)
        const nonEmptyCounts: Record<string, number> = {}
        for (const h of headers) nonEmptyCounts[h] = 0
        for (const line of dataLines) {
          const cols = parseCSVLine(line)
          for (let ci = 0; ci < headers.length; ci++) {
            if (cols[ci]?.trim()) nonEmptyCounts[headers[ci]]++
          }
        }
        // Find unique tags if there's a タグ一覧 column
        const tagColIdx = headers.indexOf('タグ一覧')
        const uniqueTags = new Set<string>()
        if (tagColIdx >= 0) {
          for (const line of dataLines) {
            const cols = parseCSVLine(line)
            const tags = (cols[tagColIdx] ?? '').split(',').map((t) => t.trim()).filter(Boolean)
            tags.forEach((t) => uniqueTags.add(t))
          }
        }

        const summary = [
          `[CSVファイル: ${att.name}]`,
          `全${totalRows}行のデータ`,
          '',
          `カラム: ${headers.join(', ')}`,
          '',
          `各カラムの入力率:`,
          ...headers.map((h) => `  ${h}: ${totalRows > 0 ? Math.round((nonEmptyCounts[h] / totalRows) * 100) : 0}%`),
          uniqueTags.size > 0 ? `\nタグ一覧 (${uniqueTags.size}種): ${[...uniqueTags].slice(0, 30).join(', ')}${uniqueTags.size > 30 ? '...' : ''}` : '',
          '',
          `サンプルデータ (先頭${SAMPLE_ROWS}件):`,
          '```csv',
          headerLine,
          ...sampleData,
          '```',
          '',
          `※ 全データはシステムに保持済み。import_friends_from_csv ツールでインポート可能。`,
        ].filter(Boolean).join('\n')

        blocks.push({ type: 'text', text: summary })
      }
    }
  }

  if (message) {
    blocks.push({ type: 'text', text: message })
  }

  return { blocks, imageUrls }
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

    // Extract raw CSV base64 for potential import tool use
    const csvAttachment = attachments?.find((a) => isCSV(a))
    const csvBase64 = csvAttachment?.base64 ?? null

    // Build content blocks with attachments (uploads images to storage)
    const hasAttachments = attachments && attachments.length > 0
    const { blocks: contentBlocks, imageUrls: _uploadedImages } = hasAttachments
      ? await buildContentBlocks(supabase, message || '', attachments)
      : { blocks: [], imageUrls: [] }
    const userContent = hasAttachments ? contentBlocks : message

    // Add the new user message
    history.push({ role: 'user', content: userContent as any })

    // Compress history if it exceeds the context budget
    const { messages: compressedHistory, summary: conversationSummary } =
      compressHistory(history)
    history = compressedHistory

    // Resolve account ID for saving conversations
    const accountId = await getAccountId(supabase, channelId)
    if (!accountId) {
      return Response.json({ error: 'channel not found' }, { status: 404 })
    }

    // Get channel info for system prompt
    const channelInfo = await getChannelInfo(supabase, channelId)
    let systemPrompt = getSystemPrompt(channelInfo)

    // Inject conversation summary so the model retains context
    if (conversationSummary) {
      systemPrompt += `\n\n# これまでの会話の要約（古い部分）\n以下はこの会話の前半部分の要約です。この文脈を踏まえて対応を続けてください。\n${conversationSummary}`
    }

    // ---------------------------------------------------------------------------
    // Progressive SSE stream — send events as the agentic loop progresses
    // ---------------------------------------------------------------------------
    const encoder = new TextEncoder()
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()

    const sendEvent = (data: Record<string, unknown>) =>
      writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

    // Run the agentic loop in the background while streaming events
    ;(async () => {
      try {
        // Send conversation ID immediately
        await sendEvent({ type: 'conversation_id', id: convId })

        let currentMessages = [...history]
        let finalText = ''

        const MAX_ITERATIONS = 10
        for (let i = 0; i < MAX_ITERATIONS; i++) {
          // Notify the client we're thinking
          await sendEvent({ type: 'status', status: i === 0 ? '考え中...' : '追加情報を分析中...' })

          const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 4096,
            system: systemPrompt,
            tools: crmTools as any,
            messages: currentMessages,
          })

          const toolUseBlocks = response.content.filter(
            (block) => block.type === 'tool_use'
          )
          const textBlocks = response.content.filter(
            (block) => block.type === 'text'
          )

          if (toolUseBlocks.length > 0) {
            currentMessages.push({ role: 'assistant', content: response.content as any })

            const toolResults: any[] = []
            for (const toolUse of toolUseBlocks) {
              const tu = toolUse as any

              // Send tool execution status
              await sendEvent({ type: 'status', status: toolStatusLabel(tu.name) })

              const result = await executeToolCall(tu.name, tu.input, channelId, csvBase64)
              toolResults.push({
                type: 'tool_result',
                tool_use_id: tu.id,
                content: result,
              })
            }

            currentMessages.push({ role: 'user', content: toolResults })

            if (textBlocks.length > 0) {
              finalText += textBlocks.map((b) => (b as any).text).join('')
            }
            continue
          }

          // Final text response
          if (textBlocks.length > 0) {
            finalText += textBlocks.map((b) => (b as any).text).join('')
          }
          currentMessages.push({ role: 'assistant', content: finalText })
          break
        }

        // Stream the final text in chunks
        const chunkSize = 20
        for (let i = 0; i < finalText.length; i += chunkSize) {
          await sendEvent({ type: 'text', text: finalText.slice(i, i + chunkSize) })
        }

        // Save conversation (non-blocking for the user)
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
                if (block.type === 'text' && block.text?.startsWith('[CSVファイル:')) {
                  const nameMatch = block.text.match(/\[CSVファイル: (.+?)\]/)
                  return {
                    type: 'text',
                    text: `[CSVファイル添付: ${nameMatch?.[1] ?? 'file.csv'}]`,
                  }
                }
                return block
              }),
            }
          }
          return msg
        })

        const truncatedMessages = truncateToolResults(messagesForSave as any)
        await saveConversation(supabase, convId, channelId, accountId, truncatedMessages as any)

        await sendEvent({ type: 'done' })
      } catch (err: any) {
        const errMsg = err?.error?.error?.message ?? err?.message ?? 'unknown'
        console.error(`[ai/chat] streaming error: ${errMsg}`)
        await sendEvent({ type: 'error', error: errMsg })
      } finally {
        await writer.close()
      }
    })()

    return new Response(readable, {
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
