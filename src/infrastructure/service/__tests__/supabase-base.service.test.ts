import type {
  Pagination,
  Session as SupabaseSession,
  SupabaseClient,
  User,
} from '@supabase/supabase-js'
import type {
  AuthClaims,
  IBaseMapper,
  Maybe,
  ResultType,
  Session,
  UpdateIdentityDto,
} from '@xeno-js/core'
import { AppError, Result } from '@xeno-js/core'
import { describe, expect, it, vi } from 'vitest'

import { BaseSupabaseAuthService } from '../supabase-base.service'

class TestSupabaseAuthService extends BaseSupabaseAuthService {
  private _sessionResult: ResultType<Maybe<Session>> = Result.ok()

  public setSessionResult(result: ResultType<Maybe<Session>>): void {
    this._sessionResult = result
  }

  public async getSession(): Promise<ResultType<Maybe<Session>>> {
    return this._sessionResult
  }

  public async isAuthenticated(): Promise<boolean> {
    return true
  }
}

interface SupabaseMock {
  auth: {
    getUser: ReturnType<typeof vi.fn>
    exchangeCodeForSession: ReturnType<typeof vi.fn>
    signInWithOAuth: ReturnType<typeof vi.fn>
    signOut: ReturnType<typeof vi.fn>
    admin: {
      updateUserById: ReturnType<typeof vi.fn>
      getUserById: ReturnType<typeof vi.fn>
      listUsers: ReturnType<typeof vi.fn>
      deleteUser: ReturnType<typeof vi.fn>
    }
  }
}

function createService(redirectTo = 'https://app.local/callback') {
  const auth = {
    getUser: vi.fn(),
    exchangeCodeForSession: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
    admin: {
      updateUserById: vi.fn(),
      getUserById: vi.fn(),
      listUsers: vi.fn(),
      deleteUser: vi.fn(),
    },
  }

  const supabase = { auth } as unknown as SupabaseClient
  const mapClaims = vi.fn((user: User): AuthClaims => ({
    sub: user.id,
    email: user.email,
    name: 'Mapped User',
    tenantId: 'tenant-1',
    roles: ['user'],
    permissions: ['read'],
  }))

  const claimsMapper: IBaseMapper<User, AuthClaims> = {
    map: mapClaims,
  }

  const mapSession = vi.fn((session: SupabaseSession): Session => ({
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at,
    user: {
      sub: session.user.id,
      email: session.user.email,
      name: 'Mapped User',
      tenantId: 'tenant-1',
      roles: ['user'],
      permissions: ['read'],
    },
  }))

  const sessionMapper: IBaseMapper<SupabaseSession, Session> = {
    map: mapSession,
  }

  return {
    service: new TestSupabaseAuthService(supabase, claimsMapper, sessionMapper, { redirectTo }),
    claimsMapper,
    mapClaims,
    sessionMapper,
    mapSession,
    supabase: supabase as unknown as SupabaseMock,
  }
}

