import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { IServiceContainer, XenoRegistry } from '@xeno-js/core'
import { AuthModule, Guards } from '@xeno-js/core'

import { SupabaseClientFactory } from '../factories/supabase.factory'
import { ClientAuthFactory } from '../factories/supabase-client.factory'
import type { SupabaseAuthConfig } from '../supabase.plugin'

/**
 * @description Modulo responsabile della configurazione del client Supabase in modalità CSR / SPA.
 * Il client admin (service role) viene creato solo se è presente `serviceRoleKey`.
 */
export class CsrModule<TRegistry extends XenoRegistry = XenoRegistry> {
  public async run(options: SupabaseAuthConfig): Promise<{
    configure: (container: IServiceContainer<TRegistry>) => Promise<void>
  }> {
    const csrConfig = options.csr
    const module = new AuthModule<TRegistry>()
    const redirectTo = options.redirectTo ?? ''

    return {
      configure: async (container: IServiceContainer<TRegistry>) => {
        const publicClient = createClient(options.url, options.key, csrConfig?.options)

        const adminClient = Guards.isDefined(options.serviceRoleKey)
          ? createClient(options.url, options.serviceRoleKey, {
              ...csrConfig?.options,
              auth: {
                ...csrConfig?.options?.auth,
                persistSession: false,
                autoRefreshToken: false,
              },
            })
          : undefined

        const factory = new ClientAuthFactory(publicClient, adminClient)
        container.addScoped('clientAuthFactory', () => factory)

        await module.configure(container, {
          authService: (c) => {
            const scopedFactory = c.resolve('clientAuthFactory')
            return new SupabaseClientFactory(scopedFactory.get<SupabaseClient>('public')).create(
              redirectTo,
            )
          },
          defaultCookieName: csrConfig?.cookieName ?? 'sb-access-token',
        })

        if (Guards.isDefined(adminClient)) {
          container.addScoped('superadminAuthService', (c) => {
            const scopedFactory = c.resolve('clientAuthFactory')
            return new SupabaseClientFactory(scopedFactory.get<SupabaseClient>('admin')).create(
              redirectTo,
            )
          })
        }
      },
    }
  }
}
