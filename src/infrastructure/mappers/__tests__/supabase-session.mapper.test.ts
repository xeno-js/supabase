import type { Session as SupabaseSession, User } from '@supabase/supabase-js'
import type { AuthClaims, IBaseMapper, Session } from '@xeno-js/core'
import { describe, expect, it, vi } from 'vitest'

import { SupabaseSessionMapper } from '../supabase-session.mapper'

describe('SupabaseSessionMapper', () => {
  it('should map session tokens, expiration and claims', () => {
    const user = { id: 'user-1' } as unknown as User
    const claims: AuthClaims = {
      sub: 'user-1',
      email: 'user@example.com',
      name: 'User',
      tenantId: 'tenant-1',
      roles: ['user'],
      permissions: ['read'],
    }
    const map = vi.fn().mockReturnValue(claims)
    const claimsMapper: IBaseMapper<User, AuthClaims> = {
      map,
    }
    const session = {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_at: 1700000000,
      user,
    } as unknown as SupabaseSession

    const result = new SupabaseSessionMapper(claimsMapper).map(session)

    expect(map).toHaveBeenCalledWith(user)
    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: 1700000000,
      user: claims,
    } satisfies Session)
  })
})
