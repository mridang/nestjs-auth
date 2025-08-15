import { DynamicModule, Module } from '@nestjs/common';
// noinspection ES6PreferShortImport
import { AuthModule } from '../../src/index.js';
// noinspection ES6PreferShortImport
import { E2EController } from '../e2e/test.controller.js';
// noinspection ES6PreferShortImport
import { MemoryAdapter } from '../e2e/memory.adapter.js';
import { createKeycloakProvider } from './providers/keycloak.js';

declare module '@auth/core/types' {
  // noinspection JSUnusedGlobalSymbols
  interface User {
    roles: string[];
    customId?: string;
  }
}

declare module '@auth/core/adapters' {
  // noinspection JSUnusedGlobalSymbols
  interface AdapterUser {
    roles: string[];
    customId: string;
  }
}

export interface TestUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

interface ServerSessionsOptions {
  oauthIssuer: string;
  users: Record<string, TestUser>;
  useSecureCookies: boolean;
}

@Module({})
export class ServerSessionsModule {
  static register(opts: ServerSessionsOptions): DynamicModule {
    const { oauthIssuer, useSecureCookies }: ServerSessionsOptions = opts;

    const adapter = MemoryAdapter();

    return {
      module: ServerSessionsModule,
      imports: [
        AuthModule.register({
          secret: 'server-sessions-test-secret',
          trustHost: true,
          useSecureCookies: useSecureCookies,
          adapter: adapter,
          session: {
            strategy: 'database',
            maxAge: 30 * 24 * 60 * 60,
          },
          providers: [
            createKeycloakProvider({
              issuer: oauthIssuer,
              clientId: 'client1',
              clientSecret: 'secret1',
            }),
          ],
          callbacks: {
            async session({ session, user }) {
              if (user) {
                session.user = {
                  ...session.user,
                  id: user.customId,
                  email: user.email,
                  name: user.name,
                  roles: user.roles,
                };
              }
              return session;
            },
          },
        }),
      ],
      controllers: [E2EController],
    };
  }
}
