import type { SupabaseClientOptions } from '@supabase/supabase-js'
import type {
  AuthPlugin,
  IConfigurationService,
  ISsrCookieHandler,
  ISsrCookieToSet,
  Optional,
  SetupAction,
  XenoRegistry,
} from '@xeno-js/core'
import { definePlugin, Guards } from '@xeno-js/core'

import { CsrModule } from './modules/csr.module'

export interface SupabaseAuthConfig<SchemaName extends string = 'public'> {
  url: string,
  key: string,
  redirectTo?: Optional<string>
  ssr?: {
    options?: SupabaseClientOptions<SchemaName>
    cookieEncoding?: "raw" | "base64url";
    cookieHandler?: Optional<ISsrCookieHandler>
    cookieOptions?: Optional<Partial<ISsrCookieToSet>>
    cookiePrefix?: Optional<string>
  }
  csr?: {
    options?: Optional<SupabaseClientOptions<SchemaName>>
    cookieName?: Optional<string>
  }
}

/**
 * @description Plugin per integrare Supabase (Standard o SSR) in Xeno.JS.
 * Configura automaticamente le factory e registra l'AuthModule nel container.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export const withSupabase = <
  TRegistry extends XenoRegistry = XenoRegistry,
  SchemaName extends string = 'public',
>(
  setupAction: SetupAction<SupabaseAuthConfig<SchemaName>, IConfigurationService>
): AuthPlugin<TRegistry> => {
  return definePlugin('auth', (builder, config) => {
    const options: SupabaseAuthConfig<SchemaName> = {
      url: config.get('SUPABASE_URL') ?? '',
      key: config.get('SUPABASE_KEY') ?? '',
      redirectTo: config.get('SUPABASE_REDIRECT_TO')
    }

    setupAction(options, config)

    if (Guards.isNullOrEmpty(options.url) || Guards.isNullOrEmpty(options.key))
      throw new Error('[SupabasePlugin Error]: Supabase URL and key are required.')

    if (Guards.isDefined(options.ssr)) {
      builder.addModule(
        'AuthModule',
        async () => {
          const { SsrModule } = await import('./modules/ssr.module')
          return new SsrModule().run(options as SupabaseAuthConfig)
        },
        undefined,
        2,
      )
    } else {
      builder.addModule(
        'AuthModule',
        async () => {
          return new CsrModule().run(options as SupabaseAuthConfig)
        },
        undefined,
        2,
      )
    }
  })
}