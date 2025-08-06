# NestJS Auth.js

A [NestJS](https://nestjs.com/) integration for [Auth.js](https://authjs.dev/)
that provides seamless authentication with multiple providers, session
management, and role-based access control using NestJS patterns.

This integration brings the power and flexibility of Auth.js to NestJS
applications with full TypeScript support, framework-agnostic HTTP adapters
(Express/Fastify), and NestJS-native patterns including guards, decorators,
and dependency injection.

### Why?

Modern web applications require robust, secure, and flexible authentication
systems. While Auth.js provides excellent authentication capabilities,
integrating it with NestJS applications requires careful consideration of
framework patterns, dependency injection, and TypeScript integration.

However, a direct integration isn't always straightforward. Different types
of applications or deployment scenarios might warrant different approaches:

- **Framework Integration:** Auth.js operates at the HTTP level, while NestJS
  uses decorators, guards, and dependency injection. A proper integration
  should bridge this gap by providing NestJS-native patterns for
  authentication and authorization while maintaining the full Auth.js
  ecosystem compatibility.
- **HTTP Adapter Abstraction:** NestJS supports multiple HTTP frameworks
  (Express, Fastify). Teams need a unified approach that works seamlessly
  with both, allowing framework switching without changing authentication
  code.
- **Session and Request Lifecycle:** Proper session handling in NestJS
  requires integration with the request lifecycle, guards, and decorators.
  Manual integration often leads to inconsistent session management or
  improper request handling across different routes.
- **Role-Based Access Control:** Many applications need fine-grained
  authorization beyond simple authentication. This requires seamless
  integration between Auth.js user data and NestJS authorization patterns.

This integration, `@mridang/nestjs-auth`, aims to provide the flexibility to
handle such scenarios. It allows you to leverage the full Auth.js ecosystem
while maintaining NestJS best practices, ultimately leading to a more
effective and less burdensome authentication implementation.

## Installation

Install using NPM by using the following command:

```sh
npm install @mridang/nestjs-auth @auth/core
```

## Usage

To use this integration, add `AuthJsModule` to your NestJS application
module. The module provides authentication infrastructure with configurable
guards, middleware, and decorators.

You'll need to configure it with your Auth.js providers and options. The
integration will then be available throughout your application via NestJS
dependency injection.

First, add the module to your `AppModule`:

```typescript
import { Module } from '@nestjs/common';
import { AuthJsModule } from '@mridang/nestjs-auth';
import GoogleProvider from '@auth/core/providers/google';

@Module({
  imports: [
    AuthJsModule.register({
      providers: [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET
        })
      ],
      secret: process.env.AUTH_SECRET,
      trustHost: true
    })
  ]
})
export class AppModule {}
```

#### Using the Authentication System

The integration provides several decorators and guards for handling
authentication:

**Decorators and Guards:**

- `@Public()`: Marks routes as publicly accessible, bypassing authentication
- `@RequireRoles()`: Restricts access to users with specific roles
- `@AuthSession()`: Injects the current Auth.js session into route handlers
- `AuthJsGuard`: Global guard for authentication (applied by default)
- `RolesGuard`: Global guard for role-based authorization

**Basic Usage:**

```typescript
import { Controller, Get } from '@nestjs/common';
import { AuthSession, Public, RequireRoles } from '@mridang/nestjs-auth';
import type { Session } from '@auth/core/types';

@Controller('api')
export class ApiController {
  @Get('public')
  @Public() // Bypass authentication
  getPublicData() {
    return { message: 'Public endpoint' };
  }

  @Get('profile')
  // Authenticated by default (global guard)
  getProfile(@AuthSession() session: Session | null) {
    return {
      user: session?.user,
      expires: session?.expires
    };
  }

  @Get('admin')
  @RequireRoles('admin') // Role-based access
  getAdminData(@AuthSession() session: Session | null) {
    return { adminData: true };
  }
}
```

##### Example: Advanced Configuration with Multiple Providers

This example shows how to use async registration with multiple Auth.js
providers and custom session configuration:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthJsModule } from '@mridang/nestjs-auth';
import GoogleProvider from '@auth/core/providers/google';
import GitHubProvider from '@auth/core/providers/github';

@Module({
  imports: [
    ConfigModule.forRoot(),
    AuthJsModule.registerAsync(
      {
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          providers: [
            GoogleProvider({
              clientId: configService.get('GOOGLE_CLIENT_ID'),
              clientSecret: configService.get('GOOGLE_CLIENT_SECRET')
            }),
            GitHubProvider({
              clientId: configService.get('GITHUB_CLIENT_ID'),
              clientSecret: configService.get('GITHUB_CLIENT_SECRET')
            })
          ],
          secret: configService.get('AUTH_SECRET'),
          trustHost: true,
          session: {
            strategy: 'jwt',
            maxAge: 30 * 24 * 60 * 60 // 30 days
          },
          callbacks: {
            jwt: async ({ token, user }) => {
              if (user) {
                token.roles = user.roles;
              }
              return token;
            },
            session: async ({ session, token }) => {
              session.user.roles = token.roles as string[];
              return session;
            }
          }
        }),
        inject: [ConfigService]
      },
      {
        globalGuard: true, // Require auth by default
        rolesGuard: true, // Enable role-based access
        basePath: '/auth' // Auth routes base path
      }
    )
  ]
})
export class AppModule {}
```

## Known Issues

- **HTTP Adapter Dependencies:** The integration dynamically detects Express
  or Fastify adapters based on the underlying NestJS HTTP adapter. Other
  custom HTTP adapters may require additional adapter implementations.
- **Session Storage Configuration:** The integration relies on Auth.js
  session handling mechanisms. When configuring custom session storage or
  database adapters, ensure they are properly configured in the Auth.js
  options passed to the module.
- **Role-Based Authorization (`RolesGuard`):** The roles guard expects user
  roles to be available in the `session.user.roles` array. Ensure your
  Auth.js callbacks (particularly `jwt` and `session` callbacks) properly
  populate this field from your authentication provider or database.
- **Type Augmentation:** The integration automatically augments Express and
  Fastify request types with session properties. For custom user properties
  beyond the default Auth.js user schema, you'll need to extend the Auth.js
  types in your application.

## Useful links

- **[Auth.js](https://authjs.dev/):** The authentication library that this
  integration is built upon.
- **[NestJS](https://nestjs.com/):** The Node.js framework this integration
  is designed for.
- **[Auth.js Providers](https://authjs.dev/getting-started/providers):**
  Complete list of supported authentication providers.

## Contributing

If you have suggestions for how this integration could be improved, or
want to report a bug, open an issue - we'd love all and any
contributions.

## License

Apache License 2.0 © 2024 Mridang Agarwalla
