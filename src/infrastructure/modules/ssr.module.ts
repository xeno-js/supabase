import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  AuthModule,
  Guards,
  type IServiceContainer,
  type ISsrCookieHandler,
  TOKENS,
  type XenoRegistry,
} from '@xeno-js/core'

import { ClientAuthFactory } from '../factories/supabase-client.factory'
import { SupabaseServerClientFactory } from '../factories/supabase-ssr.factory'
import { SupabaseSsrTokenExtractor } from '../service/extract-ssr-bearer.extractor'
import type { SupabaseAuthConfig } from '../supabase.plugin'

export class SsrModule<TRegistry extends XenoRegistry = XenoRegistry> {
  public async run(options: SupabaseAuthConfig): Promise<{
    configure: (container: IServiceContainer<TRegistry>) => Promise<void>
  }> {
    const ssrConfig = options.ssr
    if (!Guards.isDefined(ssrConfig)) throw new Error('Please, provide a ssr configurations')

    const module = new AuthModule<TRegistry>()
    return {
      configure: async (container: IServiceContainer<TRegistry>) => {
        const buildClientFactory = (cookieHandler: ISsrCookieHandler): ClientAuthFactory => {
          const createClientFor = (key: string): SupabaseClient =>
            createServerClient(options.url, key, {
              ...ssrConfig.options,
              auth: {
                flowType: ssrConfig.options?.auth?.flowType ?? 'pkce',
                detectSessionInUrl: ssrConfig.options?.auth?.detectSessionInUrl ?? false,
                autoRefreshToken: ssrConfig.options?.auth?.autoRefreshToken ?? false,
                persistSession: ssrConfig.options?.auth?.persistSession ?? true,
              },
              cookieEncoding: ssrConfig.cookieEncoding,
              cookies: {
                getAll: () => cookieHandler.getAll(),
                setAll: (cookiesToSet) => cookieHandler.setAll(cookiesToSet),
              },
              cookieOptions: {
                path: ssrConfig.cookieOptions?.path ?? '/',
                httpOnly: ssrConfig.cookieOptions?.httpOnly ?? true,
                secure: ssrConfig.cookieOptions?.secure ?? true,
                sameSite: ssrConfig.cookieOptions?.sameSite ?? 'lax',
              },
            })

          const adminClient = Guards.isDefined(options.serviceRoleKey)
            ? createClientFor(options.serviceRoleKey)
            : undefined

          return new ClientAuthFactory(createClientFor(options.key), adminClient)
        }

        container.addScoped('clientAuthFactory', (scope) =>
          buildClientFactory(ssrConfig.cookieHandler ?? scope.resolve(TOKENS.COOKIE_HANDLER)),
        )

        await module.configure(container, {
          authService: (scope) => {
            const factory = scope.resolve('clientAuthFactory')
            return new SupabaseServerClientFactory(factory.get<SupabaseClient>('public')).create(
              options.redirectTo ?? '',
            )
          },
          tokenExtractor: (scope) => ({
            extract: (headers) => {
              if (!Guards.isDefined(scope)) return undefined

              const cookieHandler = ssrConfig.cookieHandler ?? scope.resolve(TOKENS.COOKIE_HANDLER)

              const extractor = new SupabaseSsrTokenExtractor(
                cookieHandler,
                ssrConfig.cookiePrefix ?? 'sb-access-token',
              )

              return extractor.extract(headers)
            },
          }),
          cookieHandlerOptions: {
            enableDefault: {
              enable: !Guards.isDefined(ssrConfig.cookieHandler),
              options: {
                path: ssrConfig.cookieOptions?.path ?? '/',
                httpOnly: ssrConfig.cookieOptions?.httpOnly ?? true,
                secure: ssrConfig.cookieOptions?.secure ?? true,
                sameSite: ssrConfig.cookieOptions?.sameSite ?? 'lax',
              },
            },
            cookieHandlerCustom: Guards.isDefined(ssrConfig.cookieHandler)
              ? () => ssrConfig.cookieHandler!
              : undefined,
          },
        })

        if (Guards.isDefined(options.serviceRoleKey)) {
          container.addScoped('superadminAuthService', (scope) => {
            const factory = scope.resolve('clientAuthFactory')
            return new SupabaseServerClientFactory(factory.get<SupabaseClient>('admin')).create(
              options.redirectTo ?? '',
            )
          })
        }
      },
    }
  }
}
