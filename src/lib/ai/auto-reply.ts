import Anthropic from '@anthropic-ai/sdk'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getRelevantKnowledgeChunks, formatKnowledgeChunks, type KnowledgeChunk } from './fitpeak-rag'

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

interface AISettings {
  auto_reply_enabled: boolean
  persona_name: string
  persona_description: string
  tone: string
  system_instructions: string
  reply_delay_seconds: number
  max_message_length: number
  active_hours_start: string
  active_hours_end: string
  active_days: number[]
  escalation_keywords: string[]
  ng_words: string[]
}

interface KnowledgeItem {
  category: string
  title: string
  content: string
}

// Check if AI auto-reply is enabled and within active hours
export async function shouldAutoReply(channelId: string): Promise<AISettings | null> {
  const { data: settings } = await getSupabase()
    .from('ai_settings')
    .select('*')
    .eq('channel_id', channelId)
    .single()

  if (!settings || !settings.auto_reply_enabled) return null

  // Check active hours (JST)
  const now = new Date()
  const jstHour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const currentTime = `${String(jstHour.getHours()).padStart(2, '0')}:${String(jstHour.getMinutes()).padStart(2, '0')}`
  const currentDay = jstHour.getDay()

  if (!settings.active_days.includes(currentDay)) return null
  if (currentTime < settings.active_hours_start || currentTime > settings.active_hours_end) return null

  return settings as AISettings
}

// Check if message contains escalation keywords
export function shouldEscalate(message: string, keywords: string[]): boolean {
  if (!keywords || keywords.length === 0) return false
  const lowerMessage = message.toLowerCase()
  return keywords.some(kw => lowerMessage.includes(kw.toLowerCase()))
}

// Fetch all active knowledge base items for the channel
async function getKnowledgeBase(channelId: string): Promise<KnowledgeItem[]> {
  const { data } = await getSupabase()
    .from('knowledge_base')
    .select('category, title, content')
    .eq('channel_id', channelId)
    .eq('is_active', true)
    .order('priority', { ascending: false })

  return (data ?? []) as KnowledgeItem[]
}

// Get or create conversation context (recent message history for this user)
async function getConversationContext(channelId: string, friendId: string): Promise<{ role: string; content: string }[]> {
  const { data } = await getSupabase()
    .from('conversation_contexts')
    .select('messages')
    .eq('channel_id', channelId)
    .eq('friend_id', friendId)
    .single()

  return (data?.messages ?? []) as { role: string; content: string }[]
}

// Update conversation context with new messages
async function updateConversationContext(
  channelId: string,
  friendId: string,
  messages: { role: string; content: string }[]
) {
  // Keep only last 20 messages to limit context
  const trimmed = messages.slice(-20)

  await getSupabase()
    .from('conversation_contexts')
    .upsert(
      {
        channel_id: channelId,
        friend_id: friendId,
        messages: trimmed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'channel_id,friend_id' }
    )
}

// Build system prompt from settings and knowledge base
function buildSystemPrompt(
  settings: AISettings,
  knowledge: KnowledgeItem[],
  friendName: string,
  ragChunks: KnowledgeChunk[] = [],
): string {
  let prompt = `あなたはLINE公式アカウントの自動応答AIです。\n\n`

  // Persona
  if (settings.persona_name) {
    prompt += `# あなたの名前\n${settings.persona_name}\n\n`
  }
  if (settings.persona_description) {
    prompt += `# あなたの人物像・役割\n${settings.persona_description}\n\n`
  }

  // Tone
  const toneMap: Record<string, string> = {
    polite: '丁寧語で、礼儀正しく対応してください。',
    casual: 'フレンドリーでカジュアルな口調で対応してください。',
    business: 'ビジネスライクで簡潔に対応してください。',
    friendly: '親しみやすく、温かみのある口調で対応してください。',
  }
  prompt += `# 口調\n${toneMap[settings.tone] ?? toneMap.polite}\n\n`

  // Custom instructions
  if (settings.system_instructions) {
    prompt += `# 運営者からの指示\n${settings.system_instructions}\n\n`
  }

  // Knowledge base
  if (knowledge.length > 0 || ragChunks.length > 0) {
    prompt += `# ナレッジベース（あなたが持つ情報）\n以下の情報を元に回答してください。ナレッジベースにない情報は「確認いたしますので少々お待ちください」と答えてください。\n\n`

    const categories = [...new Set(knowledge.map(k => k.category))]
    for (const cat of categories) {
      prompt += `## ${cat}\n`
      const items = knowledge.filter(k => k.category === cat)
      for (const item of items) {
        prompt += `### ${item.title}\n${item.content}\n\n`
      }
    }

    // RAG で取得した関連ナレッジ（Shopify商品など）
    if (ragChunks.length > 0) {
      prompt += `## 関連する商品・ナレッジ（ユーザーの質問との関連度順）\n${formatKnowledgeChunks(ragChunks)}\n\n`
    }
  }

  // NG words
  if (settings.ng_words && settings.ng_words.length > 0) {
    prompt += `# 使用禁止ワード\n以下の言葉は絶対に使わないでください: ${settings.ng_words.join(', ')}\n\n`
  }

  // General rules
  prompt += `# 基本ルール
- お客様の名前は「${friendName}」さんです
- LINEメッセージなので、短く簡潔に返答してください（${settings.max_message_length}文字以内）
- 不明な質問には「確認いたしますので少々お待ちください」と答えてください
- 個人情報は絶対に聞き出さないでください
- 会話の文脈を考慮して自然に返答してください
- 絵文字は適度に使ってください
`

  return prompt
}

// Main auto-reply function
export async function generateAutoReply(
  channelId: string,
  friendId: string,
  friendName: string,
  userMessage: string,
  settings: AISettings
): Promise<{ reply: string; wasEscalated: boolean; tokensUsed: number; responseTimeMs: number }> {
  const startTime = Date.now()

  // Check escalation
  if (shouldEscalate(userMessage, settings.escalation_keywords)) {
    return {
      reply: '',
      wasEscalated: true,
      tokensUsed: 0,
      responseTimeMs: Date.now() - startTime,
    }
  }

  // Get knowledge base, conversation context, and RAG-retrieved chunks
  const [knowledge, conversationHistory, ragChunks] = await Promise.all([
    getKnowledgeBase(channelId),
    getConversationContext(channelId, friendId),
    getRelevantKnowledgeChunks(userMessage, { limit: 5 }),
  ])

  // Build system prompt
  const systemPrompt = buildSystemPrompt(settings, knowledge, friendName, ragChunks)

  // Build messages array with conversation history
  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    ...conversationHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ]

  // Call Claude API
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  })

  const reply = response.content
    .filter(block => block.type === 'text')
    .map(block => (block as { type: 'text'; text: string }).text)
    .join('')

  const tokensUsed = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0)

  // Update conversation context
  await updateConversationContext(channelId, friendId, [
    ...conversationHistory,
    { role: 'user', content: userMessage },
    { role: 'assistant', content: reply },
  ])

  // Log the reply
  await getSupabase().from('ai_reply_logs').insert({
    channel_id: channelId,
    friend_id: friendId,
    user_message: userMessage,
    ai_reply: reply,
    tokens_used: tokensUsed,
    response_time_ms: Date.now() - startTime,
    was_escalated: false,
  })

  return {
    reply,
    wasEscalated: false,
    tokensUsed,
    responseTimeMs: Date.now() - startTime,
  }
}
