/// <reference path="./.sst/platform/config.d.ts" />

const PRODUCTION_ORIGINS: string[] = ['https://d3dkuvj2mr3aim.cloudfront.net']
const EMAIL_FROM_ADDRESS = 'noreply@example.com'

export default $config({
  app(input) {
    return {
      name: 'sheep-tracker',
      removal: input?.stage === 'prod' ? 'retain' : 'remove',
      protect: input?.stage === 'prod',
      home: 'aws',
      providers: {
        aws: input.stage === 'prod' ? {
          region: "af-south-1",
          profile: "personal"
        } : {}
      }
    }
  },
  async run() {
    const { setupAuth } = await import('./auth')
    const allowOrigins = ['http://localhost:5173', ...PRODUCTION_ORIGINS]

    const auth = setupAuth({ allowOrigins, emailFromAddress: EMAIL_FROM_ADDRESS })

    const table = new sst.aws.Dynamo('SheepTracker', {
      fields: {
        pk: 'string',
        sk: 'string',
        gsi1pk: 'string',
        gsi1sk: 'string',
        gsi2pk: 'string',
        gsi2sk: 'string'
      },
      primaryIndex: { hashKey: 'pk', rangeKey: 'sk' },
      globalIndexes: {
        gsi1: { hashKey: 'gsi1pk', rangeKey: 'gsi1sk' },
        gsi2: { hashKey: 'gsi2pk', rangeKey: 'gsi2sk' }
      }
    })

    const api = new sst.aws.ApiGatewayV2('SheepApi', {
      cors: {
        allowOrigins,
        allowHeaders: ['Content-Type', 'Authorization'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowCredentials: true
      }
    })

    const authorizer = api.addAuthorizer({
      name: 'JwtAuthorizer',
      lambda: { function: auth.authorizerFunction.arn }
    })

    const guarded = { auth: { lambda: authorizer.id } }
    const handlerDir = 'packages/functions/src/handlers'

    const route = (routeKey: string, file: string): void => {
      api.route(routeKey, { handler: `${handlerDir}/${file}`, link: [table] }, guarded)
    }

    route('GET /animals', 'list.handler')
    route('POST /animals', 'create.handler')
    route('GET /animals/{id}', 'get.handler')
    route('PUT /animals/{id}', 'update.handler')
    route('DELETE /animals/{id}', 'delete.handler')
    route('GET /animals/{id}/lambs', 'lambs.handler')
    route('GET /animals/{id}/lineage', 'lineage.handler')

    const web = new sst.aws.StaticSite('SheepWeb', {
      path: 'packages/web',
      build: {
        command: 'yarn build',
        output: 'dist'
      },
      dev: {
        command: 'yarn dev',
        url: 'http://localhost:5173'
      },
      environment: {
        VITE_API_URL: api.url,
        VITE_AUTH_API_URL: auth.api.url
      }
    })

    return {
      SheepApi: api.url,
      AuthApi: auth.api.url,
      Web: web.url
    }
  }
})
