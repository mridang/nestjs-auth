import { DynamicModule, Module } from '@nestjs/common';
// noinspection ES6PreferShortImport
import { AuthModule } from '../../src/index.js';
import { E2EController } from './test.controller.js';
import { createCredentialsProvider } from './providers/credential.js';
import { createKeycloakProvider } from './providers/keycloak.js';

export interface TestUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
  password?: string;
}

interface ClientSessionsOptions {
  useSecureCookies: boolean;
  oauthIssuer: string;
  users: Record<string, TestUser>;
}

/** carry roles on JWT without importing specific Auth.js types */
type WithRoles = { roles?: string[] };

@Module({})
export class ClientSessionsModule {
  static register(opts: ClientSessionsOptions): DynamicModule {
    const { useSecureCookies, oauthIssuer, users } = opts;

    return {
      module: ClientSessionsModule,
      imports: [
        AuthModule.register({
          secret: 'a-super-secret-for-testing',
          trustHost: true,
          useSecureCookies,
          providers: [
            createCredentialsProvider(users),
            createKeycloakProvider({
              issuer: oauthIssuer,
              clientId: 'client1',
              clientSecret: 'secret1'
            })
          ],
          callbacks: {
            /**
             * This callback enriches the JWT with custom claims like roles.
             * It runs only on initial sign-in. Below are examples of the full
             * payload (`params`) for each provider.
             *
             * ---
             *
             * ### Example Payload for `credentials` provider:
             * ```json
             * {
             * "token": {
             * "name": "John Doe",
             * "email": "j.doe@example.com",
             * "sub": "1"
             * },
             * "user": {
             * "id": "1",
             * "name": "John Doe",
             * "roles": [
             * "user"
             * ]
             * },
             * "account": {
             * "provider": "credentials",
             * "type": "credentials"
             * },
             * "profile": null,
             * "trigger": "signIn"
             * }
             * ```
             *
             * ---
             *
             * ### Example Payload for `keycloak` provider:
             * ```json
             * {
             * "token": {
             * "name": "Jane Doe",
             * "email": "jane@example.com",
             * "sub": "..."
             * },
             * "user": {
             * "id": "uuid-...",
             * "name": "Jane Doe",
             * "roles": [
             * "admin"
             * ]
             * },
             * "account": {
             * "provider": "keycloak",
             * "type": "oidc",
             * "access_token": "eyJ..."
             * },
             * "profile": {
             * "sub": "...",
             * "realm_access": {
             * "roles": [
             * "admin"
             * ]
             * },
             * "email": "jane@example.com"
             * },
             * "trigger": "signIn"
             * }
             * ```
             *
             * @param {object} params - The full payload object for the event.
             * @returns {object} The final, enriched token.
             */
            async jwt({ token, user, account, profile, trigger }) {
              if (trigger === 'signIn' && user) {
                token.roles = user.roles;
                switch (account?.provider) {
                  case 'keycloak':
                    token.sub = (
                      profile as { preferred_username: string }
                    ).preferred_username;
                    break;
                  case 'credentials':
                    token.sub = user.id;
                    break;
                }
              }
              return token;
            },

            // Mutate session.user in place; do NOT reassign (preserves required fields).
            async session({ session, token }) {
              const t = token as { sub?: string } & WithRoles;

              if (session.user) {
                // cast through unknown to avoid TS2352
                const mu = session.user as unknown as {
                  id?: string;
                  roles?: string[];
                };
                if (typeof t.sub === 'string') mu.id = t.sub;
                mu.roles = t.roles ?? [];
                // no reassignment of session.user
              }
              return session;
            }
          }
        })
      ],
      controllers: [E2EController]
    };
  }
}
