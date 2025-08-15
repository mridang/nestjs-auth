// file: test/e2e/server-sessions.spec.ts
/**
 * E2E: ServerSessions matrix across session strategy, cookie security, and user
 * actor. Uses a dynamic Nest module with database session strategy and a
 * mock OIDC server. Verifies route access, session payloads, exposed
 * providers, and CSRF cookie naming under secure and insecure cookies.
 *
 * Matrix:
 *   - Strategy: Database (with OAuth)
 *   - Cookies: Insecure (HTTP), Secure (HTTPS semantics for tests)
 *   - Actors: unauthenticated, user, admin
 *
 * The secure cookie behavior is simulated for HTTP by patching SuperAgent
 * so it will send `Secure` cookies. The patch is confined to this suite.
 */

import { expect } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { agent as SuperAgent } from 'superagent';
import { URL } from 'url';
import { CookieAccessInfo } from 'cookiejar';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { ServerSessionsModule, TestUser } from './server-sessions.module.js';
import { authenticateOidc } from './authenticators/oidc.js';
import './supertest-extensions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const originalAttachCookies = (SuperAgent.prototype as any)._attachCookies;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(SuperAgent.prototype as any)._attachCookies = function (request_: any) {
  if (process.env.TEST_SECURE_COOKIES === 'true') {
    const url = new URL(request_.url);
    const access = new CookieAccessInfo(url.hostname, url.pathname, true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (request_ as any).cookies = this.jar.getCookies(access).toValueString();
  } else {
    Reflect.apply(originalAttachCookies, this, [request_]);
  }
};

let container: StartedTestContainer;
let oauthHost: string;
let appRef: INestApplication | null = null;

const TEST_USERS: Record<'admin' | 'user', TestUser> = {
  admin: {
    id: '1',
    name: 'Admin User',
    email: 'admin@example.com',
    roles: ['admin', 'user']
  },
  user: {
    id: '2',
    name: 'Regular User',
    email: 'user@example.com',
    roles: ['user']
  }
};

beforeAll(async () => {
  container = await new GenericContainer(
    'ghcr.io/navikt/mock-oauth2-server:2.1.10'
  )
    .withExposedPorts(8080)
    .withWaitStrategy(Wait.forHttp('/', 8080).forStatusCode(405))
    .start();

  oauthHost = `http://${container.getHost()}:${container.getMappedPort(8080)}`;
}, 60_000);

afterAll(async () => {
  if (container) {
    await container.stop();
  }
});

