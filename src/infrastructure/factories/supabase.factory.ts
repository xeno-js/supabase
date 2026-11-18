// factories/supabase-client.factory.ts
import type { SupabaseClient, SupabaseClientOptions } from '@supabase/supabase-js'
import type { IFactory, Optional } from '@xeno-js/core'

import { SupabaseClaimsMapper, SupabaseSessionMapper } from '../mappers'
import { SupabaseService } from '../service/supabase.service'

export interface SupabaseClientInput<SchemaName extends string = 'public'> {
  url: string
  key: string
  options?: Optional<SupabaseClientOptions<SchemaName>>
  redirectTo?: Optional<string>
}

export class SupabaseClientFactory implements IFactory<string, SupabaseService> {
  constructor(private readonly client: SupabaseClient) {}
  public create(redirectTo: string): SupabaseService {
    const claimsMapper = new SupabaseClaimsMapper()
    const sessionMapper = new SupabaseSessionMapper(claimsMapper)

    return new SupabaseService(this.client, claimsMapper, sessionMapper, { redirectTo })
  }
}
