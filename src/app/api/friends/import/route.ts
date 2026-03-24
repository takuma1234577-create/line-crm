import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import iconv from 'iconv-lite'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CHANNEL_ID = '00000000-0000-0000-0000-000000000010'

// Generate a consistent color from tag name
function tagColor(name: string): string {
  const colors = [
    '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E',
    '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6',
    '#A855F7', '#D946EF', '#EC4899', '#F43F5E',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

// Parse CSV line respecting quoted fields
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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Read file as buffer and decode from Shift_JIS
    const buffer = Buffer.from(await file.arrayBuffer())
    const text = iconv.decode(buffer, 'Shift_JIS')

    const lines = text.split('\n').filter((l) => l.trim())
    if (lines.length < 3) {
      return NextResponse.json({ error: 'CSV is too short' }, { status: 400 })
    }

    // Row 1: internal IDs (タグ_1076657 etc.)
    // Row 2: human-readable headers
    const headerRow = parseCSVLine(lines[1])

    // Find tag columns (columns that start with "タグ_")
    const tagColumns: { index: number; name: string }[] = []
    for (let i = 0; i < headerRow.length; i++) {
      const h = headerRow[i].trim()
      if (h.startsWith('タグ_')) {
        tagColumns.push({ index: i, name: h.replace('タグ_', '') })
      }
    }

    // Find key column indices from header row
    const colIndex = (label: string) => {
      const idx = headerRow.findIndex((h) => h.trim() === label)
      return idx
    }

    const idxUserId = colIndex('ユーザーID')
    const idxName = 1 // LINE表示名 is column 1 (has leading space in header)
    const idxFollowedAt = colIndex('友だち追加日')
    const idxLastMessage = colIndex('最終メッセージ受信日時')
    const idxSystemName = colIndex('システム表示名')
    const idxPhone = colIndex('携帯電話')
    const idxEmail = colIndex('メールアドレス')
    const idxBirthday = colIndex('生年月日')
    const idxPostalCode = colIndex('郵便番号')
    const idxPrefecture = colIndex('都道府県')
    const idxCity = colIndex('市区町村名')
    const idxAddress = colIndex('町名/番地')
    const idxBuilding = colIndex('建物名・部屋番号')
    const idxMemo = colIndex('個別メモ')

    // Data rows start at index 2
    const dataRows = lines.slice(2)

    // Step 1: Ensure all tags exist in DB
    const uniqueTagNames = tagColumns.map((t) => t.name)
    const { data: existingTags } = await supabase
      .from('tags')
      .select('id, name')
      .eq('channel_id', CHANNEL_ID)

    const existingTagMap = new Map(
      (existingTags ?? []).map((t: any) => [t.name, t.id])
    )

    // Create missing tags
    const missingTags = uniqueTagNames.filter((n) => !existingTagMap.has(n))
    if (missingTags.length > 0) {
      const tagsToInsert = missingTags.map((name) => ({
        channel_id: CHANNEL_ID,
        name,
        color: tagColor(name),
      }))

      // Insert in batches of 50
      for (let i = 0; i < tagsToInsert.length; i += 50) {
        const batch = tagsToInsert.slice(i, i + 50)
        const { data: inserted, error } = await supabase
          .from('tags')
          .upsert(batch, { onConflict: 'channel_id,name' })
          .select('id, name')

        if (error) {
          console.error('[import] tag insert error:', error)
        }
        if (inserted) {
          for (const t of inserted) {
            existingTagMap.set(t.name, t.id)
          }
        }
      }
    }

    // Step 2: Import friends
    let imported = 0
    let skipped = 0
    let tagLinks = 0

    for (const line of dataRows) {
      const cols = parseCSVLine(line)
      const lineUserId = cols[idxUserId]?.trim()
      if (!lineUserId || !lineUserId.startsWith('U')) {
        skipped++
        continue
      }

      const displayName = cols[idxName]?.trim() || 'Unknown'
      const followedAt = cols[idxFollowedAt]?.trim() || null
      const lastMessage = cols[idxLastMessage]?.trim() || null

      // Build metadata from extra fields
      const metadata: Record<string, string> = {}
      const addMeta = (key: string, idx: number) => {
        const val = idx >= 0 ? cols[idx]?.trim() : ''
        if (val) metadata[key] = val
      }
      addMeta('system_name', idxSystemName)
      addMeta('phone', idxPhone)
      addMeta('email', idxEmail)
      addMeta('birthday', idxBirthday)
      addMeta('postal_code', idxPostalCode)
      addMeta('prefecture', idxPrefecture)
      addMeta('city', idxCity)
      addMeta('address', idxAddress)
      addMeta('building', idxBuilding)
      addMeta('memo', idxMemo)

      // Upsert friend
      const { data: friend, error: friendError } = await supabase
        .from('friends')
        .upsert(
          {
            channel_id: CHANNEL_ID,
            line_user_id: lineUserId,
            display_name: displayName,
            status: 'active',
            followed_at: followedAt
              ? new Date(followedAt).toISOString()
              : new Date().toISOString(),
            custom_fields: Object.keys(metadata).length > 0 ? metadata : null,
          },
          { onConflict: 'channel_id,line_user_id' }
        )
        .select('id')
        .single()

      if (friendError) {
        console.error('[import] friend upsert error:', friendError, lineUserId)
        skipped++
        continue
      }

      imported++

      // Step 3: Assign tags for this friend
      const friendTagInserts: { friend_id: string; tag_id: string }[] = []
      for (const tc of tagColumns) {
        const val = cols[tc.index]?.trim()
        if (val === '1') {
          const tagId = existingTagMap.get(tc.name)
          if (tagId) {
            friendTagInserts.push({ friend_id: friend.id, tag_id: tagId })
          }
        }
      }

      if (friendTagInserts.length > 0) {
        const { error: tagError } = await supabase
          .from('friend_tags')
          .upsert(friendTagInserts, { onConflict: 'friend_id,tag_id' })

        if (tagError) {
          console.error('[import] friend_tags error:', tagError)
        } else {
          tagLinks += friendTagInserts.length
        }
      }
    }

    return NextResponse.json({
      message: 'Import complete',
      imported,
      skipped,
      tags_created: missingTags.length,
      tag_links: tagLinks,
    })
  } catch (err: any) {
    console.error('[friends/import] error:', err)
    return NextResponse.json(
      { error: err.message ?? 'Import failed' },
      { status: 500 }
    )
  }
}
