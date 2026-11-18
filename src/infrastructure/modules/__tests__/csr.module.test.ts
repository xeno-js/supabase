import type { IServiceContainer } from '@xeno-js/core'
import { describe, expect, it, vi } from 'vitest'

import type { SupabaseAuthConfig } from '../../supabase.plugin'
import { CsrModule } from '../csr.module'

const makeContainer = () => {
  const addScoped = vi.fn<(key: string, ...args: unknown[]) => void>()
  const addSingleton = vi.fn<(key: string, ...args: unknown[]) => void>()
  const container = { addScoped, addSingleton } as unknown as IServiceContainer
  return { container, addScoped, addSingleton }
}

const baseOptions: SupabaseAuthConfig = {
  url: 'http://localhost:54321',
  key: 'anon-key',
  redirectTo: 'http://localhost:5173/callback',
}

describe('CsrModule', () => {
  it('does not register superadminAuthService without serviceRoleKey', async () => {
    const { container, addScoped } = makeContainer()
    const { configure } = await new CsrModule().run(baseOptions)

    await configure(container)

    const keys = addScoped.mock.calls.map(([key]) => key)
    expect(keys).not.toContain('superadminAuthService')
  })

  it('registers superadminAuthService when serviceRoleKey is provided', async () => {
    const { container, addScoped } = makeContainer()
    const { configure } = await new CsrModule().run({
      ...baseOptions,
      serviceRoleKey: 'service-role-key',
    })

    await configure(container)

    const keys = addScoped.mock.calls.map(([key]) => key)
    expect(keys).toContain('superadminAuthService')
  })
})
