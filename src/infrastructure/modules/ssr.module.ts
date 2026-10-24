import { AuthModule, Guards, type IServiceContainer, type ISsrCookie, type ISsrCookieToSet, TOKENS, type XenoRegistry } from "@xeno-js/core";

import { SupabaseServerClientFactory, type SupabaseServerClientInput } from "../factories/supabase-ssr.factory";
import { SupabaseSsrTokenExtractor } from "../service/extract-ssr-bearer.extractor";
import type { SupabaseAuthConfig } from "../supabase.plugin";

export class SsrModule<TRegistry extends XenoRegistry = XenoRegistry> {
    public async run(options: SupabaseAuthConfig): Promise<{
        configure: (container: IServiceContainer<TRegistry>) => Promise<void>;
    }> {
        const ssrConfig = options.ssr
        if (!Guards.isDefined(ssrConfig))
            throw new Error('Please, provide a ssr configurations')

        const module = new AuthModule<TRegistry>()
        return {
            configure: async (container: IServiceContainer<TRegistry>) => {
                await module.configure(container, {
                    authService: (scope) => {
                        const cookieHandler =
                            ssrConfig.cookieHandler ?? scope.resolve(TOKENS.COOKIE_HANDLER)

                        const inputFactory: SupabaseServerClientInput = {
                            url: options.url,
                            key: options.key,
                            redirectTo: options.redirectTo,
                            cookieHandler: ssrConfig.cookieHandler ?? scope.resolve(TOKENS.COOKIE_HANDLER),
                            options: {
                                ...ssrConfig.options,
                                auth: {
                                    flowType: ssrConfig.options?.auth?.flowType ?? 'pkce',
                                    detectSessionInUrl: ssrConfig.options?.auth?.detectSessionInUrl ?? false,
                                    autoRefreshToken: ssrConfig.options?.auth?.autoRefreshToken ?? false,
                                    persistSession: ssrConfig.options?.auth?.persistSession ?? true
                                },
                                cookieEncoding: ssrConfig.cookieEncoding,
                                cookies: {
                                    getAll(): ISsrCookie[] {
                                        return cookieHandler.getAll()
                                    },
                                    setAll(cookiesToSet: ISsrCookieToSet[]): void {
                                        cookieHandler.setAll(cookiesToSet)
                                    },
                                },
                                cookieOptions: {
                                    path: ssrConfig.cookieOptions?.path ?? '/',
                                    httpOnly: ssrConfig.cookieOptions?.httpOnly ?? true,
                                    secure: ssrConfig.cookieOptions?.secure ?? true,
                                    sameSite: ssrConfig.cookieOptions?.sameSite ?? 'lax',
                                }
                            }
                        }
                        return new SupabaseServerClientFactory().create(inputFactory)
                    }, tokenExtractor: (scope) => ({
                        extract: (headers) => {
                            if (!Guards.isDefined(scope)) return undefined

                            const cookieHandler =
                                ssrConfig.cookieHandler ?? scope.resolve(TOKENS.COOKIE_HANDLER)

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
                        cookieHandlerCustom: Guards.isDefined(ssrConfig.cookieHandler) ? () => ssrConfig.cookieHandler! : undefined
                    },
                })
            },
        }
    }
}