import type {
  Pagination,
  Provider,
  Session as SupabaseSession,
  SupabaseClient,
  User,
} from '@supabase/supabase-js'
import type {
  AuthClaims,
  Dictionary,
  IPaginatedResult,
  ISuperAdminAuthService,
  Maybe,
  Optional,
  Session,
  UpdateIdentityDto,
} from '@xeno-js/core'
import type { IAuthService, IBaseAuthService, IBaseMapper, ResultType } from '@xeno-js/core'
import { AppError, Result } from '@xeno-js/core'
import { Guards } from '@xeno-js/core'

/**
 * @description The SupabaseAuthService class is responsible for handling authentication-related operations using a SupabaseClient instance. It implements the IAuthService interface, providing methods to check if a user is authenticated and to retrieve authentication claims from a given token. The authenticate method interacts with the Supabase authentication API to fetch user information based on the provided token, while the isAuthenticated method checks if there is an active session. The class also includes error handling to create standardized authentication errors when necessary.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export abstract class BaseSupabaseAuthService
  implements IBaseAuthService, IAuthService, ISuperAdminAuthService
{
  constructor(
    protected readonly _supabase: SupabaseClient,
    protected readonly _mapper: IBaseMapper<User, AuthClaims>,
    protected readonly _sessionMapper: IBaseMapper<SupabaseSession, Session>,
    private readonly _opts: { redirectTo: Optional<string> },
  ) {}

  public async authenticate(token: string): Promise<ResultType<AuthClaims>> {
    const { data, error } = await this._supabase.auth.getUser(token)

    if (Guards.isDefined(error) || !Guards.isDefined(data.user)) {
      return Result.fail(
        AppError.authFailed('SupabaseAuthenticationService', error?.message ?? 'Unknown error'),
      )
    }

    const user = data.user
    const claims = this._mapper.map(user)
    return Result.ok(claims)
  }

  public abstract isAuthenticated(): Promise<boolean>

  public async exchangeCodeForSession(
    code: string,
    flowId?: string,
  ): Promise<ResultType<Optional<Session>>> {
    const { data, error } = await this._supabase.auth.exchangeCodeForSession(code, { flowId })
    if (Guards.isDefined(error) || !Guards.isDefined(data.session))
      return Result.fail(
        AppError.authFailed('SupabaseAuthenticationService', error?.message ?? 'Unknown error'),
      )

    const session = data.session

    if (Guards.isDefined(session)) return Result.ok(this._sessionMapper.map(session))

    return Result.ok()
  }

  public async signInWithProvider(
    provider: Provider,
    options?: {
      redirectTo?: string
      scopes?: string
      queryParams?: Dictionary<string>
      skipBrowserRedirect?: boolean
    },
  ): Promise<ResultType<{ url: string }>> {
    const { data, error } = await this._supabase.auth.signInWithOAuth({
      provider,
      options: { ...options, redirectTo: this._opts.redirectTo },
    })

    if (Guards.isDefined(error) || Guards.isNullOrEmpty(data.url)) {
      return Result.fail(
        AppError.authFailed('SupabaseFrontendAuthService', error?.message ?? 'Unexpected error'),
      )
    }

    return Result.ok({ url: data.url })
  }

  public abstract getSession(): Promise<ResultType<Maybe<Session>>>

  public async getUser(): Promise<ResultType<Maybe<AuthClaims>>> {
    const { data, error } = await this._supabase.auth.getUser()
    if (Guards.isDefined(error)) {
      return Result.fail(AppError.authFailed('SupabaseFrontendAuthService', error.message))
    }
    const user = data.user
    if (Guards.isDefined(user)) return Result.ok(this._mapper.map(user))

    return Result.ok()
  }

  public async signOut(scope?: 'global' | 'local' | 'others'): Promise<ResultType<void>> {
    const { error } = await this._supabase.auth.signOut({ scope })
    if (Guards.isDefined(error)) {
      return Result.fail(AppError.authFailed('SupabaseFrontendAuthService', error.message))
    }
    return Result.ok()
  }

  public async getSessionToken(): Promise<ResultType<Optional<string>>> {
    const sessionResult = await this.getSession()
    if (!sessionResult.isOk()) {
      return Result.fail(sessionResult.getErrorOrThrow())
    }
    const session = sessionResult.getValueOrThrow()
    return Result.ok(session?.accessToken)
  }

  public async updateIdentity(userId: string, data: UpdateIdentityDto): Promise<ResultType<void>> {
    const { error } = await this._supabase.auth.admin.updateUserById(userId, data)
    if (Guards.isDefined(error)) {
      return Result.fail(AppError.authFailed('SupabaseAuthService', error.message))
    }
    return Result.ok(undefined)
  }

  public async getUserById(userId: string): Promise<ResultType<AuthClaims>> {
    const { data, error } = await this._supabase.auth.admin.getUserById(userId)
    if (Guards.isDefined(error) || !Guards.isDefined(data.user)) {
      return Result.fail(
        AppError.notFound('SupabaseAuthService', error?.message ?? 'User not found'),
      )
    }
    const claims = this._mapper.map(data.user)
    return Result.ok(claims)
  }

  public async listUsers(
    page = 1,
    perPage = 50,
  ): Promise<ResultType<IPaginatedResult<AuthClaims>>> {
    const { data, error } = await this._supabase.auth.admin.listUsers({
      page,
      perPage,
    })

    if (Guards.isDefined(error)) {
      return Result.fail(AppError.authFailed('SupabaseAuthService', error.message))
    }

    const items = data.users.map((user) => this._mapper.map(user))
    const paginated = data as {
      users: User[]
      aud: string
    } & Pagination

    const total = paginated.total ?? items.length

    const totalPages = Math.ceil(total / perPage)

    const paginatedResult: IPaginatedResult<AuthClaims> = {
      items,
      total,
      page,
      pageSize: perPage,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    }

    return Result.ok(paginatedResult)
  }

  public async deleteUser(userId: string, softDelete?: boolean): Promise<ResultType<void>> {
    const { error } = await this._supabase.auth.admin.deleteUser(userId, softDelete)
    if (Guards.isDefined(error)) {
      return Result.fail(AppError.authFailed('SupabaseAuthService', error.message))
    }
    return Result.ok(undefined)
  }
}
