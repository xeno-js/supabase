import type { Maybe, ResultType, Session } from "@xeno-js/core";
import { AppError, Guards, Result } from "@xeno-js/core";

import { BaseSupabaseAuthService } from "./supabase-base.service";

export class SupabaseService extends BaseSupabaseAuthService {
    public async getSession(): Promise<ResultType<Maybe<Session>>> {
        const { data, error } = await this._supabase.auth.getSession()
        if (Guards.isDefined(error)) {
            return Result.fail(AppError.authFailed('SupabaseFrontendAuthService', error.message))
        }

        const session = data.session

        if (Guards.isDefined(session)) return Result.ok(this._sessionMapper.map(data.session!))

        return Result.ok()
    }

    public async isAuthenticated(): Promise<boolean>  {
        const session = await this._supabase.auth.getSession()
        return Guards.isDefined(session.data.session)
    }
}