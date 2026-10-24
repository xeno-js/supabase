// factories/supabase-client.factory.ts
import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js'
import type { IFactory, Optional } from '@xeno-js/core'

import { SupabaseClaimsMapper, SupabaseSessionMapper } from '../mappers'
import { SupabaseService } from '../service/supabase.service'

export interface SupabaseClientInput<SchemaName extends string = 'public'> {
    url: string
    key: string
    options?: Optional<SupabaseClientOptions<SchemaName>>
    redirectTo?: Optional<string>
}

export class SupabaseClientFactory
    implements IFactory<SupabaseClientInput, SupabaseService> {
    public create(input: SupabaseClientInput): SupabaseService {
        const client = createClient(input.url, input.key, input.options)
        const claimsMapper = new SupabaseClaimsMapper()
        const sessionMapper = new SupabaseSessionMapper(claimsMapper)

        return new SupabaseService(
            client,
            claimsMapper,
            sessionMapper,
            { redirectTo: input.redirectTo },
        )
    }
}