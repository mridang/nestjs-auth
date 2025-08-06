/**
 * authenticateOidc performs an authorization-code sign-in flow
 * against a configured OpenID Connect provider.
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { URL } from 'url';
import type { AddressInfo } from 'node:net';
import type { E2EUser } from '../e2e.module.js';

type HttpServerWithAddress = { address(): string | AddressInfo | null };

function asHeaderMap(
  headers: unknown
): Record<string, string | string[] | undefined> {
  return (headers ?? {}) as Record<string, string | string[] | undefined>;
}

export async function authenticateOidc(
  app: INestApplication,
  agent: ReturnType<typeof request.agent>,
  who: E2EUser
): Promise<void> {
  const srv = app.getHttpServer() as HttpServerWithAddress;
  const addr = srv.address();
  if (!addr) throw new Error('HTTP server is not listening');

  const host = '127.0.0.1';
  const port = typeof addr === 'string' ? 80 : addr.port;
  // noinspection HttpUrlsUsage
  const baseUrl = `http://${host}:${port}`;

  // 1) Get CSRF
  const csrfRes = await agent.get('/auth/csrf').expect(200);
  const csrfBody = (csrfRes.body ?? {}) as Partial<{ csrfToken: string }>;
  const csrfToken = csrfBody.csrfToken;
  if (!csrfToken) throw new Error('Missing csrfToken (keycloak)');

  // 2) Start sign-in
  const signInRes = await agent
    .post('/auth/signin/keycloak')
    .type('form')
    .send({ csrfToken, callbackUrl: '/' });

  if (signInRes.status < 300 || signInRes.status >= 400) {
    throw new Error(`Expected 3xx from signin, got ${signInRes.status}`);
  }

  const signInHeaders = asHeaderMap(signInRes.headers);
  const authorizeLocation = signInHeaders.location as string | undefined;
  if (!authorizeLocation) throw new Error('Missing authorize Location');

  const authorizeUrl = new URL(authorizeLocation, baseUrl).toString();

  // 3) Follow redirect(s) to mock IdP (manual to capture Location)
  let res = await fetch(authorizeUrl, { redirect: 'manual' });

  // 4) If login page (200), post credentials + claims
  if (res.status === 200) {
    const loginBody = new URLSearchParams({
      username: who.email ?? who.name ?? who.id,
      claims: JSON.stringify({
        sub: who.id,
        preferred_username: who.id,
        name: who.name,
        email: who.email,
        roles: who.roles,
        realm_access: { roles: who.roles }
      })
    });

    res = await fetch(res.url, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: loginBody
    });
  }

  if (res.status < 300 || res.status >= 400) {
    throw new Error(`Expected redirect from login, got ${res.status}`);
  }

  // 5) Complete callback on the app
  const cbLocation = res.headers.get('location');
  if (!cbLocation) throw new Error('Missing callback Location');

  const { pathname, search } = new URL(cbLocation, authorizeUrl);
  await agent.get(`${pathname}${search}`).expect(302);
}
