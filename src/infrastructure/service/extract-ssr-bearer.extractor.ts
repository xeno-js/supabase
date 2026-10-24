import type { ISsrCookie, ISsrCookieHandler } from '@xeno-js/core'
import { Guards, type IServiceExtractor, type Optional, StringHelper } from '@xeno-js/shared'

/**
 * @description The SupabaseSsrTokenExtractor class is a specialized implementation of the IServiceExtractor interface that extracts the Supabase SSR token from the HTTP headers. It is designed to work with Supabase's server-side rendering (SSR) functionality, where the token is stored in the HTTP headers for server-side rendering purposes. The extract method retrieves the token from the headers and returns it as a string.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class SupabaseSsrTokenExtractor
  implements IServiceExtractor<Request['headers'], Optional<string>> {
  constructor(
    private readonly _cookieHandler: ISsrCookieHandler,
    private readonly _prefix?: Optional<string>,
  ) { }

  public extract(headers: Request['headers']): Optional<string> {
    const authHeader = headers.get('authorization')
    if (Guards.isDefined(authHeader) && authHeader.toLowerCase().startsWith('bearer ')) {
      const bearerToken = authHeader.substring(7).trim()
      if (!Guards.isNullOrEmpty(bearerToken)) {
        return bearerToken
      }
    }

    const allCookies = this._cookieHandler.getAll()
    if (allCookies.length === 0) {
      return undefined
    }

    return this.extractFromCookies(allCookies)
  }

  private extractFromCookies(cookies: ISsrCookie[]): Optional<string> {
    const customName = this._prefix
    const chunkRegex = !Guards.isNullOrEmpty(customName)
      ? new RegExp(`^${this.escapeRegex(customName)}\\.(\\d+)$`)
      : /^sb-[a-z0-9]+-auth-token\.(\d+)$/

    const singleRegex = !Guards.isNullOrEmpty(customName)
      ? new RegExp(`^${this.escapeRegex(customName)}$`)
      : /^sb-[a-z0-9]+-auth-token$/

    const chunks = new Map<number, string>()
    let singlePayload: Optional<string> = undefined

    for (const cookie of cookies) {
      if (!Guards.isDefined(cookie.value)) continue

      if (singleRegex.test(cookie.name)) {
        singlePayload = cookie.value
        break
      }

      const match = chunkRegex.exec(cookie.name)
      if (Guards.isDefined(match) && Guards.isDefined(match[1])) {
        const index = parseInt(match[1], 10)
        chunks.set(index, cookie.value)
      }
    }

    let rawSessionData: Optional<string> = singlePayload

    if (!Guards.isDefined(rawSessionData) && chunks.size > 0) {
      const sortedKeys = Array.from(chunks.keys()).sort((a, b) => a - b)
      rawSessionData = sortedKeys.map((idx) => chunks.get(idx)).join('')
    }

    if (Guards.isNullOrEmpty(rawSessionData)) {
      return undefined
    }

    return this.parseAccessToken(rawSessionData)
  }

  private parseAccessToken(rawValue: string): Optional<string> {
    let parsed = StringHelper.safeParse<Record<string, unknown>>(rawValue)

    if (Guards.isString(parsed)) {
      try {
        const normalizedBase64 = rawValue.replace(/-/g, '+').replace(/_/g, '/')
        const decoded = atob(normalizedBase64)
        parsed = StringHelper.safeParse<Record<string, unknown>>(decoded)
      } catch {
        return undefined
      }
    }

    if (
      Guards.isDefined(parsed) &&
      Guards.isObject(parsed) &&
      'access_token' in parsed &&
      Guards.isString(parsed.access_token)
    ) {
      return parsed.access_token
    }

    return undefined
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}