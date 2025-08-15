import type { ExecutionContext } from '@nestjs/common';
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { ExpressAdapter } from '../../src/adapters/express.adapter.js';
// noinspection ES6PreferShortImport
import { AuthenticatedRequest } from '../../src/types.js';

describe('ExpressAdapter', () => {
  let adapter: ExpressAdapter;

  beforeEach(() => {
    adapter = new ExpressAdapter();
  });

  test('getRequest() should extract AuthenticatedRequest from context', () => {
    const fakeReq = { user: { id: 'u1' } } as unknown as AuthenticatedRequest;
    const context = {
      switchToHttp: () => ({ getRequest: () => fakeReq }),
    } as unknown as ExecutionContext;

    const result = adapter.getRequest(context);
    expect(result).toBe(fakeReq);
  });

  test('getResponse() should extract ExpressResponse from context', () => {
    const fakeRes = {
      send: () => {},
    } as unknown as ExpressResponse;
    const context = {
      switchToHttp: () => ({ getResponse: () => fakeRes }),
    } as unknown as ExecutionContext;

    const result = adapter.getResponse(context);
    expect(result).toBe(fakeRes);
  });

  test('getProtocol() should return request.protocol', () => {
    const req = { protocol: 'https' } as unknown as ExpressRequest;
    expect(adapter.getProtocol(req)).toBe('https');
  });

  test('getHost() should return Host header or fallback to localhost', () => {
    const reqWithHost = {
      get: (name: string) => (name === 'host' ? 'api.example.com' : undefined),
    } as unknown as ExpressRequest;
    expect(adapter.getHost(reqWithHost)).toBe('api.example.com');

    const reqNoHost = { get: () => undefined } as unknown as ExpressRequest;
    expect(adapter.getHost(reqNoHost)).toBe('localhost');
  });

  test('getUrl() should return request.originalUrl', () => {
    const req = { originalUrl: '/path?x=1' } as unknown as ExpressRequest;
    expect(adapter.getUrl(req)).toBe('/path?x=1');
  });

  test('getMethod() should return request.method', () => {
    const req = { method: 'POST' } as unknown as ExpressRequest;
    expect(adapter.getMethod(req)).toBe('POST');
  });

  test('getHeaders() should return request.headers', () => {
    const headers = { foo: 'bar', arr: ['a', 'b'] } as Record<
      string,
      string | string[]
    >;
    const req = { headers } as unknown as ExpressRequest;
    expect(adapter.getHeaders(req)).toBe(headers);
  });

  test('getCookie() should return request.headers.cookie', () => {
    const reqWithCookie = {
      headers: { cookie: 'sid=123' },
    } as unknown as ExpressRequest;
    expect(adapter.getCookie(reqWithCookie)).toBe('sid=123');

    const reqNoCookie = { headers: {} } as unknown as ExpressRequest;
    expect(adapter.getCookie(reqNoCookie)).toBeUndefined();
  });

  test('getBody() should return request.body', () => {
    const body = { x: 42 };
    const req = { body } as unknown as ExpressRequest;
    expect(adapter.getBody(req)).toBe(body);
  });

  test('setHeader() should invoke response.setHeader()', () => {
    let nameCaptured = '';
    let valueCaptured = '';
    const res = {
      setHeader: (n: string, v: string) => {
        nameCaptured = n;
        valueCaptured = v;
      },
    } as unknown as ExpressResponse;

    adapter.setHeader(res, 'X-Test', 'yes');
    expect(nameCaptured).toBe('X-Test');
    expect(valueCaptured).toBe('yes');
  });

  test('setStatus() should invoke response.status()', () => {
    let codeCaptured = 0;
    const res = {
      status: (code: number) => {
        codeCaptured = code;
        return res;
      },
    } as unknown as ExpressResponse;

    adapter.setStatus(res, 201);
    expect(codeCaptured).toBe(201);
  });

  test('send() should invoke response.send()', () => {
    let bodyCaptured = '';
    const res = {
      send: (body: string) => {
        bodyCaptured = body;
        return res;
      },
    } as unknown as ExpressResponse;

    adapter.send(res, 'hello');
    expect(bodyCaptured).toBe('hello');
  });
});
