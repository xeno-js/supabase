import type { User } from '@supabase/supabase-js'
import type { AuthClaims, IBaseMapper } from '@xeno-js/core'
import { Guards } from '@xeno-js/core'

/**
 * @description SupabaseClaimsMapper is responsible for mapping authentication claims (AuthClaims) to an Identity object. This mapper takes the claims extracted from a token (such as a JWT) and transforms them into a structured Identity that can be used throughout the application for authentication and authorization purposes. The mapping includes parsing the user ID and tenant ID from the claims, as well as extracting roles and permissions.
 * 
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js 
 */
export class SupabaseClaimsMapper implements IBaseMapper<User, AuthClaims> {
  public map(user: User): AuthClaims {
    const appMetadata = user.app_metadata ?? {}

    return {
      sub: user.id,
      email: user.email,
      name: Guards.isString(user.user_metadata?.['name'])
        ? user.user_metadata?.['name']
        : undefined,
      tenantId: Guards.isString(appMetadata?.['tenant_id'])
        ? appMetadata?.['tenant_id']
        : undefined,
      roles: Guards.isArray(appMetadata['roles']) ? (appMetadata['roles'] as string[]) : undefined,
      permissions: Guards.isArray(appMetadata['permissions'])
        ? (appMetadata['permissions'] as string[])
        : undefined,
    }
  }
}
