import { createAuthModule, type AuthModuleResult } from '@alistairmross/auth/infrastructure'

export interface AuthSetupOptions {
  allowOrigins: string[]
  emailFromAddress: string
}

export function setupAuth(options: AuthSetupOptions): AuthModuleResult {
  return createAuthModule({
    jwt: {
      accessTokenExpiry: '1h',
      refreshTokenExpiry: '365d'
    },
    cookie: {
      name: 'refreshToken',
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      path: '/'
    },
    cors: {
      allowOrigins: options.allowOrigins
    },
    email: {
      provider: 'ses',
      fromAddress: options.emailFromAddress
    },
    otp: {
      methods: ['email'],
      emailFromAddress: options.emailFromAddress
    },
    password: {
      minLength: 8,
      emailFromAddress: options.emailFromAddress
    },
    handlerBasePath: 'node_modules/@alistairmross/auth/dist/src/backend/handlers'
  })
}
