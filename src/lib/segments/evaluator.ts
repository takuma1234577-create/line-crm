import { SupabaseClient } from '@supabase/supabase-js'

export type ConditionOperator =
  | 'has'
  | 'not_has'
  | 'gte'
  | 'lte'
  | 'equals'
  | 'contains'

export type SegmentCondition =
  | { type: 'tag'; operator: 'has' | 'not_has'; value: string }
  | { type: 'followed_days'; operator: 'gte' | 'lte'; value: number }
  | { type: 'status'; operator: 'equals'; value: 'active' | 'blocked' | 'unfollowed' }
  | { type: 'custom_field'; field: string; operator: 'equals' | 'contains'; value: string }

export type SegmentConditions = {
  match: 'all' | 'any'
  conditions: SegmentCondition[]
}

/**
 * Evaluates segment conditions against the friends table and returns
 * an array of matching friend (LINE user) IDs.
 *
 * Tables assumed:
 *   - friends: id, channel_id, line_user_id, status, followed_at, custom_fields (jsonb)
 *   - friend_tags: friend_id, tag
 */
export async function evaluateSegment(
  supabase: SupabaseClient,
  channelId: string,
  conditions: SegmentConditions
): Promise<string[]> {
  if (conditions.conditions.length === 0) {
    // No conditions: return all friends for this channel
    const { data, error } = await supabase
      .from('friends')
      .select('line_user_id')
      .eq('channel_id', channelId)

    if (error) throw new Error(`Segment evaluation error: ${error.message}`)
    return (data ?? []).map((row) => row.line_user_id)
  }

  if (conditions.match === 'all') {
    return evaluateAll(supabase, channelId, conditions.conditions)
  } else {
    return evaluateAny(supabase, channelId, conditions.conditions)
  }
}

async function evaluateAll(
  supabase: SupabaseClient,
  channelId: string,
  conditions: SegmentCondition[]
): Promise<string[]> {
  const sets = await Promise.all(
    conditions.map((c) => evaluateSingle(supabase, channelId, c))
  )

  // Intersect all sets
  if (sets.length === 0) return []
  let result = new Set(sets[0])
  for (let i = 1; i < sets.length; i++) {
    const current = new Set(sets[i])
    result = new Set([...result].filter((id) => current.has(id)))
  }
  return Array.from(result)
}

async function evaluateAny(
  supabase: SupabaseClient,
  channelId: string,
  conditions: SegmentCondition[]
): Promise<string[]> {
  const sets = await Promise.all(
    conditions.map((c) => evaluateSingle(supabase, channelId, c))
  )

  // Union all sets
  const result = new Set<string>()
  for (const set of sets) {
    for (const id of set) {
      result.add(id)
    }
  }
  return Array.from(result)
}

async function evaluateSingle(
  supabase: SupabaseClient,
  channelId: string,
  condition: SegmentCondition
): Promise<string[]> {
  switch (condition.type) {
    case 'tag':
      return evaluateTag(supabase, channelId, condition)
    case 'followed_days':
      return evaluateFollowedDays(supabase, channelId, condition)
    case 'status':
      return evaluateStatus(supabase, channelId, condition)
    case 'custom_field':
      return evaluateCustomField(supabase, channelId, condition)
    default:
      throw new Error(`Unknown condition type: ${(condition as any).type}`)
  }
}

async function evaluateTag(
  supabase: SupabaseClient,
  channelId: string,
  condition: Extract<SegmentCondition, { type: 'tag' }>
): Promise<string[]> {
  if (condition.operator === 'has') {
    // Friends that have this tag
    const { data, error } = await supabase
      .from('friend_tags')
      .select('friend:friends!inner(line_user_id, channel_id)')
      .eq('tag', condition.value)
      .eq('friends.channel_id', channelId)

    if (error) throw new Error(`Tag evaluation error: ${error.message}`)
    return (data ?? []).map((row: any) => row.friend.line_user_id)
  } else {
    // Friends that do NOT have this tag
    // First get all friends, then subtract those with the tag
    const [allFriends, taggedFriends] = await Promise.all([
      supabase
        .from('friends')
        .select('line_user_id')
        .eq('channel_id', channelId),
      evaluateTag(supabase, channelId, { ...condition, operator: 'has' }),
    ])

    if (allFriends.error)
      throw new Error(`Tag evaluation error: ${allFriends.error.message}`)

    const taggedSet = new Set(taggedFriends)
    return (allFriends.data ?? [])
      .map((row) => row.line_user_id)
      .filter((id) => !taggedSet.has(id))
  }
}

async function evaluateFollowedDays(
  supabase: SupabaseClient,
  channelId: string,
  condition: Extract<SegmentCondition, { type: 'followed_days' }>
): Promise<string[]> {
  const now = new Date()
  const targetDate = new Date(now.getTime() - condition.value * 24 * 60 * 60 * 1000)
  const isoDate = targetDate.toISOString()

  let query = supabase
    .from('friends')
    .select('line_user_id')
    .eq('channel_id', channelId)

  if (condition.operator === 'gte') {
    // Followed at least N days ago -> followed_at <= targetDate
    query = query.lte('followed_at', isoDate)
  } else {
    // Followed at most N days ago -> followed_at >= targetDate
    query = query.gte('followed_at', isoDate)
  }

  const { data, error } = await query
  if (error) throw new Error(`Followed days evaluation error: ${error.message}`)
  return (data ?? []).map((row) => row.line_user_id)
}

async function evaluateStatus(
  supabase: SupabaseClient,
  channelId: string,
  condition: Extract<SegmentCondition, { type: 'status' }>
): Promise<string[]> {
  const { data, error } = await supabase
    .from('friends')
    .select('line_user_id')
    .eq('channel_id', channelId)
    .eq('status', condition.value)

  if (error) throw new Error(`Status evaluation error: ${error.message}`)
  return (data ?? []).map((row) => row.line_user_id)
}

async function evaluateCustomField(
  supabase: SupabaseClient,
  channelId: string,
  condition: Extract<SegmentCondition, { type: 'custom_field' }>
): Promise<string[]> {
  let query = supabase
    .from('friends')
    .select('line_user_id')
    .eq('channel_id', channelId)

  if (condition.operator === 'equals') {
    // Use JSONB containment operator via Supabase's contains filter
    query = query.contains('custom_fields', { [condition.field]: condition.value })
  } else if (condition.operator === 'contains') {
    // For partial match, use textSearch on the JSONB field extracted as text
    // Supabase PostgREST supports ->>'field' via the arrow syntax
    query = query.ilike(`custom_fields->>${condition.field}`, `%${condition.value}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(`Custom field evaluation error: ${error.message}`)
  return (data ?? []).map((row) => row.line_user_id)
}