describe('BaseSupabaseAuthService', () => {
  it('authenticate returns mapped claims when supabase returns user', async () => {
    const { service, mapClaims, supabase } = createService()
    const user = { id: 'user-1', email: 'user@example.com' } as User
    supabase.auth.getUser.mockResolvedValue({ data: { user }, error: null })

    const result = await service.authenticate('token-1')

    expect(result.isOk()).toBe(true)
    expect(mapClaims).toHaveBeenCalledWith(user)
    expect(result.getValueOrThrow()).toMatchObject({ sub: 'user-1' })
  })

  it('authenticate fails when supabase returns error', async () => {
    const { service, supabase } = createService()
    supabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid token' },
    })

    const result = await service.authenticate('bad-token')

    expect(result.isOk()).toBe(false)
    expect(result.getErrorOrThrow().message).toContain('errors.authentication_failed')
  })

  it('exchangeCodeForSession maps session when available', async () => {
    const { service, mapSession, supabase } = createService()
    const session = {
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      expires_at: 123,
      user: { id: 'user-1', email: 'user@example.com' },
    } as unknown as SupabaseSession

    supabase.auth.exchangeCodeForSession.mockResolvedValue({ data: { session }, error: null })

    const result = await service.exchangeCodeForSession('code-1', 'flow-1')

    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('code-1', {
      flowId: 'flow-1',
    })
    expect(result.isOk()).toBe(true)
    expect(mapSession).toHaveBeenCalledWith(session)
  })

  it('exchangeCodeForSession fails when session is missing or error exists', async () => {
    const { service, supabase } = createService()
    supabase.auth.exchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: null })

    const missingSession = await service.exchangeCodeForSession('code-1')

    expect(missingSession.isOk()).toBe(false)

    supabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'exchange failed' },
    })

    const withError = await service.exchangeCodeForSession('code-2')

    expect(withError.isOk()).toBe(false)
    expect(withError.getErrorOrThrow().message).toContain('errors.authentication_failed')
  })

  it('signInWithProvider returns oauth url using configured redirect', async () => {
    const { service, supabase } = createService('https://configured.local/callback')
    supabase.auth.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://provider.local/login' },
      error: null,
    })

    const result = await service.signInWithProvider('github', {
      redirectTo: 'https://ignored.local/callback',
      scopes: 'read:user',
      skipBrowserRedirect: true,
    })

    expect(result.isOk()).toBe(true)
    expect(result.getValueOrThrow()).toEqual({ url: 'https://provider.local/login' })
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'github',
      options: {
        redirectTo: 'https://configured.local/callback',
        scopes: 'read:user',
        skipBrowserRedirect: true,
      },
    })
  })

  it('signInWithProvider fails when url is missing or error exists', async () => {
    const { service, supabase } = createService()
    supabase.auth.signInWithOAuth.mockResolvedValue({ data: { url: '' }, error: null })

    const noUrl = await service.signInWithProvider('github')

    expect(noUrl.isOk()).toBe(false)

    supabase.auth.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://provider.local' },
      error: { message: 'oauth failed' },
    })

    const withError = await service.signInWithProvider('google')

    expect(withError.isOk()).toBe(false)
    expect(withError.getErrorOrThrow().message).toContain('errors.authentication_failed')
  })

  it('getUser returns mapped claims when user exists', async () => {
    const { service, mapClaims, supabase } = createService()
    const user = { id: 'user-2', email: 'user2@example.com' } as User
    supabase.auth.getUser.mockResolvedValue({ data: { user }, error: null })

    const result = await service.getUser()

    expect(result.isOk()).toBe(true)
    expect(mapClaims).toHaveBeenCalledWith(user)
  })

  it('getUser returns empty success when user is missing and fails on error', async () => {
    const { service, supabase } = createService()
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

    const missingUser = await service.getUser()

    expect(missingUser.isOk()).toBe(true)
    expect(missingUser.getValueOrThrow()).toBeUndefined()

    supabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'cannot fetch user' },
    })

    const failed = await service.getUser()

    expect(failed.isOk()).toBe(false)
    expect(failed.getErrorOrThrow().message).toContain('errors.authentication_failed')
  })

  it('signOut returns success or failure based on supabase response', async () => {
    const { service, supabase } = createService()
    supabase.auth.signOut.mockResolvedValue({ error: null })

    const ok = await service.signOut('global')

    expect(ok.isOk()).toBe(true)
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'global' })

    supabase.auth.signOut.mockResolvedValue({ error: { message: 'signout failed' } })

    const fail = await service.signOut('local')

    expect(fail.isOk()).toBe(false)
    expect(fail.getErrorOrThrow().message).toContain('errors.authentication_failed')
  })

  it('getSessionToken returns token, empty token, or propagated error', async () => {
    const { service } = createService()
    service.setSessionResult(Result.ok({ accessToken: 'session-token' } as Session))

    const token = await service.getSessionToken()

    expect(token.isOk()).toBe(true)
    expect(token.getValueOrThrow()).toBe('session-token')

    service.setSessionResult(Result.ok(undefined))

    const empty = await service.getSessionToken()

    expect(empty.isOk()).toBe(true)
    expect(empty.getValueOrThrow()).toBeUndefined()

    const authError = AppError.authFailed('TestSupabaseAuthService', 'session failed')
    service.setSessionResult(Result.fail(authError))

    const failed = await service.getSessionToken()

    expect(failed.isOk()).toBe(false)
    expect(failed.getErrorOrThrow()).toBe(authError)
  })

  it('updateIdentity returns success or failure based on admin update result', async () => {
    const { service, supabase } = createService()
    const identity: UpdateIdentityDto = { email: 'new@example.com' }

    supabase.auth.admin.updateUserById.mockResolvedValue({ error: null })

    const ok = await service.updateIdentity('user-3', identity)

    expect(ok.isOk()).toBe(true)
    expect(supabase.auth.admin.updateUserById).toHaveBeenCalledWith('user-3', identity)

    supabase.auth.admin.updateUserById.mockResolvedValue({ error: { message: 'update failed' } })

    const fail = await service.updateIdentity('user-3', identity)

    expect(fail.isOk()).toBe(false)
    expect(fail.getErrorOrThrow().message).toContain('errors.authentication_failed')
  })

  it('getUserById returns mapped user or not found error', async () => {
    const { service, mapClaims, supabase } = createService()
    const user = { id: 'user-4', email: 'user4@example.com' } as User
    supabase.auth.admin.getUserById.mockResolvedValue({ data: { user }, error: null })

    const ok = await service.getUserById('user-4')

    expect(ok.isOk()).toBe(true)
    expect(mapClaims).toHaveBeenCalledWith(user)

    supabase.auth.admin.getUserById.mockResolvedValue({ data: { user: null }, error: null })

    const missing = await service.getUserById('missing')

    expect(missing.isOk()).toBe(false)
    expect(missing.getErrorOrThrow().message).toContain('errors.not_found')

    supabase.auth.admin.getUserById.mockResolvedValue({
      data: { user: null },
      error: { message: 'admin error' },
    })

    const failed = await service.getUserById('broken')

    expect(failed.isOk()).toBe(false)
    expect(failed.getErrorOrThrow().message).toContain('errors.not_found')
  })

  it('listUsers maps users and computes pagination', async () => {
    const { service, mapClaims, supabase } = createService()
    const users = [
      { id: 'u1', email: 'u1@example.com' },
      { id: 'u2', email: 'u2@example.com' },
    ] as User[]

    supabase.auth.admin.listUsers.mockResolvedValue({
      data: {
        users,
        aud: 'authenticated',
        total: 5,
      } as { users: User[]; aud: string } & Pagination,
      error: null,
    })

    const result = await service.listUsers(2, 2)

    expect(result.isOk()).toBe(true)
    expect(mapClaims).toHaveBeenCalledTimes(2)
    expect(result.getValueOrThrow()).toMatchObject({
      items: [{ sub: 'u1' }, { sub: 'u2' }],
      total: 5,
      page: 2,
      pageSize: 2,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    })
  })

  it('listUsers falls back to mapped item count when total is missing and fails on error', async () => {
    const { service, supabase } = createService()
    const users = [{ id: 'u1', email: 'u1@example.com' }] as User[]

    supabase.auth.admin.listUsers.mockResolvedValue({
      data: {
        users,
        aud: 'authenticated',
      } as { users: User[]; aud: string } & Pagination,
      error: null,
    })

    const fallbackTotal = await service.listUsers(1, 50)

    expect(fallbackTotal.isOk()).toBe(true)
    expect(fallbackTotal.getValueOrThrow()).toMatchObject({
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    })

    supabase.auth.admin.listUsers.mockResolvedValue({
      data: {
        users: [] as User[],
        aud: 'authenticated',
      } as unknown as { users: User[]; aud: string } & Pagination,
      error: { message: 'cannot list users' },
    })

    const failed = await service.listUsers()

    expect(failed.isOk()).toBe(false)
    expect(failed.getErrorOrThrow().message).toContain('errors.authentication_failed')
  })

  it('deleteUser returns success or failure based on admin delete result', async () => {
    const { service, supabase } = createService()
    supabase.auth.admin.deleteUser.mockResolvedValue({ error: null })

    const ok = await service.deleteUser('user-5', true)

    expect(ok.isOk()).toBe(true)
    expect(supabase.auth.admin.deleteUser).toHaveBeenCalledWith('user-5', true)

    supabase.auth.admin.deleteUser.mockResolvedValue({ error: { message: 'delete failed' } })

    const fail = await service.deleteUser('user-5')

    expect(fail.isOk()).toBe(false)
    expect(fail.getErrorOrThrow().message).toContain('errors.authentication_failed')
  })
})
