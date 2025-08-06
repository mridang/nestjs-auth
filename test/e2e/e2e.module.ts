import { DynamicModule, Module } from '@nestjs/common';
import CredentialsProvider from '@auth/core/providers/credentials';
import Keycloak from '@auth/core/providers/keycloak';
// noinspection ES6PreferShortImport
import { AuthModule } from '../../src/index.js';
import { E2EController } from './test.controller.js';

export interface E2EUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
  password?: string;
}

interface E2EOptions {
  useSecureCookies: boolean;
  oauthIssuer: string;
  users: Record<string, E2EUser>;
}

/** carry roles on JWT without importing specific Auth.js types */
type WithRoles = { roles?: string[] };

/** Keycloak-ish fields we care about */
type KeycloakLike = {
  sub?: string | null;
  email?: string | null;
  name?: string | null;
  username?: string | null;
  preferred_username?: string | null;
  roles?: string[] | null;
  realm_access?: { roles?: string[] | null } | null;
};

function asKC(p: unknown): KeycloakLike | undefined {
  return p as KeycloakLike | undefined;
}

function pickKCId(p: KeycloakLike | undefined): string {
  // no redundant "?? ''" to satisfy no-constant-binary-expression
  return p?.preferred_username ?? p?.sub ?? p?.email ?? '';
}

function pickKCRoles(p: KeycloakLike | undefined): string[] | undefined {
  return p?.roles ?? p?.realm_access?.roles ?? undefined;
}

@Module({})
export class E2EModule {
  static register(opts: E2EOptions): DynamicModule {
    const { useSecureCookies, oauthIssuer, users } = opts;

    return {
      module: E2EModule,
      imports: [
        AuthModule.register({
          secret: 'a-super-secret-for-testing',
          trustHost: true,
          useSecureCookies,
          providers: [
            CredentialsProvider({
              name: 'credentials',
              credentials: {
                username: { label: 'Username', type: 'text' },
                password: { label: 'Password', type: 'password' }
              },
              // Let Auth.js infer the type; return a User-compatible object.
              async authorize(credentials) {
                const c = credentials as {
                  username?: string;
                  password?: string;
                } | null;
                if (!c?.username || !c?.password) return null;

                const match = Object.values(users).find(
                  (u) => u.email === c.username
                );
                if (match && match.password === c.password) {
                  const { id, name, email, roles } = match;
                  // extra field 'roles' is fine; jwt() will read it
                  return { id, name, email, roles };
                }
                return null;
              }
            }),
            Keycloak({
              issuer: oauthIssuer,
              clientId: 'client1',
              clientSecret: 'secret1',
              // Inferred return type; provide minimal User shape
              profile(profile) {
                const kc = asKC(profile);
                return {
                  id: pickKCId(kc),
                  name: (kc?.name ?? kc?.username ?? '') || undefined,
                  email: kc?.email ?? undefined
                };
              }
            })
          ],
          callbacks: {
            // Use inference for params; narrow safely inside.
            async jwt({ token, user, profile }) {
              const t = token as { sub?: string } & WithRoles &
                Record<string, unknown>;

              const kc = asKC(profile);
              if (kc) {
                // OIDC flow
                t.sub = pickKCId(kc) || t.sub;
                const roles = pickKCRoles(kc);
                if (roles) t.roles = roles;
              } else if (user) {
                // Credentials flow: read roles we attached in authorize()
                const u = user as Partial<E2EUser> & WithRoles;
                if (u.id) t.sub = u.id;
                if (u.roles) t.roles = u.roles;
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
