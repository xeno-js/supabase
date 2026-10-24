// infrastructure/mappers/supabase-session.mapper.ts
import type { Session as SupabaseSession, User } from '@supabase/supabase-js'
import type { AuthClaims, IBaseMapper, Session } from '@xeno-js/core'

export class SupabaseSessionMapper implements IBaseMapper<SupabaseSession, Session> {
  constructor(private readonly _claimsMapper: IBaseMapper<User, AuthClaims>) {}

  public map(source: SupabaseSession): Session {
    const claims = this._claimsMapper.map(source.user)
    return {
      accessToken: source.access_token,
      refreshToken: source.refresh_token,
      expiresAt: source.expires_at,
      user: claims,
    }
  }
}
