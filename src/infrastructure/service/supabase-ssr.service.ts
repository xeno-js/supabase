import type { Maybe, ResultType, Session } from "@xeno-js/core";
import { AppError, Guards, Result } from "@xeno-js/core";

import { BaseSupabaseAuthService } from "./supabase-base.service";

export class SupabaseSsrService extends BaseSupabaseAuthService {
    public async getSession(): Promise<ResultType<Maybe<Session>>> {
        const { data: userData, error: userError } = await this._supabase.auth.getUser()
        if (Guards.isDefined(userError) || !Guards.isDefined(userData.user)) {
            return Result.ok(undefined)
        }

        const { data, error } = await this._supabase.auth.getSession()
        if (Guards.isDefined(error)) {
            return Result.fail(AppError.authFailed(this.constructor.name, error.message))
        }

        const session = data.session
        if (Guards.isDefined(session)) {
            return Result.ok(this._sessionMapper.map(session))
        }

        return Result.ok()
    }

    public async isAuthenticated(): Promise<boolean> {
        const { data, error } = await this._supabase.auth.getUser()
        return Guards.isDefined(data.user) && !Guards.isDefined(error)
    }
}