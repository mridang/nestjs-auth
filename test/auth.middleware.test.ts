import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import request from 'supertest';
// noinspection ES6PreferShortImport
import { AuthMiddleware } from '../src/auth.middleware.js';
// noinspection ES6PreferShortImport
import { AuthModule } from '../src/auth.module.js';
// noinspection ES6PreferShortImport
import {
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse
} from 'express';
import type { IAuthModuleOptions } from '../src/auth-module.options.js';

describe.skip('AuthMiddleware (E2E)', () => {
  let app: INestApplication;
  let agent: ReturnType<typeof request.agent>;

  const mockAuthConfig: IAuthModuleOptions = {
    secret: 'a_very_secure_secret_for_testing_e2e',
    trustHost: true,
    useSecureCookies: false,
    basePath: '/api/auth',
    providers: [
      {
        id: 'credentials',
        name: 'Credentials',
        type: 'credentials',
        credentials: {
          username: { label: 'Username', type: 'text' },
          password: { label: 'Password', type: 'password' }
        },
        async authorize(credentials) {
          if (
            credentials?.username === 'test' &&
            credentials?.password === 'password'
          ) {
            return { id: '1', name: 'Test User', email: 'test@example.com' };
          }
          return null;
        }
      }
    ]
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthModule.register(mockAuthConfig)]
    }).compile();

    app = moduleFixture.createNestApplication();
    const adapterHost = app.get(HttpAdapterHost);

    const middleware = new AuthMiddleware(mockAuthConfig, adapterHost);
    app.use(
      '/api/auth',
      (req: ExpressRequest, res: ExpressResponse, next: NextFunction) =>
        middleware.use(req, res, next)
    );

    await app.init();
    agent = request.agent(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return null for an empty session when unauthenticated', () => {
    return agent
      .get('/api/auth/session')
      .expect(200)
      .expect((res) => {
        expect(res.body).toBeNull();
      });
  });

  it('should perform the full sign-in and sign-out flow', async () => {
    const csrfRes = await agent.get('/api/auth/signin').expect(200);
    const csrfMatch = csrfRes.text.match(/name="csrfToken" value="([^"]+)"/);
    if (!csrfMatch) throw new Error('CSRF Token not found');
    const csrfToken = csrfMatch[1];

    await agent
      .post('/api/auth/callback/credentials')
      .type('form')
      .send({
        username: 'test',
        password: 'password',
        csrfToken: csrfToken
      })
      .expect(302);

    const sessionRes = await agent.get('/api/auth/session').expect(200);
    expect(sessionRes.body.user.email).toBe('test@example.com');

    const signOutCsrfRes = await agent.get('/api/auth/signin').expect(200);
    const signOutCsrfMatch = signOutCsrfRes.text.match(
      /name="csrfToken" value="([^"]+)"/
    );
    if (!signOutCsrfMatch) throw new Error('Signout CSRF Token not found');
    const signOutCsrfToken = signOutCsrfMatch[1];

    await agent
      .post('/api/auth/signout')
      .type('form')
      .send({
        csrfToken: signOutCsrfToken
      })
      .expect(302);

    const finalSessionRes = await agent.get('/api/auth/session').expect(200);
    expect(finalSessionRes.body).toBeNull();
  });
});
