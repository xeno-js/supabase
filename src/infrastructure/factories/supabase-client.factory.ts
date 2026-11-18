import type { SupabaseClient } from '@supabase/supabase-js'
import type { IClientAuthFactory } from '@xeno-js/core'
import { Guards } from '@xeno-js/core'

export class ClientAuthFactory implements IClientAuthFactory {
  constructor(
    private readonly publicClient: SupabaseClient,
    private readonly adminClient?: SupabaseClient,
  ) {}

  get<T>(input?: 'admin' | 'public'): T {
    switch (input) {
      case 'admin':
        if (!Guards.isDefined(this.adminClient))
          throw new Error('Admin client not configured: provide serviceRoleKey.')
        return this.adminClient as T
      case 'public':
        return this.publicClient as T
      default:
        throw new Error(`Unknown client type: ${input}`)
    }
  }
}
