import { Test } from '@nestjs/testing';
import {
  Controller,
  Get,
  INestApplication,
  Module,
  Type,
  UnauthorizedException
} from '@nestjs/common';
import type { Session } from '@auth/core/types';
import CredentialsProvider from '@auth/core/providers/credentials';
import request from 'supertest';
import { agent as SuperAgent } from 'superagent';
import { URL } from 'url';
import { CookieAccessInfo } from 'cookiejar';
import './utils/matchers/supertest.ts';

// noinspection ES6PreferShortImport
import { AuthModule, AuthSession, Public, RequireRoles } from '../src/index.js';

// @ts-expect-error since this all monkey-patch related
const originalAttachCookies = SuperAgent.prototype._attachCookies;

// @ts-expect-error since this all monkey-patch related
SuperAgent.prototype._attachCookies = function (request_) {
  if (process.env.TEST_SECURE_COOKIES === 'true') {
    const url = new URL(request_.url);
    const access = new CookieAccessInfo(url.hostname, url.pathname, true);
    request_.cookies = this.jar.getCookies(access).toValueString();
  } else {
    Reflect.apply(originalAttachCookies, this, [request_]);
  }
};

const TEST_USERS = {
  admin: {
    id: '1',
    name: 'Admin User',
    email: 'admin@example.com',
    roles: ['admin', 'user'],
    password: 'password'
  },
  user: {
    id: '2',
    name: 'Regular User',
    email: 'user@example.com',
    roles: ['user'],
    password: 'password'
  }
} as const;

@Controller()
class TestController {
  @Get('public')
  @Public()
  getPublic() {
    return { message: 'This is a public endpoint', timestamp: Date.now() };
  }

  @Get('profile')
  getProfile(@AuthSession() session: Session | null) {
    if (!session?.user) throw new UnauthorizedException('No session found');
    return {
      user: session.user,
      expires: session.expires,
      message: 'Profile data'
    };
  }

  @Get('admin/dashboard')
  @RequireRoles('admin')
  getAdminDashboard(@AuthSession() session: Session | null) {
    return {
      user: session?.user,
      message: 'Welcome to the admin dashboard',
      adminOnly: true
    };
  }

  @Get('user/settings')
  @RequireRoles('user')
  getUserSettings(@AuthSession() session: Session | null) {
    return {
      user: session?.user,
      message: 'User settings page',
      userAccess: true
    };
  }

  @Get('staff/area')
  @RequireRoles('admin', 'moderator')
  getStaffArea(@AuthSession() session: Session | null) {
    return {
      user: session?.user,
      message: 'Staff only area',
      staffAccess: true
    };
  }

  @Get('session-info')
  @Public()
  getSessionInfo(@AuthSession() session: Session | null) {
    return {
      hasSession: !!session,
      user: session?.user || null,
      message: 'Session info (public)'
    };
  }
}

function createTestAppModule(useSecureCookies: boolean): Type {
  @Module({
    imports: [
      AuthModule.register(
        {
          secret:
            'a-test-secret-that-is-at-least-32-characters-long-for-security',
          trustHost: true,
          useSecureCookies,
          providers: [
            CredentialsProvider({
              name: 'credentials',
              credentials: {
                username: { label: 'Username', type: 'text' },
                password: { label: 'Password', type: 'password' }
              },
              async authorize(credentials) {
                if (!credentials?.username || !credentials?.password)
                  return null;
                const user = Object.values(TEST_USERS).find(
                  (u) => u.email === credentials.username
                );
                if (user && user.password === credentials.password) {
                  const { ...userWithoutPassword } = user;
                  return userWithoutPassword;
                }
                return null;
              }
            })
          ],
          callbacks: {
            async jwt({ token, user }) {
              if (user && 'roles' in user) token.roles = user.roles;
              return token;
            },
            async session({ session, token }) {
              if (session.user) {
                session.user.id = token.sub!;
                (session.user as any).roles = token.roles;
              }
              return session;
            }
          },
          pages: { signIn: '/auth/signin', error: '/auth/error' }
        },
        { globalGuard: true, rolesGuard: true }
      )
    ],
    controllers: [TestController]
  })
  class TestAppModule {}

  return TestAppModule;
}

const testMatrix = [
  {
    description: 'with Secure Cookies disabled (HTTP)',
    useSecureCookies: false
  },
  { description: 'with Secure Cookies enabled (HTTPS)', useSecureCookies: true }
];

