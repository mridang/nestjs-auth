// noinspection JSUnusedGlobalSymbols

import request, { Response, Test as STTest } from 'supertest';
import { URL } from 'url';

/** Module augmentations so TS knows about the chainers on either shape. */
declare module 'supertest' {
  interface Test {
    expectRedirectTo(pathname: string): this;
    expectCookie(name: string, options?: { secure?: boolean }): this;
  }
}
declare module 'superagent' {
  interface Request {
    expectRedirectTo(pathname: string): this;
    expectCookie(name: string, options?: { secure?: boolean }): this;
  }
}

type CookieOpts = { secure?: boolean };

function assertRedirectTo(res: Response, pathname: string): void {
  if (res.status !== 302) {
    throw new Error(`expected 302 redirect, got ${res.status}`);
  }
  const headers = (res.headers ?? {}) as Record<
    string,
    string | string[] | undefined
  >;
  const loc = headers.location as string | undefined;
  if (!loc) {
    throw new Error('missing Location header on redirect');
  }
  const got = new URL(loc, 'http://127.0.0.1').pathname;
  if (got !== pathname) {
    throw new Error(`expected redirect to "${pathname}", got "${got}"`);
  }
}

function assertCookie(
  res: Response,
  name: string,
  opts: CookieOpts = {}
): void {
  const headers = (res.headers ?? {}) as Record<
    string,
    string | string[] | undefined
  >;
  const raw = headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (list.length === 0) {
    throw new Error('expected Set-Cookie header');
  }
  const cookie = list.find(
    (c) => typeof c === 'string' && c.startsWith(`${name}=`)
  );
  if (!cookie) {
    throw new Error(`expected cookie "${name}"`);
  }
  if (opts.secure !== undefined) {
    const hasSecure = /;\s*secure\b/i.test(cookie);
    if (hasSecure !== opts.secure) {
      throw new Error(
        `expected cookie "${name}" Secure=${String(opts.secure)}, got ${String(hasSecure)}`
      );
    }
  }
}

/** Runtime prototype patch – attach chainers to SuperTest's Test prototype. */
interface TestProto {
  expect(handler: (res: Response) => void): STTest;
  expectRedirectTo?(pathname: string): STTest;
  expectCookie?(name: string, options?: CookieOpts): STTest;
}
type MaybeTestConstructor = { prototype: TestProto };

type SupertestModuleWithCtor = typeof import('supertest') & {
  Test?: MaybeTestConstructor;
};

const STCtor: MaybeTestConstructor | undefined = (
  request as SupertestModuleWithCtor
).Test;

if (STCtor && !('expectRedirectTo' in STCtor.prototype)) {
  STCtor.prototype.expectRedirectTo = function (
    this: STTest,
    pathname: string
  ): STTest {
    return this.expect((res: Response) => assertRedirectTo(res, pathname));
  };
}
if (STCtor && !('expectCookie' in STCtor.prototype)) {
  STCtor.prototype.expectCookie = function (
    this: STTest,
    name: string,
    options?: CookieOpts
  ): STTest {
    return this.expect((res: Response) => assertCookie(res, name, options));
  };
}

/**
 * Some chains might be typed as superagent.Request (since Test extends
 * superagent.Request). The types above cover that, and if you ever need
 * a runtime patch there too, uncomment below with safe typing:
 *
 * import type superagent from 'superagent';
 * type SuperagentWithCtor = typeof import('superagent') & { Request?: { prototype: TestProto } };
 * const SAReq = (superagent as unknown as SuperagentWithCtor).Request;
 * if (SAReq && !('expectCookie' in SAReq.prototype)) { ... }
 */

export {};
