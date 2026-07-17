
A full-featured SST v3 authentication module for serverless applications built on AWS Lambda, API Gateway V2, and DynamoDB. Supports OTP-first authentication (SMS/WhatsApp/Email), passkeys (WebAuthn/FIDO2), optional email + password authentication (login, set/change, forgot/reset), device token management, user migration, and an optional **public OAuth 2.1 Authorization Server** with Dynamic Client Registration for letting third-party apps act on your users' behalf.

## Table of Contents

- [Setup](#setup)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
  - [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [SST Secrets](#sst-secrets)
  - [DynamoDB Table Schema](#dynamodb-table-schema)
- [API Endpoints](#api-endpoints)
  - [POST /auth/otp/send](#post-authotpsend)
  - [POST /auth/otp/verify](#post-authotpverify)
  - [POST /auth/password/login](#post-authpasswordlogin)
  - [PUT /auth/password](#put-authpassword)
  - [POST /auth/password/forgot](#post-authpasswordforgot)
  - [POST /auth/password/reset](#post-authpasswordreset)
  - [GET /auth/me](#get-authme)
  - [PUT /auth/profile](#put-authprofile)
  - [POST /auth/logout](#post-authlogout)
  - [POST /auth/refresh](#post-authrefresh)
  - [DELETE /auth/account](#delete-authaccount)
  - [PUT /auth/device-tokens](#put-authdevice-tokens)
  - [POST /auth/passkey/register/options](#post-authpasskeyregisteroptions)
  - [POST /auth/passkey/register/verify](#post-authpasskeyregisterverify)
  - [POST /auth/passkey/login/options](#post-authpasskeyloginoptions)
  - [POST /auth/passkey/login/verify](#post-authpasskeyloginverify)
  - [POST /auth/passkey/check](#post-authpasskeycheck)
  - [GET /auth/passkey/credentials](#get-authpasskeycredentials)
  - [DELETE /auth/passkey/credentials/{credentialId}](#delete-authpasskeycredentialscredentialid)
  - [PATCH /auth/passkey/credentials/{credentialId}](#patch-authpasskeycredentialscredentialid)
- [OAuth 2.1 Authorization Server](#oauth-21-authorization-server)
  - [GET /.well-known/oauth-authorization-server](#get-well-knownoauth-authorization-server)
  - [GET /.well-known/jwks.json](#get-well-knownjwksjson)
  - [POST /oauth/register](#post-oauthregister)
  - [GET /oauth/authorize](#get-oauthauthorize)
  - [POST /oauth/authorize/decision](#post-oauthauthorizedecision)
  - [POST /oauth/token](#post-oauthtoken)
  - [POST /oauth/revoke](#post-oauthrevoke)
  - [GET /oauth/userinfo](#get-oauthuserinfo)
  - [GET /oauth/clients/{clientId}/preview](#get-oauthclientsclientidpreview)
  - [GET /oauth/me/authorizations](#get-oauthmeauthorizations)
  - [DELETE /oauth/me/authorizations/{clientId}](#delete-oauthmeauthorizationsclientid)
- [Services](#services)
- [Repositories](#repositories)
- [Middleware](#middleware)
- [Utilities](#utilities)
- [Types](#types)
- [Constants](#constants)
- [Error Codes](#error-codes)
- [Migration Function](#migration-function)
- [Frontend Integration](#frontend-integration)
- [Troubleshooting](#troubleshooting)

---

## Setup

### Installation

**Prerequisites**: Node.js 22+, Yarn 4.9.2+, SST v3, AWS Account

Before starting, ensure you have:

**1. AWS Credentials**
Personal use: Generate credentials following AWS Credentials Guide Internal/Team use: Request SSO access for your project and configure credentials

Note
When setting up for the first time, Amazon SES (Simple Email Service) operates in sandbox mode. In this mode, both the sender and recipient email addresses must be verified before emails can be sent.

You can verify email addresses in one of two ways:

Using the AWS CLI: Run the following command, then click the verification link sent to the specified email address:
aws ses verify-email-identity --email-address <EMAIL_TO_VERIFY> --profile <YOUR_AWS_PROFILE> --region <REGION>
Using the AWS Console:
Go to the AWS Management Console for the region where you deployed your service.

Navigate to Amazon SES → Identities → Create identity → Email address.

Enter the email you want to verify and follow the instructions sent to that inbox.

**2. GitHub Personal Access Token**
Navigate to: GitHub Account → Settings → Developer Settings → Personal Access Tokens → Tokens (classic) Generate new token with read:packages permissions.
Copy the token for next step

**3. Configure Yarn Registry**
Edit ~/.yarnrc.yml (global - recommended)
OR
create .yarnrc.yml in project root (Only do this if you have a specific reason too)
nodeLinker: node-modules

npmRegistries:
  "https://npm.pkg.github.com":
    npmAuthToken: <YOUR_GITHUB_TOKEN>

npmScopes:
  fluss:
    npmRegistryServer: "https://npm.pkg.github.com"
    npmPublishRegistry: "https://npm.pkg.github.com"
Note: If using project-level .yarnrc.yml, add it to your .gitignore. For auto-deploy, store token as a secret and generate the file in the workflow.

### Quick Start

```bash
yarn add @fluss/auth
```

1. Add the auth module to your `sst.config.ts`:

```typescript
import { createAuthModule } from '@fluss/auth'

export default $config({
  app(input) {
    return { name: 'my-app', home: 'aws' }
  },
  async run() {
    const auth = createAuthModule({
      jwt: {
        accessTokenExpiry: '1h',
        refreshTokenExpiry: '365d'
      },
      cors: {
        allowOrigins: ['https://app.example.com']
      },
      otp: {
        methods: ['sms'],
        sms: { primary: 'sns' }
      }
    })

    return { apiUrl: auth.api.url }
  }
})
```

2. Set the required secret and deploy:

```bash
npx sst secret set JwtPrivateKey < path/to/private.pem --stage=<stage>
npx sst deploy --stage=<stage>
```

This gives you OTP-based login/registration, profile updates, logout, refresh, and device tokens out of the box. See [Configuration](#configuration) for email OTP, passkeys, reCAPTCHA, and other options.

**Smoke-testing a deployment:**

```bash
yarn auth-test https://your-api.execute-api.us-east-1.amazonaws.com
```

This runs the full E2E curl test suite against a live deployment. The suite uses demo credentials (`+27811111111` / `676767`) that bypass OTP delivery — no real SMS is sent. See `e2e-curl-tests/auth-test.sh` for the full list of what is tested.

**Auth Flow**:

1. User sends OTP to their mobile or email via `POST /auth/otp/send`
2. User verifies OTP via `POST /auth/otp/verify` → automatically logged in (user created if new, session created, tokens returned)
3. Frontend detects new user (`isNewUser: true`) → prompts to complete profile via `PUT /auth/profile` (username, email/mobile)
4. Users can add passkeys as secondary auth after being logged in

**Returns**: `AuthModuleResult`

| Property | Type | Description |
|---|---|---|
| `api` | API Gateway V2 | HTTP API with all auth routes |
| `table` | DynamoDB Table | Single-table for all auth data |
| `migrationFunction` | Lambda | User migration handler |
| `authorizerFunction` | Lambda | API Gateway authorizer |

### Protecting Your Own Endpoints (API Gateway Authorizer)

The module exports an `authorizerFunction` — a Lambda Authorizer you can attach to any API Gateway route to require authentication. This validates the JWT access token before your handler is invoked, so unauthenticated requests never reach your code.

#### Usage

```typescript
import { createAuthModule } from '@fluss/auth'

export default $config({
  app(input) {
    return { name: 'my-app', home: 'aws' }
  },
  async run() {
    const auth = createAuthModule({
      jwt: { accessTokenExpiry: '1h', refreshTokenExpiry: '365d' },
      cors: { allowOrigins: ['https://app.example.com'] },
      otp: { methods: ['sms'], sms: { primary: 'sns' } }
    })

    // Create your own API and attach the authorizer
    const api = new sst.aws.ApiGatewayV2('MyApi', {
      cors: {
        allowOrigins: ['https://app.example.com'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization']
      }
    })

    // Add the auth module's authorizer to your API
    const authorizer = api.addAuthorizer({
      name: 'JwtAuthorizer',
      lambda: {
        function: auth.authorizerFunction.arn
      }
    })

    // Add a protected route — requests without a valid token get rejected automatically
    api.route('GET /orders', 'src/handlers/orders.handler.main', {
      auth: { lambda: authorizer.id }
    })

    // Add a public route — no authorizer attached
    api.route('GET /health', 'src/handlers/health.handler.main')

    return {
      authApiUrl: auth.api.url,
      myApiUrl: api.url
    }
  }
})
```

#### Accessing User Context in Your Handlers

When the authorizer approves a request, it injects the user's `userId` and `roles` into the request context. Access them in your handler like this:

```typescript
import type { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda'

interface AuthContext {
  userId: string
  roles: string   // JSON-stringified array, e.g. '["user","admin"]'
}

export async function main(event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthContext>) {
  const userId = event.requestContext.authorizer.lambda.userId
  const roles = JSON.parse(event.requestContext.authorizer.lambda.roles) as string[]

  return {
    statusCode: 200,
    body: JSON.stringify({ message: `Hello user ${userId}`, roles })
  }
}
```

#### How It Works

1. Client sends a request with `Authorization: Bearer <accessToken>` header
2. API Gateway invokes the authorizer Lambda **before** your handler
3. The authorizer verifies the JWT signature (ES256) and checks the token contains `userId` and `roles`
4. If valid → your handler runs with user context available. If invalid/expired → API Gateway returns 401/403 immediately

The authorizer supports both `REQUEST` and `TOKEN` authorizer types. It uses the same `JwtPrivateKey` secret as the auth module to derive the public key for verification.

### Configuration

#### `AuthModuleConfig`

```typescript
interface AuthModuleConfig {
  jwt: JwtConfig                // Required - token expiry settings
  cors: CorsConfig              // Required - allowed origins
  security?: SecurityConfig     // reCAPTCHA, rate limits, lockout (has defaults)
  cookie?: CookieConfig         // Refresh token cookie settings
  session?: SessionConfig       // Session limits and expiry
  otp?: OtpConfig               // OTP config (enables OTP routes when set)
  password?: PasswordConfig     // Password config (enables password routes when set)
  passkey?: PasskeyConfig       // Passkey config (enables passkey routes when set)
  deviceTokens?: boolean        // Enable device token push notifications (default: false)
  handlerBasePath?: string      // Override handler file path
  loggingQueueUrl?: string     // Optional SQS queue URL for auth event logging
}
```

#### `JwtConfig`

```typescript
interface JwtConfig {
  accessTokenExpiry: string     // Duration string, e.g. '1h', '30m'
  refreshTokenExpiry: string    // Duration string, e.g. '365d', '7d'
}
```

Algorithm is always ES256 (Elliptic Curve with P-256).

#### `OtpConfig`

```typescript
interface OtpConfig {
  methods: OtpChannel[]                    // ['sms'], ['sms', 'whatsapp'], ['sms', 'email'], etc.
  sms?: {
    primary: SmsProviderType               // 'sns', 'twilio', or 'bulksms'
    secondary?: SmsProviderType            // Fallback provider
  }
  smsAllowedCountryCodes?: string[]        // Country codes allowed for SMS, default: ['+27']
  messageTemplate?: string                 // Default: 'Your verification code is: {{code}}'
  otpExpirySeconds?: number                // Default: 300 (5 min)
  resendCooldownSeconds?: number           // Default: 60
  emailFromAddress?: string                // SES sender address for email OTP
}

type OtpChannel = 'sms' | 'whatsapp' | 'email'
type SmsProviderType = 'sns' | 'twilio' | 'bulksms'
```

To enable email OTP, add `'email'` to `methods` and set `emailFromAddress`:

```typescript
otp: {
  methods: ['sms', 'email'],
  sms: { primary: 'sns' },
  emailFromAddress: 'noreply@example.com'
}
```

To restrict SMS OTP to specific country codes, set `smsAllowedCountryCodes`. This only applies to SMS — WhatsApp is not restricted. If not set, defaults to `['+27']` (South Africa):

```typescript
otp: {
  methods: ['sms', 'whatsapp'],
  sms: { primary: 'sns' },
  smsAllowedCountryCodes: ['+27', '+1', '+44']
}
```

Numbers that don't match any allowed country code will receive an `SMS_COUNTRY_CODE_NOT_ALLOWED` error. This can also be configured via the `OTP_SMS_ALLOWED_COUNTRY_CODES` environment variable (comma-separated, e.g. `+27,+1,+44`).

#### `SecurityConfig`

```typescript
interface SecurityConfig {
  reCaptcha: {
    enabled: boolean
    version: 'v2' | 'v3'
    scoreThreshold?: number     // v3 only, default: 0.5
  }
  rateLimit: {
    login:   { windowMs: number, maxRequests: number }
    refresh: { windowMs: number, maxRequests: number }
    reset:   { windowMs: number, maxRequests: number }
  }
  lockout: {
    failedAttemptsThreshold: number   // Lock after N failed attempts
    temporaryLockoutDuration: number  // Lock duration in seconds
  }
}
```

#### `CorsConfig`

```typescript
interface CorsConfig {
  allowOrigins: string[]        // Required - explicit origins (no wildcards with credentials)
  allowMethods?: string[]       // Default: ['GET','POST','PUT','DELETE','OPTIONS']
  allowHeaders?: string[]       // Default: ['Content-Type','Authorization','X-Requested-With']
  maxAge?: string               // Default: '1 day'
}
```

#### `CookieConfig`

```typescript
interface CookieConfig {
  name: string                  // Default: 'refreshToken'
  httpOnly: boolean             // Default: true
  secure: boolean               // Default: true (HTTPS only)
  sameSite: 'Strict' | 'Lax' | 'None'  // Default: 'Lax'
  path: string                  // Default: '/'
  domain?: string               // Optional cookie domain
}
```

#### `SessionConfig`

```typescript
interface SessionConfig {
  limits: {
    web: number                 // Max concurrent web sessions (default: 1)
    mobile: number              // Max concurrent mobile sessions (default: 1)
  }
  expirySeconds?: number        // Session TTL (defaults to refresh token expiry)
}
```

#### `PasskeyConfig`

```typescript
interface PasskeyConfig {
  rpId: string | string[]                  // Relying Party ID(s) (your domain(s))
  rpName: string                           // Relying Party display name
  expectedOrigin: string | string[]        // Allowed origin(s) for verification
}
```

#### `PasswordConfig`

Setting `password` (even as `{}`) enables the email + password routes: `POST /auth/password/login`, `PUT /auth/password`, `POST /auth/password/forgot`, and `POST /auth/password/reset`. Failed logins reuse the same lockout policy as OTP login (`SecurityConfig.lockout`).

```typescript
interface PasswordConfig {
  minLength?: number                       // Minimum password length, default: 8
  resetTokenExpirySeconds?: number         // Reset token lifetime, default: 3600 (1 hour)
  emailFromAddress?: string                // SES sender for reset emails (grants SES send permission to the forgot route)
  resetBaseUrl?: string                    // If set, reset emails contain `${resetBaseUrl}?token=&email=`; otherwise the raw token is sent
}
```

Reset tokens are stored hashed (bcrypt) with a DynamoDB TTL. If `emailFromAddress` is not set, no email is sent — the forgot flow still succeeds and the token can be delivered by your own means. Existing OTP/passkey flows are unaffected; a migrated user with a `passwordHash` can log in via `POST /auth/password/login` immediately.

#### `OAuthServerConfig`

When `oauthServer` is set, the module exposes a full OAuth 2.1 Authorization Server (with Dynamic Client Registration per RFC 7591) alongside the existing auth handlers. This lets third-party clients — Claude.ai / Claude Desktop, ChatGPT custom connectors, etc. — authenticate users via a standard OAuth consent flow instead of pasting an API key.

```typescript
interface OAuthServerConfig {
  issuer: string                              // e.g. 'https://auth.fluss.io' — appears in discovery + JWT `iss`
  consentBaseUrl: string                      // e.g. 'https://dashboard.fluss.io' — where /authorize redirects users
  accessTokenTtlSeconds?: number              // Default: 900 (15 min)
  refreshTokenTtlSeconds?: number             // Default: 2 592 000 (30 days)
  dcrRequiresApiKey?: boolean                 // If true, /register requires a logged-in dashboard session. Default: false
  dcrRateLimit?: { registrationsPerIpPerDay: number }   // Default: 5
  defaultScopes?: string[]                    // Scopes granted when a registering client doesn't request any
}
```

**Scope vocabulary** (defined in `oauth.constants.ts`, app-specific — adjust the values to your product):

| Scope | Display | Description |
|---|---|---|
| `devices:read` | View your Fluss devices | Read device list, status, permissions |
| `devices:control` | Open and trigger your devices | Send open/trigger commands |
| `access:read` | View access logs | Read entry logs |
| `access:write` | Invite people to your devices | Grant access to other users |
| `profile:read` | See your name and email | Returned by `/oauth/userinfo` |

**Key design points:**

- The OAuth AS is **purely additive** to the existing auth module. Email/OTP/passkey/refresh-cookie login flows are unchanged. The OAuth handlers reuse the same `AuthAndUser` table and the same dashboard session cookie.
- Tokens are signed with a **separate** EC P-256 key (`OAuthJwtPrivateKey`) so the OAuth issuer is cryptographically independent from the existing first-party access token (`JwtPrivateKey`).
- DCR is open by default with rate limiting; clients that exceed the daily IP cap are auto-flagged `under_review` and cannot issue tokens until promoted to `active`.
- Authorization codes are single-use (DynamoDB conditional delete) and TTL-expired at 60s.
- Refresh tokens rotate on every use; reuse of an already-rotated token revokes the entire token family (RFC 6819 §5.2.2.3).
- PKCE S256 is mandatory; `plain` is rejected.
- `redirect_uri` matching is exact (no normalization, no path/query manipulation).

#### `loggingQueueUrl`

Optional SQS queue URL. When set, all auth events are logged to the queue as JSON messages.

```typescript
const auth = createAuthModule({
  jwt: { accessTokenExpiry: '1h', refreshTokenExpiry: '365d' },
  cors: { allowOrigins: ['https://app.example.com'] },
  otp: { methods: ['sms'], sms: { primary: 'sns' } },
  loggingQueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/auth-events'
})
```

Events logged: `auth.otp.send`, `auth.otp.verify`, `auth.password.login`, `auth.password.change`, `auth.password.forgot`, `auth.password.reset`, `auth.profile.update`, `auth.logout`, `auth.refresh`, `auth.delete`, `auth.device-tokens`, `auth.passkey.register.options`, `auth.passkey.register.verify`, `auth.passkey.login.options`, `auth.passkey.login.verify`.

### Environment Variables

All handler config is injected via environment variables at deploy time by the infrastructure module. You do not need to set these manually.

| Variable | Description | Default |
|---|---|---|
| `ACCESS_TOKEN_EXPIRY_SECONDS` | Access token TTL | `3600` |
| `REFRESH_TOKEN_EXPIRY_SECONDS` | Refresh token TTL | `31536000` |
| `COOKIE_NAME` | Refresh token cookie name | `refreshToken` |
| `COOKIE_HTTP_ONLY` | HTTP-only flag | `true` |
| `COOKIE_SECURE` | Secure flag (HTTPS only) | `true` |
| `COOKIE_SAME_SITE` | SameSite attribute | `Lax` |
| `COOKIE_PATH` | Cookie path | `/` |
| `COOKIE_DOMAIN` | Cookie domain | - |
| `CORS_ALLOWED_ORIGINS` | Comma-separated origins | - |
| `RECAPTCHA_ENABLED` | Enable reCAPTCHA | `false` |
| `RECAPTCHA_VERSION` | `v2` or `v3` | `v3` |
| `RECAPTCHA_SCORE_THRESHOLD` | v3 score threshold | `0.5` |
| `LOCKOUT_FAILED_ATTEMPTS_THRESHOLD` | Failed attempts before lockout | `5` |
| `LOCKOUT_DURATION_SECONDS` | Lockout duration | `900` |
| `SESSION_LIMIT_WEB` | Max web sessions | `1` |
| `SESSION_LIMIT_MOBILE` | Max mobile sessions | `1` |
| `SESSION_EXPIRY_SECONDS` | Session TTL | Same as refresh token |
| `OTP_METHODS` | Comma-separated OTP channels | `sms` |
| `OTP_SMS_PRIMARY` | Primary SMS provider | `sns` |
| `OTP_SMS_SECONDARY` | Fallback SMS provider | - |
| `OTP_SMS_ALLOWED_COUNTRY_CODES` | Comma-separated country codes allowed for SMS (not WhatsApp) | `+27` |
| `OTP_MESSAGE_TEMPLATE` | OTP message template | `Your verification code is: {{code}}` |
| `OTP_EXPIRY_SECONDS` | OTP validity period | `300` |
| `OTP_RESEND_COOLDOWN_SECONDS` | Min time between sends | `60` |
| `OTP_EMAIL_FROM_ADDRESS` | SES sender email for email OTP | - |
| `PASSWORD_MIN_LENGTH` | Minimum password length | `8` |
| `PASSWORD_RESET_TOKEN_EXPIRY_SECONDS` | Password reset token lifetime | `3600` |
| `PASSWORD_RESET_EMAIL_FROM_ADDRESS` | SES sender email for reset emails | - |
| `PASSWORD_RESET_BASE_URL` | Base URL for reset links in emails | - |
| `PASSKEY_RP_ID` | WebAuthn Relying Party ID(s), comma-separated for multiple | - |
| `PASSKEY_RP_NAME` | WebAuthn Relying Party name | - |
| `PASSKEY_EXPECTED_ORIGIN` | Comma-separated allowed origins | - |
| `AUTH_LOGGING_QUEUE_URL` | SQS queue URL for auth event logging | - |
| `OAUTH_ISSUER` | OAuth issuer URL (matches `oauthServer.issuer`) | - |
| `OAUTH_CONSENT_BASE_URL` | Dashboard origin for the consent screen | - |
| `OAUTH_ACCESS_TOKEN_TTL_SECONDS` | OAuth access token lifetime | `900` |
| `OAUTH_DCR_REQUIRES_API_KEY` | Require a logged-in session for DCR | `false` |
| `OAUTH_DCR_DAILY_LIMIT_PER_IP` | DCR registrations per IP per day | `5` |
| `OAUTH_DEFAULT_SCOPES` | Space-separated default scopes for DCR | `devices:read devices:control profile:read` |

### SST Secrets

Sensitive credentials are managed as [SST Secrets](https://sst.dev/docs/component/secret) rather than plaintext environment variables. Set them with `sst secret set <name> <value>` before deploying.

#### Always required

| Secret | Description | Used by |
|---|---|---|
| `JwtPrivateKey` | PEM-encoded EC P-256 private key for signing first-party access tokens | All routes |

#### Required when `oauthServer` is configured

| Secret | Description | Used by |
|---|---|---|
| `OAuthJwtPrivateKey` | PEM-encoded EC P-256 private key for signing OAuth access tokens. Distinct from `JwtPrivateKey` so the OAuth issuer is cryptographically independent. | OAuth routes |

```bash
# Generate and set the OAuth signing key
openssl ecparam -name prime256v1 -genkey -noout | npx sst secret set OAuthJwtPrivateKey --stage=live
```

#### Required when using OTP with SMS via SNS

No secrets required. SNS uses IAM permissions from the Lambda execution role.

#### Required when using OTP with SMS or WhatsApp via Twilio

| Secret | Description | Used by |
|---|---|---|
| `TwilioAccountSid` | Twilio account SID | OTP routes |
| `TwilioAuthToken` | Twilio auth token | OTP routes |
| `TwilioMessagingServiceSid` | Twilio Messaging Service SID | OTP routes (SMS and WhatsApp) |

#### Additionally required when using WhatsApp

| Secret | Description | Used by |
|---|---|---|
| `TwilioWhatsAppFromNumber` | Twilio WhatsApp sender number (e.g. `+14155238886`) | OTP routes |
| `TwilioWhatsAppContentSid` | Twilio content template SID for OTP messages | OTP routes |

The content template must accept a single variable `{{1}}` for the OTP code.

#### Required when using OTP with SMS via BulkSMS

[BulkSMS](https://www.bulksms.com/) is a South African SMS gateway. Create an account at https://www.bulksms.com/ and generate an API token pair (token ID + secret) under **Settings → Advanced → API Tokens**.

| Secret | Description | Used by |
|---|---|---|
| `BulkSmsAuth` | Full HTTP `Authorization` header value for the BulkSMS REST API (e.g. `Basic <base64(tokenId:tokenSecret)>`) | OTP routes |

To enable, set `primary` (or `secondary`) to `'bulksms'`:

```typescript
otp: { methods: ['sms'], sms: { primary: 'bulksms' } }
```

#### Required when reCAPTCHA is enabled

| Secret | Description | Used by |
|---|---|---|
| `RecaptchaSecretKey` | Google reCAPTCHA secret key | OTP routes |

#### Example

```bash
# Always required
npx sst secret set JwtPrivateKey < path/to/private.pem --stage=<stage>
or
openssl ecparam -name prime256v1 -genkey -noout | npx sst secret set JwtPrivateKey --stage=live

# If using Twilio for OTP SMS or WhatsApp
npx sst secret set TwilioAccountSid "AC..."
npx sst secret set TwilioAuthToken "your-auth-token"
npx sst secret set TwilioMessagingServiceSid "MG..."

# Additionally for WhatsApp
npx sst secret set TwilioWhatsAppFromNumber "+14155238886"
npx sst secret set TwilioWhatsAppContentSid "HX..."

# If using BulkSMS for OTP SMS
npx sst secret set BulkSmsAuth "Basic <base64(tokenId:tokenSecret)>"

# If using reCAPTCHA
npx sst secret set RecaptchaSecretKey "6Lc..."
```

### DynamoDB Table Schema

**Table**: `AuthAndUser`

**Indexes**:

| Index | Hash Key | Range Key | Purpose |
|---|---|---|---|
| Primary | `pk` | `sk` | All entities |
| GSI1 | `gsi1pk` | `gsi1sk` | Mobile number lookups |
| GSI2 | `gsi2pk` | `gsi2sk` | Passkey credential lookups |
| GSI3 | `gsi3pk` | `gsi3sk` | Refresh token lookups |
| GSI4 | `gsi4pk` | `gsi4sk` | Email lookups |
| GSI5 | `gsi5pk` | `gsi5sk` | OAuth refresh-token family lookups (used for reuse-detection family revoke) |
| GSI6 | `gsi6pk` | `gsi6sk` | OAuth refresh tokens by user (used for "list/revoke my authorizations") |

**TTL field**: `ttl` (Unix timestamp in seconds) - auto-expires sessions, OTPs, password reset tokens, challenges, OAuth codes, OAuth refresh tokens, and DCR rate-limit counters.

**Entity key patterns**:

| Entity | `pk` | `sk` | GSI |
|---|---|---|---|
| User | `USER#{userId}` | `PROFILE` | GSI1: `MOBILE#{mobile}` / `USER#{userId}`, GSI4: `EMAIL#{email}` / `USER#{userId}` |
| Session | `USER#{userId}` | `SESSION#{sessionId}` | GSI3: `REFRESH_TOKEN#{token}` / `SESSION#{sessionId}` |
| OTP | `OTP#{identifier}` | `OTP#{otpId}` | - |
| Password Reset Token | `RESET#{email}` | `RESET#{tokenId}` | - (TTL, single-use) |
| Passkey Credential | `USER#{userId}` | `PASSKEY#{credentialId}` | GSI2: `CREDENTIAL#{credentialId}` / `USER#{userId}` |
| Passkey Challenge | `CHALLENGE#{challengeId}` | `CHALLENGE` | - |
| OAuth Client | `OAUTH_CLIENT#{clientId}` | `METADATA` | - |
| OAuth Authorization Code | `OAUTH_CODE#{code}` | `CODE` | - (single-use, TTL=60s) |
| OAuth Refresh Token | `OAUTH_REFRESH#{tokenHash}` | `TOKEN` | GSI5: `OAUTH_FAMILY#{familyId}` / `TOKEN#{tokenHash}`, GSI6: `USER#{userId}#OAUTH` / `TOKEN#{tokenHash}` |
| OAuth Consent | `USER#{userId}` | `OAUTH_CONSENT#{clientId}` | - |
| OAuth DCR Rate Limit | `OAUTH_DCR_RATE#{ip}` | `DAY#{YYYY-MM-DD}` | - (TTL=36h) |

---

## API Endpoints

All responses follow a standard envelope:

```json
{
  "success": true,
  "data": { }
}
```

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": { }
  }
}
```

---

### `POST /auth/otp/send`

Send a one-time password via SMS, WhatsApp, or Email.

**Availability**: Only when `otp` is configured.
**Auth**: None
**Middleware**: CORS, ErrorHandler, JSONParser

#### Request

| Field | Type | Required | Description |
|---|---|---|---|
| `identifier` | `string` | Yes | Mobile number (e.g. `+1234567890`) or email address |
| `channel` | `'sms' \| 'whatsapp' \| 'email'` | No | Delivery channel (auto-detected from identifier if not provided) |
| `recaptchaToken` | `string` | If reCAPTCHA enabled | reCAPTCHA verification token |

```json
{
  "identifier": "+1234567890",
  "channel": "sms"
}
```

Or with email:

```json
{
  "identifier": "user@example.com"
}
```

#### Response `200`

```json
{
  "success": true,
  "data": {
    "success": true,
    "channel": "sms",
    "expiresIn": 300
  }
}
```

#### Errors

| Code | Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid identifier format |
| `CAPTCHA_FAILED` | 400 | reCAPTCHA verification failed |
| `OTP_CHANNEL_NOT_ENABLED` | 400 | Requested channel is not configured |
| `OTP_SEND_FAILED` | 500 | SMS/WhatsApp/Email delivery failed |

---

### `POST /auth/otp/verify`

Verify a one-time password. On success, automatically creates the user (if new) and returns a full login response with tokens.

**Availability**: Only when `otp` is configured.
**Auth**: None
**Middleware**: CORS, ErrorHandler, JSONParser

#### Request

| Field | Type | Required | Description |
|---|---|---|---|
| `identifier` | `string` | Yes | Mobile number or email the OTP was sent to |
| `code` | `string` | Yes | 6-digit OTP code |
| `deviceInfo` | `object` | No | Device metadata for session platform detection |
| `voipToken` | `string` | No | VoIP push token — stored on user record during login |
| `notificationToken` | `string` | No | Push notification token — stored on user record during login |

```json
{
  "identifier": "+1234567890",
  "code": "123456",
  "voipToken": "device-voip-token",
  "notificationToken": "device-notification-token"
}
```

#### Response `200`

**Headers**: `Set-Cookie: refreshToken=...; Path=/; HttpOnly; Secure; SameSite=Lax`

```json
{
  "success": true,
  "data": {
    "success": true,
    "verified": true,
    "isNewUser": true,
    "user": {
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "shortUserId": "550e8400e29b41d4a7",
      "mobile": "+1234567890",
      "countryCode": "US",
      "roles": ["user"],
      "status": "active",
      "createdAt": 1700000000000,
      "updatedAt": 1700000000000
    },
    "accessToken": "eyJhbGciOiJFUzI1NiJ9...",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  }
}
```

When `isNewUser` is `true`, the frontend should prompt the user to complete their profile via `PUT /auth/profile`.

#### Errors

| Code | Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid identifier format |
| `OTP_EXPIRED` | 400 | No active OTP found |
| `OTP_INVALID` | 400 | Incorrect code |
| `OTP_MAX_ATTEMPTS` | 429 | Max verification attempts exceeded (5) |
| `ACCOUNT_LOCKED` | 423 | Account is temporarily locked |

---

### `POST /auth/password/login`

Log in with email and password. Verifies the supplied password against the user's stored hash and, on success, creates a session and returns tokens. Wrong passwords increment the account's failed-login counter and trigger the same temporary lockout as OTP login.

**Availability**: Only when `password` is configured.
**Auth**: None
**Middleware**: CORS, ErrorHandler, JSONParser

#### Request

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | `string` | Yes | Email address of the account |
| `password` | `string` | Yes | The user's password |
| `deviceInfo` | `object` | No | Device metadata for session platform detection |
| `voipToken` | `string` | No | VoIP push token — stored on user record during login |
| `notificationToken` | `string` | No | Push notification token — stored on user record during login |

```json
{
  "email": "user@example.com",
  "password": "correct horse battery staple"
}
```

#### Response `200`

**Headers**: `Set-Cookie: refreshToken=...; Path=/; HttpOnly; Secure; SameSite=Lax`

```json
{
  "success": true,
  "data": {
    "success": true,
    "user": {
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "roles": ["user"],
      "status": "active",
      "createdAt": 1700000000000,
      "updatedAt": 1700000000000
    },
    "accessToken": "eyJhbGciOiJFUzI1NiJ9...",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  }
}
```

#### Errors

| Code | Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Missing email or password |
| `INVALID_CREDENTIALS` | 401 | Unknown email, no password set, or wrong password |
| `ACCOUNT_LOCKED` | 423 | Account is locked or temporarily locked |

---

### `PUT /auth/password`

Set or change the authenticated user's password. If the user already has a password, `currentPassword` is required and must match. If the user has no password yet (e.g. an OTP-created account adding one), `currentPassword` may be omitted.

**Availability**: Only when `password` is configured.
**Auth**: Bearer access token
**Middleware**: CORS, ErrorHandler, JSONParser, Auth

#### Request

| Field | Type | Required | Description |
|---|---|---|---|
| `newPassword` | `string` | Yes | New password (must meet the configured minimum length) |
| `currentPassword` | `string` | Conditional | Required when the account already has a password |

```json
{
  "currentPassword": "old password",
  "newPassword": "a brand new password"
}
```

#### Response `200`

```json
{
  "success": true,
  "data": { "success": true }
}
```

#### Errors

| Code | Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | `newPassword` missing |
| `PASSWORD_TOO_WEAK` | 400 | New password does not meet the minimum length |
| `INVALID_CREDENTIALS` | 401 | Missing or incorrect current password |
| `USER_NOT_FOUND` | 404 | Authenticated user no longer exists |

---

### `POST /auth/password/forgot`

Request a password reset. If the email belongs to a known account, a single-use reset token is generated, stored hashed with a TTL, and emailed (when an email sender is configured). The response is always `200` regardless of whether the email exists, to avoid revealing account existence.

**Availability**: Only when `password` is configured.
**Auth**: None
**Middleware**: CORS, ErrorHandler, JSONParser

#### Request

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | `string` | Yes | Email address to send a reset token to |

```json
{ "email": "user@example.com" }
```

#### Response `200`

```json
{
  "success": true,
  "data": { "success": true }
}
```

#### Errors

| Code | Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | `email` missing |

---

### `POST /auth/password/reset`

Complete a password reset using the token from `POST /auth/password/forgot`. On success the password is updated and the reset token is invalidated.

**Availability**: Only when `password` is configured.
**Auth**: None
**Middleware**: CORS, ErrorHandler, JSONParser

#### Request

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | `string` | Yes | Email address of the account |
| `token` | `string` | Yes | Reset token delivered by the forgot flow |
| `newPassword` | `string` | Yes | New password (must meet the configured minimum length) |

```json
{
  "email": "user@example.com",
  "token": "3f9a...c21",
  "newPassword": "a brand new password"
}
```

#### Response `200`

```json
{
  "success": true,
  "data": { "success": true }
}
```

#### Errors

| Code | Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | `email`, `token`, or `newPassword` missing |
| `PASSWORD_TOO_WEAK` | 400 | New password does not meet the minimum length |
| `RESET_TOKEN_INVALID` | 400 | Token not found or does not match |
| `RESET_TOKEN_EXPIRED` | 400 | Token has expired |

---

### `GET /auth/me`

Get the authenticated user's full profile.

**Auth**: Required (Bearer token)
**Middleware**: CORS, ErrorHandler, Auth

#### Request

No body required. Send the access token in the `Authorization` header.

```
GET /auth/me
Authorization: Bearer <accessToken>
```

#### Response `200`

```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "shortUserId": "550e8400e29b41d4a7",
      "email": "user@example.com",
      "username": "johndoe",
      "mobile": "+1234567890",
      "countryCode": "US",
      "roles": ["user"],
      "status": "active",
      "apiKey": "ak_550e8400e29b...",
      "version": "v3.0.8",
      "createdAt": 1700000000000,
      "updatedAt": 1700000000000
    }
  }
}
```

#### Errors

| Code | Status | Description |
|---|---|---|
| `INVALID_TOKEN` | 401 | Missing or invalid access token |
| `TOKEN_EXPIRED` | 401 | Access token has expired |
| `USER_NOT_FOUND` | 404 | User not found |

---

### `PUT /auth/profile`

Update the authenticated user's profile (email, username, mobile).

**Auth**: Required (Bearer token)
**Middleware**: CORS, ErrorHandler, JSONParser, Auth

#### Request

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | `string` | No | Valid email address |
| `username` | `string` | No | 3-32 chars, alphanumeric + `_` `-` |
| `mobile` | `string` | No | International format, e.g. `+1234567890` |
| `version` | `string` | No | App version string, e.g. `"v3.0.8"` — stored on user record |
| `deviceInfo` | `object` | No | Device metadata object — stored on user record |

At least one field must be provided.

```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "version": "v3.0.8",
  "deviceInfo": { "platform": "ios", "model": "iPhone 15", "osVersion": "17.0" }
}
```

#### Response `200`

```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "shortUserId": "550e8400e29b41d4a7",
      "email": "user@example.com",
      "username": "johndoe",
      "mobile": "+1234567890",
      "countryCode": "US",
      "roles": ["user"],
      "status": "active",
      "apiKey": "ak_550e8400e29b...",
      "version": "v3.0.8",
      "createdAt": 1700000000000,
      "updatedAt": 1700000000001
    }
  }
}
```

#### Errors

| Code | Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid input format |
| `INVALID_TOKEN` | 401 | Missing or invalid access token |
| `TOKEN_EXPIRED` | 401 | Access token has expired |
| `EMAIL_ALREADY_EXISTS` | 409 | Email is already in use |
| `MOBILE_ALREADY_EXISTS` | 409 | Mobile number is already in use |
| `USER_NOT_FOUND` | 404 | User not found |

---

### `POST /auth/logout`

Invalidate the current session or all sessions.

**Auth**: Required (Bearer token)
**Middleware**: CORS, ErrorHandler, JSONParser, Auth

#### Request

| Field | Type | Required | Description |
|---|---|---|---|
| `allDevices` | `boolean` | No | If `true`, invalidate all sessions for this user |

#### Response `200`

**Headers**: `Set-Cookie: refreshToken=; Max-Age=0` (clears cookie)

```json
{
  "success": true,
  "data": { "success": true }
}
```

---

### `POST /auth/refresh`

Refresh the access token using the refresh token cookie.

**Auth**: None (uses refresh token from `Cookie` header)
**Middleware**: CORS, ErrorHandler, JSONParser

#### Request

**Body**: None. The refresh token is extracted from the `Cookie` header automatically.

Frontend must send `credentials: 'include'` to include cookies.

#### Response `200`

**Headers**: `Set-Cookie: refreshToken=<new-token>; ...` (rotated)

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJFUzI1NiJ9...",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  }
}
```

---

### `DELETE /auth/account`

Permanently delete the authenticated user's account.

**Auth**: Required (Bearer token)
**Middleware**: CORS, ErrorHandler, JSONParser, Auth

#### Request

No body required. Authentication is verified via the Bearer token.

#### Response `200`

**Headers**: `Set-Cookie: refreshToken=; Max-Age=0`

```json
{
  "success": true,
  "data": { "message": "Account successfully deleted" }
}
```

#### Errors

| Code | Status | Description |
|---|---|---|
| `INVALID_TOKEN` | 401 | Missing or invalid access token |
| `USER_NOT_FOUND` | 404 | User not found |

---

### `PUT /auth/device-tokens`

Register or update push notification device tokens.

**Auth**: Required (Bearer token)
**Middleware**: CORS, ErrorHandler, JSONParser, Auth

#### Request

| Field | Type | Required | Description |
|---|---|---|---|
| `voipToken` | `string` | At least one required | VoIP push token |
| `notificationToken` | `string` | At least one required | Standard push notification token |

#### Response `200`

```json
{
  "success": true,
  "data": { "success": true }
}
```

---

### `POST /auth/passkey/register/options`

Generate WebAuthn registration options for adding a passkey to the authenticated user's account. The returned `options` object is passed directly to the browser's `navigator.credentials.create({ publicKey: options })` API.

**Availability**: Only when `passkey` is configured.
**Auth**: Required (Bearer token)
**Middleware**: CORS, ErrorHandler, JSONParser, Auth

#### Request

No body required. Authentication is verified via the Bearer token.

#### Response `200`

```json
{
  "success": true,
  "data": {
    "options": {
      "challenge": "base64url-encoded-challenge",
      "rp": { "name": "My App", "id": "example.com" },
      "user": { "id": "base64url-user-id", "name": "user@example.com", "displayName": "user@example.com" },
      "pubKeyCredParams": [{ "type": "public-key", "alg": -7 }],
      "authenticatorSelection": { "residentKey": "preferred", "userVerification": "preferred" }
    },
    "challengeId": "challenge-uuid"
  }
}
```

#### Errors

| Code | Status | Description |
|---|---|---|
| `INVALID_TOKEN` | 401 | Missing or invalid access token |
| `USER_NOT_FOUND` | 404 | User not found |

---

### `POST /auth/passkey/register/verify`

Verify and store a WebAuthn registration response. On success, the passkey credential is saved and can be used for future logins.

**Availability**: Only when `passkey` is configured.
**Auth**: Required (Bearer token)
**Middleware**: CORS, ErrorHandler, JSONParser, Auth

#### Request

| Field | Type | Required | Description |
|---|---|---|---|
| `challengeId` | `string` | Yes | The `challengeId` returned from `/register/options` |
| `response` | `object` | Yes | The credential response from `navigator.credentials.create()` |
| `name` | `string` | No | Optional friendly name for the passkey (e.g. "MacBook Touch ID") |

```json
{
  "challengeId": "challenge-uuid",
  "response": { "id": "...", "rawId": "...", "response": { "attestationObject": "...", "clientDataJSON": "..." }, "type": "public-key" },
  "name": "MacBook Touch ID"
}
```

#### Response `200`

```json
{
  "success": true,
  "data": {
    "verified": true,
    "credentialId": "credential-id"
  }
}
```

#### Errors

| Code | Status | Description |
|---|---|---|
| `INVALID_TOKEN` | 401 | Missing or invalid access token |
| `VALIDATION_ERROR` | 400 | Missing `challengeId` or `response` |
| `PASSKEY_CHALLENGE_EXPIRED` | 400 | Challenge has expired (re-request options) |
| `PASSKEY_VERIFICATION_FAILED` | 400 | Credential verification failed |
| `PASSKEY_ALREADY_REGISTERED` | 409 | This credential is already registered |

---

### `POST /auth/passkey/login/options`

Generate WebAuthn authentication options for passkey login. Supports both discoverable credentials (no identifier, authenticator selects the key) and scoped credentials (pass `identifier` to restrict to a specific user's registered keys).

**Availability**: Only when `passkey` is configured.
**Auth**: None
**Middleware**: CORS, ErrorHandler, JSONParser

#### Request

| Field | Type | Required | Description |
|---|---|---|---|
| `identifier` | `string` | No | Mobile or email — scopes `allowCredentials` to this user's keys. Omit for discoverable credentials. |

```json
{}
```

Or to scope to a specific user:

```json
{ "identifier": "+1234567890" }
```

#### Response `200`

```json
{
  "success": true,
  "data": {
    "options": {
      "challenge": "base64url-encoded-challenge",
      "rpId": "example.com",
      "allowCredentials": [],
      "userVerification": "preferred"
    },
    "challengeId": "challenge-uuid"
  }
}
```

---

### `POST /auth/passkey/login/verify`

Verify a WebAuthn authentication response and create a full session. Works the same as OTP verify — returns a login response with tokens and sets the refresh token cookie. Accepts optional `deviceInfo` for session platform detection (the same as OTP verify).

**Availability**: Only when `passkey` is configured.
**Auth**: None
**Middleware**: CORS, ErrorHandler, JSONParser

#### Request

| Field | Type | Required | Description |
|---|---|---|---|
| `challengeId` | `string` | Yes | The `challengeId` returned from `/login/options` |
| `response` | `object` | Yes | The credential response from `navigator.credentials.get()` |
| `deviceInfo` | `object` | No | Device metadata for session platform detection |
| `voipToken` | `string` | No | VoIP push token — stored on user record during login |
| `notificationToken` | `string` | No | Push notification token — stored on user record during login |

```json
{
  "challengeId": "challenge-uuid",
  "response": { "id": "...", "rawId": "...", "response": { "authenticatorData": "...", "clientDataJSON": "...", "signature": "..." }, "type": "public-key" },
  "deviceInfo": { "platform": "ios", "model": "iPhone 15", "osVersion": "17.0" }
}
```

#### Response `200`

**Headers**: `Set-Cookie: refreshToken=...; Path=/; HttpOnly; Secure; SameSite=Lax`

```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "shortUserId": "550e8400e29b41d4a7",
      "email": "user@example.com",
      "username": "testuser",
      "mobile": "+1234567890",
      "roles": ["user"],
      "status": "active",
      "createdAt": 1700000000000,
      "updatedAt": 1700000000000
    },
    "accessToken": "eyJhbGciOiJFUzI1NiJ9...",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  }
}
```

#### Errors

| Code | Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Missing `challengeId` or `response` |
| `PASSKEY_CHALLENGE_EXPIRED` | 400 | Challenge has expired (re-request options) |
| `PASSKEY_VERIFICATION_FAILED` | 400 | Credential verification failed |
| `PASSKEY_NOT_FOUND` | 404 | No matching passkey credential found |
| `USER_NOT_FOUND` | 404 | User associated with passkey not found |
| `ACCOUNT_LOCKED` | 423 | Account is temporarily locked |

---

### `POST /auth/passkey/check`

Check whether a given identifier (mobile number or email) has any registered passkeys. Useful for deciding whether to offer passkey login as an option on the login screen.

**Availability**: Only when `passkey` is configured.
**Auth**: None
**Middleware**: CORS, ErrorHandler, JSONParser

#### Request

| Field | Type | Required | Description |
|---|---|---|---|
| `identifier` | `string` | Yes | Mobile number or email to check |

```json
{ "identifier": "+1234567890" }
```

#### Response `200`

```json
{
  "success": true,
  "data": { "hasPasskey": true }
}
```

#### Errors

| Code | Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | `identifier` is missing |

---

### `GET /auth/passkey/credentials`

List all passkey credentials registered to the authenticated user.

**Availability**: Only when `passkey` is configured.
**Auth**: Required (Bearer token)
**Middleware**: CORS, ErrorHandler, Auth

#### Request

No body required. Authentication is verified via the Bearer token.

#### Response `200`

```json
{
  "success": true,
  "data": {
    "credentials": [
      {
        "credentialId": "credential-id",
        "deviceType": "singleDevice",
        "backedUp": false,
        "transports": ["internal"],
        "name": "MacBook Touch ID",
        "createdAt": 1700000000000
      }
    ]
  }
}
```

#### Errors

| Code | Status | Description |
|---|---|---|
| `INVALID_TOKEN` | 401 | Missing or invalid access token |

---

### `DELETE /auth/passkey/credentials/{credentialId}`

Delete a specific passkey credential from the authenticated user's account.

**Availability**: Only when `passkey` is configured.
**Auth**: Required (Bearer token)
**Middleware**: CORS, ErrorHandler, Auth

#### Request

No body required. `credentialId` is a path parameter.

```
DELETE /auth/passkey/credentials/credential-id-here
Authorization: Bearer <accessToken>
```

#### Response `200`

```json
{
  "success": true,
  "data": { "success": true }
}
```

#### Errors

| Code | Status | Description |
|---|---|---|
| `INVALID_TOKEN` | 401 | Missing or invalid access token |
| `VALIDATION_ERROR` | 400 | `credentialId` path parameter is missing |
| `PASSKEY_NOT_FOUND` | 404 | No credential with that ID found for this user |

---

### `PATCH /auth/passkey/credentials/{credentialId}`

Rename a passkey credential. Pass `null` for `name` to clear the friendly name.

**Availability**: Only when `passkey` is configured.
**Auth**: Required (Bearer token)
**Middleware**: CORS, ErrorHandler, JSONParser, Auth

#### Request

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string \| null` | Yes | New friendly name, or `null` to clear it |

```json
{ "name": "Work MacBook" }
```

```json
{ "name": null }
```

#### Response `200`

```json
{
  "success": true,
  "data": { "success": true }
}
```

#### Errors

| Code | Status | Description |
|---|---|---|
| `INVALID_TOKEN` | 401 | Missing or invalid access token |
| `VALIDATION_ERROR` | 400 | `credentialId` path parameter is missing |
| `PASSKEY_NOT_FOUND` | 404 | No credential with that ID found for this user |

---

## OAuth 2.1 Authorization Server

**Availability:** only when `oauthServer` is configured.

These endpoints implement RFC 6749 (OAuth 2.0), RFC 7591 (Dynamic Client Registration), RFC 7636 (PKCE), RFC 7009 (Token Revocation), and the OAuth 2.0 Authorization Server Metadata standard. Responses are **raw JSON** (no `{success, data}` envelope) to match the OAuth specs.

### OAuth Flow Overview

```
Third-party app                Auth Server (auth.fluss.io)            Dashboard (dashboard.fluss.io)        User
      |                                  |                                       |                            |
      |  1. POST /oauth/register         |                                       |                            |
      |--------------------------------->|                                       |                            |
      |  2. { client_id, client_secret } |                                       |                            |
      |<---------------------------------|                                       |                            |
      |                                                                                                       |
      |  3. Open browser → /oauth/authorize?client_id=...&redirect_uri=...&scope=...&code_challenge=...&state=|
      |---------------------------------->                                                                    |
      |                                  |  302 → dashboard.fluss.io/connect/authorize?<same params>          |
      |                                  |--------------------------------------->|                           |
      |                                                                           |  4. Show consent screen   |
      |                                                                           |-------------------------->|
      |                                                                           |  5. Click "Authorize"     |
      |                                                                           |<--------------------------|
      |                                  |  POST /oauth/authorize/decision        |                           |
      |                                  |<---------------------------------------|                           |
      |                                  |  { redirect: "<redirect_uri>?code=..." }                           |
      |                                  |--------------------------------------->|                           |
      |                                                                           |  Browser redirects to     |
      |                                                                           |  redirect_uri?code=...    |
      |<----------------------------------+---------------------------------------+---------------------------|
      |                                                                                                       |
      |  6. POST /oauth/token (grant_type=authorization_code, code, code_verifier)                            |
      |--------------------------------->|                                                                    |
      |  7. { access_token, refresh_token, expires_in, scope }                                                |
      |<---------------------------------|                                                                    |
      |                                                                                                       |
      |  8. Bearer access_token → resource server (e.g. fluss-mcp)                                            |
```

---

### `GET /.well-known/oauth-authorization-server`

OAuth 2.0 Authorization Server Metadata (RFC 8414).

**Auth**: None
**Response**: Raw JSON (no envelope)

```json
{
  "issuer": "https://auth.fluss.io",
  "authorization_endpoint": "https://auth.fluss.io/oauth/authorize",
  "token_endpoint": "https://auth.fluss.io/oauth/token",
  "registration_endpoint": "https://auth.fluss.io/oauth/register",
  "revocation_endpoint": "https://auth.fluss.io/oauth/revoke",
  "userinfo_endpoint": "https://auth.fluss.io/oauth/userinfo",
  "jwks_uri": "https://auth.fluss.io/.well-known/jwks.json",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["client_secret_post", "none"],
  "registration_endpoint_auth_methods_supported": ["none"],
  "scopes_supported": ["devices:read", "devices:control", "access:read", "access:write", "profile:read"]
}
```

---

### `GET /.well-known/jwks.json`

JSON Web Key Set for verifying OAuth access tokens. Resource servers (e.g. `fluss-mcp`) fetch and cache this to verify Bearer JWTs.

**Auth**: None
**Response**: Raw JSON

```json
{
  "keys": [{
    "kty": "EC", "crv": "P-256", "alg": "ES256", "use": "sig",
    "kid": "<RFC 7638 thumbprint>", "x": "...", "y": "..."
  }]
}
```

---

### `POST /oauth/register`

Dynamic Client Registration (RFC 7591). Anyone can register a client unless `dcrRequiresApiKey: true`. Excess registrations from the same IP within 24h land in `under_review` status until promoted.

**Auth**: None (or session cookie if `dcrRequiresApiKey: true`)
**Body**: `application/json`

| Field | Type | Required | Description |
|---|---|---|---|
| `client_name` | string | Yes | ≤ 200 chars, displayed on the consent screen |
| `redirect_uris` | string[] | Yes | 1–5 URIs. HTTPS only (except `http://localhost`/`127.0.0.1`) |
| `logo_uri` | string | No | HTTPS URL shown next to client name on consent screen |
| `grant_types` | string[] | No | Subset of `["authorization_code", "refresh_token"]` |
| `response_types` | string[] | No | Subset of `["code"]` |
| `token_endpoint_auth_method` | string | No | `client_secret_post` (default) or `none` (public client / SPA) |
| `scope` | string | No | Space-separated subset of supported scopes |
| `software_id` | string | No | Stable identifier for analytics |
| `software_version` | string | No | Tracked on the client record |

**Response `201`**:

```json
{
  "client_id": "flc_<32 hex>",
  "client_secret": "<base64url, only for confidential clients>",
  "client_id_issued_at": 1700000000,
  "client_secret_expires_at": 0,
  "client_name": "...",
  "redirect_uris": ["..."],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "client_secret_post",
  "scope": "devices:read devices:control profile:read",
  "status": "active"
}
```

**Errors** (raw OAuth error JSON, not the standard envelope):

| `error` | Status | When |
|---|---|---|
| `invalid_redirect_uri` | 400 | URI list missing/invalid/over the cap |
| `invalid_client_metadata` | 400 | Bad `client_name`, `logo_uri`, or unsupported method |
| `invalid_scope` | 400 | Scope contains an unknown value |
| `invalid_client` | 401 | DCR is gated and the caller has no Fluss session |

---

### `GET /oauth/authorize`

Browser-facing authorization endpoint. Validates the request, then either redirects to the dashboard consent screen (logged-in users) or to login with `return_to` (logged-out users).

**Query parameters** (all required): `client_id`, `redirect_uri`, `response_type=code`, `scope`, `state`, `code_challenge`, `code_challenge_method=S256`.

**Behaviour**:
- Missing/invalid params → 400 with raw OAuth error JSON
- No session → 302 to `${consentBaseUrl}/login?return_to=<original /authorize URL>`
- Has session → 302 to `${consentBaseUrl}/connect/authorize?<original params>`

The actual consent UI lives in your dashboard application. See the consent screen wiring in [`fluss-mcp-private`](https://github.com/fluss/fluss-mcp-private) for an end-to-end example.

---

### `POST /oauth/authorize/decision`

Called by the dashboard consent screen when the user clicks Authorize/Deny. Requires the dashboard session cookie.

**Auth**: Session cookie (`refreshToken`)
**Body**: `application/json`

```json
{
  "decision": "allow",   // or "deny"
  "client_id": "...", "redirect_uri": "...", "response_type": "code",
  "scope": "...", "state": "...", "code_challenge": "...", "code_challenge_method": "S256"
}
```

**Response**: `{ "redirect": "<redirect_uri>?code=...&state=..." }` on allow, or `?error=access_denied&state=...` on deny. The dashboard does `window.location.assign(response.redirect)`.

On `allow`, the server:
1. Validates the request (client status, redirect_uri match, scope intersection with client's allowed scopes, PKCE shape, state present)
2. Mints a single-use authorization code (32 bytes base64url, TTL 60s)
3. Records consent so the next request from this client+scope combo can auto-approve

---

### `POST /oauth/token`

Exchange code for tokens, or refresh an access token. **Body must be `application/x-www-form-urlencoded`** per OAuth spec.

**Authorization code grant**:

```
grant_type=authorization_code
&code=<from /authorize redirect>
&client_id=<your client_id>
&client_secret=<if confidential>
&redirect_uri=<must match /authorize>
&code_verifier=<PKCE verifier>
```

**Refresh token grant**:

```
grant_type=refresh_token
&refresh_token=<from previous /token response>
&client_id=<your client_id>
&client_secret=<if confidential>
```

**Response `200`**:

```json
{
  "access_token": "eyJhbGciOiJFUzI1NiI...",   // ES256-signed JWT
  "token_type": "Bearer",
  "expires_in": 900,
  "refresh_token": "<rotated, opaque>",       // Always a new value — old one is revoked
  "scope": "devices:read devices:control profile:read"
}
```

**Errors**: `{ "error": "invalid_grant" | "invalid_client" | "unsupported_grant_type" | "invalid_request", "error_description": "..." }`

**Reuse detection**: presenting an already-rotated refresh token revokes the entire token family — the client's refresh tokens, all of them. Treat this as a hard sign-out for that client and force the user back through `/oauth/authorize`.

**Access token shape**:

```json
{
  "iss": "https://auth.fluss.io",
  "sub": "<userId>",
  "aud": "<client_id>",
  "scope": "devices:read devices:control profile:read",
  "jti": "<32-hex unique id>",
  "iat": 1700000000,
  "exp": 1700000900
}
```

Header has `alg: ES256` and `kid: <thumbprint>` matching one of the keys in `/.well-known/jwks.json`.

---

### `POST /oauth/revoke`

RFC 7009 token revocation. Always returns 200, even if the token was unknown (per spec).

**Body**: `application/x-www-form-urlencoded`, `token=<refresh_token>`

---

### `GET /oauth/userinfo`

OIDC-lite. Requires Bearer access token with `profile:read` scope.

**Response**: `{ "sub": "<userId>", "email": "...", "name": "..." }`

**Errors**: 401 with `WWW-Authenticate: Bearer realm="<issuer>", error="invalid_token"`, or 403 with `error="insufficient_scope", scope="profile:read"`.

---

### `GET /oauth/clients/{clientId}/preview`

Used by the consent screen to render client name/logo and the requested-scope display strings. Optional `?scope=...` query lets the screen check whether the user has previously consented to this exact scope set (auto-approval flow).

**Response**:

```json
{
  "client_id": "...",
  "client_name": "...",
  "logo_uri": "https://...",
  "redirect_uris": ["..."],
  "requested_scopes": [
    { "scope": "devices:read", "displayName": "View your Fluss devices", "description": "..." }
  ],
  "previously_consented": false
}
```

---

### `GET /oauth/me/authorizations`

Logged-in user's authorized OAuth clients. Powers the "Connections" tab in the dashboard.

**Auth**: Session cookie

**Response**:

```json
{
  "authorizations": [
    {
      "client_id": "...", "client_name": "Claude.ai", "logo_uri": "...",
      "scopes": [{ "scope": "devices:read", "displayName": "...", "description": "..." }],
      "granted_at": 1700000000000,
      "last_used_at": 1700001000000
    }
  ]
}
```

---

### `DELETE /oauth/me/authorizations/{clientId}`

Revoke consent for a specific client. Deletes the consent record AND revokes every active refresh token issued to this user from that client.

**Auth**: Session cookie
**Response**: `{ "revoked": "<clientId>" }`

---

## Migration Function

The module exports a `migrationFunction` Lambda for migrating users from an external authentication system (e.g. Cognito, Firebase Auth, Auth0) into this module. It is an **internal** function — not exposed via HTTP — intended to be invoked directly from other Lambdas, Step Functions, or scripts using the AWS SDK.

### How It Works

1. **Receives a `MigrateUserRequest`** payload with the user's details
2. **Creates or updates the user** in DynamoDB:
   - If the `userId` already exists, the user record is updated with any new fields provided
   - If the `userId` does not exist, a new user is created (requires `email` and `username`)
3. **Validates uniqueness** — mobile numbers are checked to prevent duplicates
4. **Enforces session limits** — if the platform's session limit is reached, the oldest sessions are deleted
5. **Creates a new session** and generates a JWT token pair (access + refresh)
6. **Returns tokens** so the migrated user is immediately authenticated

### Request Payload

```typescript
interface MigrateUserRequest {
  userId: string                    // Required — the user's ID from your existing system
  email?: string                    // Required for new users, optional for updates
  username?: string                 // Required for new users, optional for updates
  mobile: string                    // User's mobile number (international format)
  countryCode?: string              // ISO 3166-1 alpha-2 (auto-derived from mobile if omitted)
  passwordHash?: string             // Optional — existing password hash to preserve
  deviceInfo?: DeviceInfo           // Optional — device metadata; platform is derived from deviceInfo.platform
  roles?: string[]                  // User roles (default: [])
  apiKey?: string                   // Optional — API key to associate with the user
  voipToken?: string                // Optional — VoIP push token (iOS only, from PushKit)
  notificationToken?: string        // Optional — push notification token (APNS on iOS, FCM on Android)
  version?: string                  // Optional — app version (e.g. "v3.0.8")
  updatedAt?: number                // Optional — original timestamp from source system (preserves history)
}
```

**Notes**:
- `platform` is no longer a separate field — it is derived from `deviceInfo.platform` (`"android"` or `"ios"` → `"mobile"`, otherwise `"web"`)
- `shortUserId` is auto-generated (first 18 characters of the UUID without hyphens)
- `countryCode` is auto-derived from the mobile number's calling code if not provided (e.g. `+27...` → `"ZA"`)
- When `updatedAt` is provided, it is used as the user's `createdAt` and `updatedAt` timestamps instead of the current time

### Response

```typescript
interface MigrateUserResponse {
  userId: string
  accessToken: string               // JWT access token
  refreshToken: string              // Refresh token
  expiresIn: number                 // Access token TTL in seconds
  tokenType: string                 // Always "Bearer"
  sessionId: string                 // Created session ID
}
```

### Invoking the Migration Function

Use the AWS SDK to invoke the Lambda directly:

```typescript
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'

const lambda = new LambdaClient({})

const response = await lambda.send(new InvokeCommand({
  FunctionName: auth.migrationFunction.name,  // From createAuthModule() result
  Payload: JSON.stringify({
    userId: 'existing-user-id-from-old-system',
    email: 'user@example.com',
    username: 'johndoe',
    mobile: '+1234567890',
    roles: ['user'],
    apiKey: 'ak_user123...',
    version: 'v3.0.8',
    updatedAt: 1700000000000
  })
}))

const result = JSON.parse(Buffer.from(response.Payload!).toString())
// result: { userId, accessToken, refreshToken, expiresIn, tokenType, sessionId }
```

### Batch Migration Example

To migrate users in bulk from an existing system, iterate over your user records and invoke the function for each:

```typescript
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'

const lambda = new LambdaClient({})

async function migrateUsers(users: Array<{ id: string; email: string; username: string; mobile: string; apiKey?: string; version?: string; updatedAt?: number }>) {
  for (const user of users) {
    try {
      await lambda.send(new InvokeCommand({
        FunctionName: auth.migrationFunction.name,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify({
          userId: user.id,
          email: user.email,
          username: user.username,
          mobile: user.mobile,
          roles: ['user'],
          apiKey: user.apiKey,
          version: user.version,
          updatedAt: user.updatedAt
        })
      }))
      console.log(`Migrated user ${user.id}`)
    } catch (error) {
      console.error(`Failed to migrate user ${user.id}:`, error)
    }
  }
}
```

### Behaviour Details

| Scenario | Behaviour |
|---|---|
| `userId` does not exist | Creates a new user. `email` and `username` are **required**. |
| `userId` already exists | Updates the existing user with any provided fields. Omitted fields keep their current values. |
| `mobile` belongs to another user | Throws an error — mobile numbers must be unique. |
| Session limit reached for platform | Deletes the oldest session(s) to make room for the new one. Platform is derived from `deviceInfo.platform`. |
| `roles` is empty or omitted | New users get `[]`. Existing users keep their current roles. |
| `passwordHash` omitted | Stored as empty string for new users. Existing users are not affected. |
| `countryCode` omitted | Auto-derived from the mobile number's calling code (e.g. `+27` → `ZA`). |
| `apiKey` omitted | Not set for new users. Existing users keep their current API key. |
| `voipToken` / `notificationToken` provided | Stored directly on the user record. |
| `voipToken` / `notificationToken` omitted | Not set for new users. Existing users keep their current tokens. |
| `version` omitted | Not set for new users. Existing users keep their current version. |
| `updatedAt` provided | Used as the user's `createdAt`/`updatedAt` timestamps (preserves original history). |
| `updatedAt` omitted | Current time is used for timestamps. |

### Error Handling

The function throws `AuthError` with these codes:

| Code | Status | Cause |
|---|---|---|
| `VALIDATION_ERROR` | 400 | `userId` is missing |
| `INTERNAL_ERROR` | 500 | Migration failed (e.g. mobile already registered, missing required fields for new user) |

### Accessing the Function

The migration function is returned by `createAuthModule()`:

```typescript
const auth = createAuthModule({ /* config */ })

// auth.migrationFunction — the Lambda function resource
// Use auth.migrationFunction.name to get the function name for invocation
// Use auth.migrationFunction.arn to reference it in IAM policies
```

---

## Services

### AuthService

Orchestrates authentication flows: OTP login, passkey login, password login, token refresh, and logout.

```typescript
const authService = createAuthService(tokenService, userService, sessionRepository, config, passwordService)
```

The optional fifth argument, `passwordService`, is required only for `loginFromPassword`.

#### `loginFromOtp(identifier: string, deviceInfo?): Promise<{ user, tokens, isNewUser }>`

Finds or creates a user by identifier (mobile/email), creates a session, and returns tokens. Returns `isNewUser: true` when a new user was auto-created.

#### `loginFromPassword(email: string, password: string, deviceInfo?): Promise<{ user, tokens, isNewUser }>`

Verifies `password` against the user's stored hash (looked up by email), creates a session, and returns tokens. Throws `INVALID_CREDENTIALS` for an unknown email, an account with no password set, or a wrong password; wrong passwords increment the failed-login counter and honor the lockout policy.

#### `refresh(refreshToken: string): Promise<{ tokens }>`

Issues a new token pair via refresh token rotation.

#### `logout(userId: string, sessionId?, allDevices?): Promise<void>`

Invalidates sessions.

### PasswordAuthService

Manages password lifecycle operations outside of login: setting, changing, and resetting passwords.

```typescript
const passwordAuthService = createPasswordAuthService(userService, resetTokenRepository, passwordService, emailProvider, config)
```

#### `setPassword(userId: string, newPassword: string): Promise<void>`

Validates and stores a new password hash for the user.

#### `changePassword(userId: string, currentPassword: string | undefined, newPassword: string): Promise<void>`

Changes the password. Requires the correct `currentPassword` when the account already has one; allows setting when none exists.

#### `requestPasswordReset(email: string): Promise<void>`

Creates a hashed, single-use reset token (with TTL) and emails it when an email provider is configured. Always resolves without revealing whether the email exists.

#### `resetPassword(email: string, token: string, newPassword: string): Promise<void>`

Verifies the reset token, updates the password, and invalidates the token. Throws `RESET_TOKEN_INVALID` / `RESET_TOKEN_EXPIRED` on a bad or expired token.

### OtpService

Generates, sends, and verifies one-time passwords via SMS, WhatsApp, or Email.

```typescript
const otpService = createOtpService(otpRepository, smsProviderService, emailProvider, otpConfig)
```

#### `sendOtp(identifier: string, channel?): Promise<OtpSendResponse>`

Sends a 6-digit OTP. Auto-detects channel from identifier (email → email, phone → sms). Supports SMS provider failover.

#### `verifyOtp(identifier: string, code: string): Promise<OtpVerifyResponse>`

Validates an OTP code. Max 5 attempts per OTP.

### UserService

CRUD operations for user accounts.

#### `createUser(input: UserCreateInput): Promise<User>`

Creates a new user. Only checks uniqueness for provided fields (mobile/email).

#### `getUserByIdentifier(identifier: string): Promise<User | null>`

Looks up user by email (GSI4) or mobile (GSI1) based on identifier format.

#### `getUserByEmail(email: string): Promise<User | null>`

Looks up user by email via GSI4.

### AccountService

#### `deleteAccount(userId: string): Promise<void>`

Deletes all sessions and the user record. No password confirmation required (auth token is sufficient).

### EmailProviderService

SES-based email provider for sending OTP emails.

```typescript
const emailProvider = createSesEmailProvider('noreply@example.com')
```

#### `send(to: string, subject: string, body: string): Promise<EmailProviderResult>`

Sends an email via AWS SES.

---

## Error Codes

| Code | Status | Description |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | Invalid credentials |
| `USER_NOT_FOUND` | 404 | User not found |
| `EMAIL_ALREADY_EXISTS` | 409 | Email address is already registered |
| `MOBILE_ALREADY_EXISTS` | 409 | Mobile number is already registered |
| `INVALID_TOKEN` | 401 | Invalid or malformed token |
| `TOKEN_EXPIRED` | 401 | Token has expired |
| `SESSION_NOT_FOUND` | 404 | Session not found or already invalidated |
| `ACCOUNT_LOCKED` | 423 | Account is temporarily locked |
| `CAPTCHA_FAILED` | 400 | CAPTCHA verification failed |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `OTP_EXPIRED` | 400 | OTP has expired |
| `OTP_INVALID` | 400 | Invalid OTP code |
| `OTP_MAX_ATTEMPTS` | 429 | Maximum OTP verification attempts exceeded |
| `OTP_SEND_FAILED` | 500 | Failed to send OTP |
| `OTP_CHANNEL_NOT_ENABLED` | 400 | OTP channel is not enabled |
| `SMS_COUNTRY_CODE_NOT_ALLOWED` | 400 | SMS is not supported for this country code |
| `PASSWORD_TOO_WEAK` | 400 | Password does not meet the minimum length |
| `RESET_TOKEN_INVALID` | 400 | Password reset token not found or does not match |
| `RESET_TOKEN_EXPIRED` | 400 | Password reset token has expired |
| `PASSKEY_NOT_FOUND` | 404 | Passkey credential not found |
| `PASSKEY_CHALLENGE_EXPIRED` | 400 | Passkey challenge has expired |
| `PASSKEY_VERIFICATION_FAILED` | 400 | Passkey verification failed |
| `PASSKEY_ALREADY_REGISTERED` | 409 | This passkey credential is already registered |

### OAuth-specific error codes

OAuth endpoints return errors in the OAuth-standard shape (`{ error, error_description }`) rather than the `{success: false, error: { code }}` envelope. The internal `ErrorCode` enum entries (used in code) map to RFC-6749 / RFC-7591 error names on the wire:

| Internal code | RFC error name | Status | When |
|---|---|---|---|
| `OAUTH_INVALID_REQUEST` | `invalid_request` | 400 | Missing/malformed parameter |
| `OAUTH_INVALID_CLIENT` | `invalid_client` | 401 | Unknown `client_id` or wrong `client_secret` |
| `OAUTH_INVALID_GRANT` | `invalid_grant` | 400 | Bad/expired/replayed code or refresh token |
| `OAUTH_UNAUTHORIZED_CLIENT` | `unauthorized_client` | 403 | Client status is `under_review` or `disabled` |
| `OAUTH_UNSUPPORTED_GRANT_TYPE` | `unsupported_grant_type` | 400 | `grant_type` not `authorization_code` or `refresh_token` |
| `OAUTH_UNSUPPORTED_RESPONSE_TYPE` | `unsupported_response_type` | 400 | `response_type` not `code` |
| `OAUTH_INVALID_SCOPE` | `invalid_scope` | 400 | Unknown scope |
| `OAUTH_INVALID_REDIRECT_URI` | `invalid_redirect_uri` | 400 | `redirect_uri` not registered or invalid |
| `OAUTH_INVALID_CLIENT_METADATA` | `invalid_client_metadata` | 400 | Bad DCR payload |
| `OAUTH_ACCESS_DENIED` | `access_denied` | - | User denied consent (returned in redirect, not the response body) |
| `OAUTH_SERVER_ERROR` | `server_error` | 500 | Unexpected error |

---

## Frontend Integration

### Authentication Flow

```
Client                                          Server
  |                                               |
  |  1. POST /auth/otp/send                       |
  |  { identifier: "+1234567890" }                |
  |---------------------------------------------->|
  |                                               |
  |  2. { success, channel, expiresIn }           |
  |<----------------------------------------------|
  |                                               |
  |  3. POST /auth/otp/verify                     |
  |  { identifier: "+1234567890", code: "123456" }|
  |---------------------------------------------->|
  |                                               |
  |  4. Response + Set-Cookie: refreshToken       |
  |  { user, accessToken, isNewUser, expiresIn }  |
  |<----------------------------------------------|
  |                                               |
  |  [If isNewUser: true]                         |
  |  5. PUT /auth/profile                         |
  |  Authorization: Bearer <accessToken>          |
  |  { username: "johndoe", email: "..." }        |
  |---------------------------------------------->|
  |                                               |
  |  6. { user }  (updated profile)               |
  |<----------------------------------------------|
  |                                               |
  |  7. GET /auth/me                               |
  |  Authorization: Bearer <accessToken>          |
  |---------------------------------------------->|
  |                                               |
  |  8. { user }  (full profile)                  |
  |<----------------------------------------------|
  |                                               |
  |  9. GET /api/protected                        |
  |  Authorization: Bearer <accessToken>          |
  |---------------------------------------------->|
  |                                               |
  |  [Access token expires]                       |
  |                                               |
  |  10. POST /auth/refresh                       |
  |  Cookie: refreshToken=...                     |
  |---------------------------------------------->|
  |                                               |
  |  11. New accessToken + Set-Cookie (rotated)   |
  |<----------------------------------------------|
```

## Troubleshooting

### CORS Errors

Ensure your origin is in `allowOrigins` and frontend sends `credentials: 'include'`. You cannot use wildcard `*` with credentials.

### Cookies Not Being Set

1. Use `credentials: 'include'` in fetch/axios
2. Use HTTPS in production (or set `secure: false` for localhost)
3. Check `SameSite` attribute compatibility with your setup

### Token Expired Errors

Implement automatic refresh on 401 responses.

### Account Locked

After too many failed login attempts, the account is locked for the configured duration (default: 15 minutes).

---

## License

MIT