describe('ServerSessions E2E matrix (strategy x cookie modes x access matrix)', () => {
  [
    {
      label: 'Database strategy with OAuth',
      authenticate: async (
        agent: ReturnType<typeof request.agent>,
        who: TestUser
      ): Promise<void> => {
        await authenticateOidc(appRef!, agent, who);
      }
    }
  ].forEach(({ label: strategyLabel, authenticate: authFn }) => {
    describe(strategyLabel, () => {
      [
        {
          label: 'Insecure cookies (HTTP)',
          useSecureCookies: false
        },
        {
          label: 'Secure cookies (HTTPS)',
          useSecureCookies: true
        }
      ].forEach(({ label: cookieLabel, useSecureCookies }) => {
        describe(cookieLabel, () => {
          let originalEnv: string | undefined;

          beforeAll(async () => {
            originalEnv = process.env.TEST_SECURE_COOKIES;
            process.env.TEST_SECURE_COOKIES = String(useSecureCookies);

            const moduleRef = await Test.createTestingModule({
              imports: [
                ServerSessionsModule.register({
                  useSecureCookies: useSecureCookies,
                  oauthIssuer: `${oauthHost}/default`,
                  users: TEST_USERS
                })
              ]
            }).compile();

            appRef = moduleRef.createNestApplication();
            await appRef.init();
            await appRef.listen(0);
          }, 60_000);

          afterAll(async () => {
            if (appRef) {
              await appRef.close();
            }
            appRef = null;

            if (originalEnv === undefined) {
              delete process.env.TEST_SECURE_COOKIES;
            } else {
              process.env.TEST_SECURE_COOKIES = originalEnv;
            }
          });

          /**
           * Ensures Auth.js exposes both configured providers so downstream
           * tests do not silently run with a misconfigured module.
           */
          test('GET /auth/providers exposes both providers', async () => {
            const res = await request(appRef!.getHttpServer())
              .get('/auth/providers')
              .expect(200);

            expect(res.body).toEqual(
              expect.objectContaining({
                keycloak: expect.objectContaining({
                  id: 'keycloak',
                  type: 'oidc'
                })
              })
            );
          });

          /**
           * Validates that the CSRF endpoint emits the correct cookie name
           * for secure vs insecure cookie modes and sets the Secure flag
           * only when secure cookies are enabled.
           */
          test('GET /auth/csrf sets the correct cookie name', async () => {
            const expectedName = useSecureCookies
              ? '__Host-authjs.csrf-token'
              : 'authjs.csrf-token';

            await request(appRef!.getHttpServer())
              .get('/auth/csrf')
              .expect(200)
              // @ts-expect-error since this is a custom patch
              .expectCookie(expectedName, { secure: useSecureCookies });
          });

          [
            {
              label: 'Unauthenticated' as const,
              actor: 'unauth' as const,
              setup: async (): Promise<ReturnType<typeof request.agent>> => {
                return request.agent(appRef!.getHttpServer());
              },
              expectedUser: null as
                | null
                | (typeof TEST_USERS)['user']
                | (typeof TEST_USERS)['admin']
            },
            {
              label: 'Authenticated as Regular User' as const,
              actor: 'user' as const,
              setup: async (): Promise<ReturnType<typeof request.agent>> => {
                const agent = request.agent(appRef!.getHttpServer());
                await authFn(agent, TEST_USERS.user);
                return agent;
              },
              expectedUser: TEST_USERS.user
            },
            {
              label: 'Authenticated as Admin' as const,
              actor: 'admin' as const,
              setup: async (): Promise<ReturnType<typeof request.agent>> => {
                const agent = request.agent(appRef!.getHttpServer());
                await authFn(agent, TEST_USERS.admin);
                return agent;
              },
              expectedUser: TEST_USERS.admin
            }
          ].forEach(({ label: scenarioLabel, actor, setup, expectedUser }) => {
            describe(scenarioLabel, () => {
              let agent: ReturnType<typeof request.agent>;

              beforeAll(async () => {
                agent = await setup();
              });

              (actor === 'unauth'
                ? [
                    { path: '/public', expectedStatus: 200 },
                    { path: '/session-info', expectedStatus: 200 },
                    { path: '/profile', expectedStatus: 401 },
                    { path: '/user/settings', expectedStatus: 401 },
                    { path: '/admin/dashboard', expectedStatus: 401 },
                    { path: '/staff/area', expectedStatus: 401 },
                    { path: '/auth/session', expectedStatus: 200 },
                    { path: '/auth/login', expectedStatus: 200 }
                  ]
                : actor === 'user'
                  ? [
                      { path: '/public', expectedStatus: 200 },
                      { path: '/session-info', expectedStatus: 200 },
                      { path: '/profile', expectedStatus: 200 },
                      { path: '/user/settings', expectedStatus: 200 },
                      { path: '/admin/dashboard', expectedStatus: 403 },
                      { path: '/staff/area', expectedStatus: 403 },
                      { path: '/auth/session', expectedStatus: 200 },
                      { path: '/auth/login', expectedStatus: 200 }
                    ]
                  : [
                      { path: '/public', expectedStatus: 200 },
                      { path: '/session-info', expectedStatus: 200 },
                      { path: '/profile', expectedStatus: 200 },
                      { path: '/user/settings', expectedStatus: 200 },
                      { path: '/admin/dashboard', expectedStatus: 200 },
                      { path: '/staff/area', expectedStatus: 200 },
                      { path: '/auth/session', expectedStatus: 200 },
                      { path: '/auth/login', expectedStatus: 200 }
                    ]
              ).forEach(({ path, expectedStatus }) => {
                test(`${path} → ${expectedStatus}`, async () => {
                  const res = await agent.get(path);
                  expect(res.status).toBe(expectedStatus);
                });
              });

              /**
               * Validates the public session info shape for the current
               * actor. For authenticated actors the `user` object should
               * contain stable id, email, roles, and name.
               */
              test('/session-info payload', async () => {
                const res = await agent.get('/session-info').expect(200);

                if (!expectedUser) {
                  expect(res.body.hasSession).toBe(false);
                  expect(res.body.user).toBeNull();
                } else {
                  expect(res.body.hasSession).toBe(true);
                  expect(res.body.user).toMatchObject({
                    id: expectedUser.id,
                    email: expectedUser.email,
                    roles: expectedUser.roles,
                    name: expectedUser.name
                  });
                }
              });

              /**
               * Validates the Auth.js session endpoint for the current
               * actor. For unauthenticated access the payload is null;
               * otherwise the `user` reflects the logged-in identity.
               */
              test('/auth/session payload', async () => {
                const res = await agent.get('/auth/session').expect(200);

                if (!expectedUser) {
                  expect(res.body).toBeNull();
                } else {
                  expect(res.body.user).toMatchObject({
                    id: expectedUser.id,
                    email: expectedUser.email,
                    roles: expectedUser.roles,
                    name: expectedUser.name
                  });
                }
              });

              test('unauthenticated browser requests get redirected to sign-in page', async () => {
                const agent = request.agent(appRef!.getHttpServer());

                const browserRes = await agent
                  .get('/profile')
                  .set(
                    'Accept',
                    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                  )
                  .expect(302);

                expect(browserRes.headers.location).toBe(
                  '/auth/signin?callbackUrl=%2Fprofile'
                );
              });

              test('unauthenticated API requests get JSON 401 responses', async () => {
                const agent = request.agent(appRef!.getHttpServer());

                await agent
                  .get('/profile')
                  .expect(401)
                  .expect('Content-Type', /json/)
                  .expect({
                    message: 'No user found in session',
                    error: 'Unauthorized',
                    statusCode: 401
                  });

                await agent
                  .get('/profile')
                  .set('Accept', 'application/json')
                  .expect(401)
                  .expect('Content-Type', /json/);
              });
            });
          });
        });
      });
    });
  });
});
