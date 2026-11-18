// factories/supabase-server-client.factory.ts
import type { CookieMethodsServer, CookieOptionsWithName } from '@supabase/ssr'
import type { SupabaseClient, SupabaseClientOptions } from '@supabase/supabase-js'
import type { IFactory, ISsrCookieHandler, Optional } from '@xeno-js/core'

import { SupabaseClaimsMapper, SupabaseSessionMapper } from '../mappers'
import { SupabaseSsrService } from '../service/supabase-ssr.service'

export interface SupabaseServerClientInput<SchemaName extends string = 'public'> {
  readonly url: string
  readonly key: string
  readonly redirectTo?: Optional<string>
  readonly options: SupabaseClientOptions<SchemaName> & {
    cookieOptions?: CookieOptionsWithName
    cookies: CookieMethodsServer
    cookieEncoding?: 'raw' | 'base64url'
  }
  readonly cookieHandler: ISsrCookieHandler
}

export class SupabaseServerClientFactory implements IFactory<string, SupabaseSsrService> {
  constructor(private readonly client: SupabaseClient) {}
  public create(redirectTo: string): SupabaseSsrService {
    const claimsMapper = new SupabaseClaimsMapper()
    const sessionMapper = new SupabaseSessionMapper(claimsMapper)

    return new SupabaseSsrService(this.client, claimsMapper, sessionMapper, { redirectTo })
  }
}
