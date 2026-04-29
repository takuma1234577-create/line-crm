import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function createServiceClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
  return _client
}

/**
 * Lazy Supabase getter for use at module level.
 * Avoids crashing at build time when env vars are not yet available.
 */
export function getServiceClient(): SupabaseClient {
  return createServiceClient()
}
