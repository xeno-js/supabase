import type { User } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import { SupabaseClaimsMapper } from '../supabase-claims.mapper'

describe('SupabaseClaimsMapper', () => {
  it('should map user and authentication metadata to claims', () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      user_metadata: { name: 'Ada' },
      app_metadata: {
        tenant_id: 'tenant-1',
        roles: ['admin'],
        permissions: ['read:users'],
      },
      aud: '',
      created_at: '',
    }

    expect(new SupabaseClaimsMapper().map(user)).toEqual({
      sub: 'user-1',
      email: 'user@example.com',
      name: 'Ada',
      tenantId: 'tenant-1',
      roles: ['admin'],
      permissions: ['read:users'],
    })
  })

  it('should omit absent and invalid metadata values', () => {
    const user = {
      id: 'user-2',
      email: undefined,
      user_metadata: { name: 123 },
      app_metadata: {
        tenant_id: 456,
        roles: 'admin',
        permissions: { read: true },
      },
    } as unknown as User

    expect(new SupabaseClaimsMapper().map(user)).toEqual({
      sub: 'user-2',
      email: undefined,
      name: undefined,
      tenantId: undefined,
      roles: undefined,
      permissions: undefined,
    })
  })

  it('should handle missing metadata objects', () => {
    const user = {
      id: 'user-3',
      email: null,
      user_metadata: undefined,
      app_metadata: undefined,
    } as unknown as User

    expect(new SupabaseClaimsMapper().map(user)).toMatchObject({
      sub: 'user-3',
      name: undefined,
      tenantId: undefined,
      roles: undefined,
      permissions: undefined,
    })
  })
})