testMatrix.forEach((config) => {
  describe(`AuthModule E2E Tests ${config.description}`, () => {
    let app: INestApplication;
    let originalEnvValue: string | undefined;

    beforeAll(async () => {
      originalEnvValue = process.env.TEST_SECURE_COOKIES;
      process.env.TEST_SECURE_COOKIES = String(config.useSecureCookies);

      const moduleFixture = await Test.createTestingModule({
        imports: [createTestAppModule(config.useSecureCookies)]
      }).compile();
      app = moduleFixture.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
      if (originalEnvValue === undefined) {
        delete process.env.TEST_SECURE_COOKIES;
      } else {
        process.env.TEST_SECURE_COOKIES = originalEnvValue;
      }
    });

    describe('Public and Core Auth Routes', () => {
      it('should access a public endpoint without authentication', () => {
        return request(app.getHttpServer()).get('/public').expect(200);
      });

      it('should return public session info when unauthenticated', () => {
        return request(app.getHttpServer()).get('/session-info').expect(200, {
          hasSession: false,
          user: null,
          message: 'Session info (public)'
        });
      });

      it('should provide a CSRF token', async () => {
        const response = await request(app.getHttpServer())
          .get('/auth/csrf')
          .expect(200);
        const expectedCookieName = config.useSecureCookies
          ? '__Host-authjs.csrf-token'
          : 'authjs.csrf-token';

        expect(response.body).toHaveProperty('csrfToken');
        expect(response).toHaveCookie(expectedCookieName, {
          secure: config.useSecureCookies
        });
      });

      it('should provide a list of configured providers', async () => {
        const response = await request(app.getHttpServer())
          .get('/auth/providers')
          .expect(200);
        expect(response.body).toEqual(
          expect.objectContaining({
            credentials: expect.objectContaining({
              id: 'credentials',
              type: 'credentials'
            })
          })
        );
      });

      it('should return a null session when unauthenticated', () => {
        return request(app.getHttpServer())
          .get('/auth/session')
          .expect(200, null);
      });
    });

    describe('Authentication Flow', () => {
      let agent: ReturnType<typeof request.agent>;

      beforeEach(() => {
        agent = request.agent(app.getHttpServer());
      });

      it('should reject sign-in with invalid credentials', async () => {
        const csrfResponse = await agent.get('/auth/csrf');
        const csrfToken = csrfResponse.body.csrfToken;
        const response = await agent
          .post('/auth/callback/credentials')
          .type('form')
          .send({
            username: 'wrong@user.com',
            password: 'wrongpassword',
            csrfToken
          });
        expect(response.headers.location).toMatch(
          /\/auth\/signin\?error=CredentialsSignin/
        );
      });

      it('should successfully sign-in with valid credentials', async () => {
        const csrfResponse = await agent.get('/auth/csrf');
        const csrfToken = csrfResponse.body.csrfToken;
        const response = await agent
          .post('/auth/callback/credentials')
          .type('form')
          .send({
            username: TEST_USERS.admin.email,
            password: TEST_USERS.admin.password,
            csrfToken
          });

        const expectedCookieName = config.useSecureCookies
          ? '__Secure-authjs.session-token'
          : 'authjs.session-token';

        expect(response).toRedirectTo('/');
        expect(response).toHaveCookie(expectedCookieName, {
          secure: config.useSecureCookies
        });
      });
    });

    describe('Protected Routes (Unauthenticated)', () => {
      it('should reject access to profile', () => {
        return request(app.getHttpServer()).get('/profile').expect(401);
      });

      it('should reject access to admin dashboard', () => {
        return request(app.getHttpServer()).get('/admin/dashboard').expect(401);
      });

      it('should reject access to user settings', () => {
        return request(app.getHttpServer()).get('/user/settings').expect(401);
      });
    });

    describe('Protected Routes (Authenticated as Admin)', () => {
      let agent: ReturnType<typeof request.agent>;

      beforeAll(async () => {
        agent = request.agent(app.getHttpServer());
        const csrfResponse = await agent.get('/auth/csrf');
        const csrfToken = csrfResponse.body.csrfToken;
        await agent.post('/auth/callback/credentials').type('form').send({
          username: TEST_USERS.admin.email,
          password: TEST_USERS.admin.password,
          csrfToken
        });
      });

      it('should have a valid session', async () => {
        const response = await agent.get('/auth/session').expect(200);
        expect(response.body.user).toMatchObject({
          id: TEST_USERS.admin.id,
          email: TEST_USERS.admin.email
        });
      });

      it('should access profile page', async () => {
        const response = await agent.get('/profile').expect(200);
        expect(response.body.message).toBe('Profile data');
      });

      it('should access user settings page (as admin has "user" role)', async () => {
        await agent.get('/user/settings').expect(200);
      });

      it('should access admin dashboard (as admin has "admin" role)', async () => {
        await agent.get('/admin/dashboard').expect(200);
      });

      it('should access staff area (as admin has "admin" role)', async () => {
        await agent.get('/staff/area').expect(200);
      });
    });
  });
});
