/**
 * FITPEAK RAG: vector-search backed knowledge retrieval.
 *
 * Embeds a user query with Voyage AI (voyage-3-lite, 512 dims),
 * then calls the `search_knowledge_chunks` RPC on Supabase.
 *
 * Env:
 *   VOYAGE_API_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)
 */

import { createClient } from '@supabase/supabase-js'

const EMBEDDING_MODEL = 'voyage-3-lite'
const VOYAGE_EMBED_URL = 'https://api.voyageai.com/v1/embeddings'
const DEFAULT_LIMIT = 5
const MIN_SIMILARITY = 0.35

export interface KnowledgeChunk {
  id: string
  source: string
  category: string
  title: string
  content: string
  metadata: Record<string, unknown> | null
  similarity: number
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

/**
 * Voyage AI でテキストを埋め込みベクトルに変換
 */
export async function embedText(
  text: string,
  inputType: 'query' | 'document' = 'query',
): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) throw new Error('VOYAGE_API_KEY が未設定です')

  const res = await fetch(VOYAGE_EMBED_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: text,
      model: EMBEDDING_MODEL,
      input_type: inputType,
    }),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`Voyage embedding API ${res.status}: ${errBody}`)
  }

  const json = (await res.json()) as { data?: { embedding?: number[] }[] }
  const vec = json?.data?.[0]?.embedding
  if (!Array.isArray(vec)) {
    throw new Error('Voyage embedding の取得に失敗しました')
  }
  return vec
}

/**
 * クエリに関連するナレッジチャンクをベクトル検索して返す。
 * 失敗時は空配列を返す（呼び出し側を止めない）。
 */
export async function getRelevantKnowledgeChunks(
  query: string,
  opts: { category?: string; limit?: number } = {},
): Promise<KnowledgeChunk[]> {
  try {
    const { category = null, limit = DEFAULT_LIMIT } = opts
    if (!query || !query.trim()) return []

    const embedding = await embedText(query, 'query')
    const supabase = getSupabase()

    const { data, error } = await supabase.rpc('search_knowledge_chunks', {
      query_embedding: embedding,
      match_category: category,
      match_count: limit,
    })

    if (error) {
      console.error('[fitpeak-rag] search_knowledge_chunks error:', error.message)
      return []
    }

    return ((data || []) as KnowledgeChunk[]).filter(
      (r) => r.similarity >= MIN_SIMILARITY,
    )
  } catch (err) {
    console.error('[fitpeak-rag] getRelevantKnowledgeChunks failed:', err)
    return []
  }
}

/**
 * 取得したチャンクをシステムプロンプトに差し込む形式にフォーマット
 */
export function formatKnowledgeChunks(chunks: KnowledgeChunk[]): string {
  if (!chunks || chunks.length === 0) return ''
  return chunks
    .map((c, i) => {
      const md = c.metadata as Record<string, unknown> | null
      const url = md && typeof md.url === 'string' ? `\nURL: ${md.url}` : ''
      return `[${i + 1}] (${c.category}) ${c.title}\n${c.content}${url}`
    })
    .join('\n\n---\n\n')
}
