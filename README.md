<div align="center">
  <img src="logo/logo.png" alt="Xeno.JS Logo" width="140" />

  <h1>Xeno.JS Supabase</h1>
  <p><strong>A Typescript application framework architecture for Node.js, designed for lower technical debt, and faster infrastructure migrations.</strong></p>
  <p>Build long-lived applications with explicit dependency injection, DDD, CQRS, and transport-independent business logic.</p>

  <p>
    <a href="https://www.npmjs.com/package/@xeno-js/supabase"><img src="https://img.shields.io/npm/v/@xeno-js/supabase?style=flat-square" alt="NPM Version" /></a>
    <a href="https://github.com/xeno-js/supabase"><img src="https://img.shields.io/badge/Powered%20by-Xeno-blueviolet?style=flat-square" alt="Powered by Xeno" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License: MIT" /></a>
    <a href="https://buymeacoffee.com/xenojs">
      <img src="https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-FFdd00?style=flat-square&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee" />
    </a>
  </p>
</div>

---

`@xeno-js/supabase` provides integration with Supabase within the Xeno.JS ecosystem. It supports both SPA/CSR (Client-Side Rendering) and SSR (Server-Side Rendering) modes with advanced cookie management.

## Installation

```bash
npm install @xeno-js/supabase @supabase/supabase-js

```

For usage in SSR mode, the `@supabase/ssr` dependency is also required.

---

## 1. Supabase Plugin Configuration (CSR and SSR)

**Problem.** Modern applications require flexibility in handling authentication on both the client-side (SPA) and server-side (SSR), securely managing tokens, cookies, and OAuth flows.

**Principle.** The authentication client configuration must be explicit and automatically adapt to the execution environment (CSR or SSR).

**Mechanism.** The `withSupabase` function exposes an authentication plugin that checks configuration credentials and dynamically registers the appropriate module (`CsrModule` or `SsrModule`) in the dependency injection container.

**Implementation:**

CSR mode configuration (SPA):

```ts
import { XenoAppBuilder } from '@xeno-js/core';
import { withSupabase } from '@xeno-js/supabase';

const app = await new XenoAppBuilder()
  .addAuth(
    withSupabase((options, config) => {
      options.url = config.get('SUPABASE_URL')!;
      options.key = config.get('SUPABASE_KEY')!;
    })
  )
  .build();

```

SSR mode configuration (Server-Side Rendering):

```ts
const app = await new XenoAppBuilder()
  .addAuth(
    withSupabase((options, config) => {
      options.url = config.get('SUPABASE_URL')!;
      options.key = config.get('SUPABASE_KEY')!;
      options.ssr = {
        cookieEncoding: 'base64url',
      };
    })
  )
  .build();

```

**Behavior:** The plugin checks for the presence of the Supabase URL and key. If the `ssr` property is defined, it initializes the server-side support client via `SsrModule` and `SupabaseServerClientFactory`; otherwise, it falls back to `CsrModule` and `SupabaseClientFactory`.

**Boundary:** The plugin exclusively configures authentication services and the Supabase client lifecycle, delegating route management and network transport handling to the respective core modules.

---

## 2. Authentication Services and Claim Mapping

**Problem.** User data returned by external identity providers must be mapped into standardized domain objects (`AuthClaims` and `Session`) usable across the entire application.

**Principle.** The transformation of raw data into domain entities must be decoupled using dedicated mappers.

**Mechanism:** `BaseSupabaseAuthService` (extended by `SupabaseService` and `SupabaseSsrService`) implements the authentication contracts, interacting with the Supabase client and using `SupabaseClaimsMapper` and `SupabaseSessionMapper` to convert users and sessions.

**Implementation:**

Authentication services are automatically resolved by the container via framework tokens or used within authorization flows:

```ts
// Usage example via the injected service
const authService = container.resolve(TOKENS.AUTH_SERVICE);
const sessionResult = await authService.getSession();

```

**Behavior:** Methods such as `authenticate`, `signInWithProvider`, `getUser`, and `getSession` return `ResultType` objects encapsulating success or standardized authentication errors (`AppError.authFailed`).

**Boundary:** The services handle interaction with Supabase authentication APIs but do not manage application database persistence outside the authentication context.

---

## License

Released under the MIT [License](LICENSE).
