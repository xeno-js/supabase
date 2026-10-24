import {
    AuthModule,
    type IServiceContainer,
    type XenoRegistry,
} from '@xeno-js/core'

import {
    SupabaseClientFactory,
    type SupabaseClientInput,
} from '../factories/supabase.factory'
import type { SupabaseAuthConfig } from '../supabase.plugin'

/**
 * @description Modulo responsabile della configurazione del client Supabase in modalità CSR / SPA.
 */
export class CsrModule<TRegistry extends XenoRegistry = XenoRegistry> {
    public async run(options: SupabaseAuthConfig): Promise<{
        configure: (container: IServiceContainer<TRegistry>) => Promise<void>
    }> {
        const csrConfig = options.csr
        const module = new AuthModule<TRegistry>()

        return {
            configure: async (container: IServiceContainer<TRegistry>) => {
                const inputFactory: SupabaseClientInput = {
                    url: options.url,
                    key: options.key,
                    redirectTo: options.redirectTo,
                    options: csrConfig?.options,
                }

                const clientService = new SupabaseClientFactory().create(inputFactory)

                await module.configure(container, {
                    authService: () => clientService,
                    defaultCookieName: csrConfig?.cookieName ?? 'sb-access-token',
                })
            },
        }
    }
}