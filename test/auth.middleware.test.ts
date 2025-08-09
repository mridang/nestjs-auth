// test/auth.middleware.e2e.spec.ts
import './e2e/supertest-extensions.js';
import { expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import request from 'supertest';
import type {
  ErrorRequestHandler,
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse
} from 'express';
import express from 'express';

// noinspection ES6PreferShortImport
import { AuthMiddleware } from '../src/auth.middleware.js';
// noinspection ES6PreferShortImport
import { AuthModule } from '../src/auth.module.js';
// noinspection ES6PreferShortImport
import type { IAuthModuleOptions } from '../src/auth-module.options.js';
import { skipCSRFCheck as SKIP_CSRF } from '@auth/core';

describe('AuthMiddleware (CSRF disabled, no mocks)', () => {
  let app: INestApplication;
  let agent: ReturnType<typeof request.agent>;

  const mockAuthConfig: IAuthModuleOptions = {
    secret: 'a_very_secure_secret_for_testing_e2e',
    trustHost: true,
    useSecureCookies: false,
    basePath: '/api/auth',
    skipCSRFCheck: SKIP_CSRF,
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
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    app.use(
      '/api/auth',
      (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
        const flag = req.get('x-tripwire-write-fail');
        if (flag === '1') {
          const orig = res.setHeader.bind(res);
          let thrown = false;
          Object.defineProperty(res, 'setHeader', {
            configurable: true,
            writable: true,
            value: (
              name: string,
              value: number | string | readonly string[]
            ) => {
              if (!thrown) {
                thrown = true;
                Object.defineProperty(res, 'setHeader', {
                  configurable: true,
                  writable: true,
                  value: orig
                });
                throw new Error('tripwire-write-fail');
              }
              return orig(name, value);
            }
          });
        }
        next();
      }
    );

    const adapterHost = app.get(HttpAdapterHost);
    const middleware = new AuthMiddleware(mockAuthConfig, adapterHost);

    app.use(
      '/api/auth',
      (req: ExpressRequest, res: ExpressResponse, next: NextFunction) =>
        middleware.use(req, res, next)
    );

    app.use(
      '/api/auth',
      (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
        res.setHeader('X-Tripwire', 'reached');
        next();
      }
    );

    const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
      if (res.headersSent) {
        return next(err);
      } else {
        const message = String((err as { message?: unknown })?.message ?? err);
        res.status(598).set('X-Error-From', 'tripwire').json({ message });
      }
    };
    app.use(errorHandler);

    await app.init();
    agent = request.agent(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  test('cold start: unauthenticated session is null', () =>
    agent
      .get('/api/auth/session')
      .expect(200)
      .expect((res) => {
        expect(res.body).toBeNull();
      }));

  test('warm path: subsequent call reuses adapter', () =>
    agent
      .get('/api/auth/session')
      .expect(200)
      .expect((res) => {
        expect(res.body).toBeNull();
      }));

  test('handled response does not call next() (credentials callback)', async () => {
    await agent
      .post('/api/auth/callback/credentials')
      .type('form')
      .send({ username: 'test', password: 'password' })
      .expect(302)
      .expect((res) => {
        expect(res.headers['x-tripwire']).toBeUndefined();
      });

    const sessionRes = await agent.get('/api/auth/session').expect(200);
    expect(sessionRes.body?.user?.email).toBe('test@example.com');
  });

  test('sign-out clears session', async () => {
    await agent
      .post('/api/auth/signout')
      .type('form')
      .send({})
      .expect(302)
      .expect((res) => {
        expect(res.headers['x-tripwire']).toBeUndefined();
      });

    const finalSession = await agent.get('/api/auth/session').expect(200);
    expect(finalSession.body).toBeNull();
  });

  test('unknown action under basePath returns 400 and does not call next()', async () => {
    await agent
      .get('/api/auth/definitely-not-a-real-route')
      .expect(400)
      .expect((res) => {
        expect(res.headers['x-tripwire']).toBeUndefined();
      });
  });

  test('authorize returns null → redirect with CredentialsSignin', async () => {
    await agent
      .post('/api/auth/callback/credentials')
      .type('form')
      .send({ username: 'wrong', password: 'wrong' })
      .expectRedirectTo('/api/auth/signin');
  });

  test('propagates unexpected write failures via next(error)', async () => {
    await agent
      .post('/api/auth/callback/credentials')
      .set('x-tripwire-write-fail', '1')
      .type('form')
      .send({ username: 'test', password: 'password' })
      .expect(598)
      .expect('X-Error-From', 'tripwire')
      .expect((res) => {
        const msg = String(res.body?.message || '');
        expect(msg).toMatch(/tripwire-write-fail/);
      });
  });
});
