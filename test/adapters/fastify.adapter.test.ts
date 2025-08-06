import type { ExecutionContext } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { FastifyAdapter } from '../../src/adapters/fastify.adapter.js';
import { AuthenticatedRequest } from '../../src/types.js';

describe('FastifyAdapter', () => {
  let adapter: FastifyAdapter;

  beforeEach(() => {
    adapter = new FastifyAdapter();
  });

  test('getRequest() should extract AuthenticatedRequest from context', () => {
    const fakeReq = { user: { id: 'u2' } } as unknown as AuthenticatedRequest;
    const context = {
      switchToHttp: () => ({ getRequest: () => fakeReq })
    } as unknown as ExecutionContext;

    const result = adapter.getRequest(context);
    expect(result).toBe(fakeReq);
  });

  test('getResponse() should extract FastifyReply from context', () => {
    const fakeRes = {
      send: () => {}
    } as unknown as FastifyReply;
    const context = {
      switchToHttp: () => ({ getResponse: () => fakeRes })
    } as unknown as ExecutionContext;

    const result = adapter.getResponse(context);
    expect(result).toBe(fakeRes);
  });

  test('getProtocol() should return request.protocol', () => {
    const req = { protocol: 'http' } as unknown as FastifyRequest;
    expect(adapter.getProtocol(req)).toBe('http');
  });

  test('getHost() should return request.hostname', () => {
    const req = { hostname: 'svc.local' } as unknown as FastifyRequest;
    expect(adapter.getHost(req)).toBe('svc.local');
  });

  test('getUrl() should return request.url', () => {
    const req = { url: '/foo' } as unknown as FastifyRequest;
    expect(adapter.getUrl(req)).toBe('/foo');
  });

  test('getMethod() should return request.method', () => {
    const req = { method: 'DELETE' } as unknown as FastifyRequest;
    expect(adapter.getMethod(req)).toBe('DELETE');
  });

  test('getHeaders() should return request.headers', () => {
    const headers = { alpha: 'beta' } as Record<string, string | string[]>;
    const req = { headers } as unknown as FastifyRequest;
    expect(adapter.getHeaders(req)).toBe(headers);
  });

  test('getCookie() should return request.headers.cookie', () => {
    const reqWithCookie = {
      headers: { cookie: 'tok=abc' }
    } as unknown as FastifyRequest;
    expect(adapter.getCookie(reqWithCookie)).toBe('tok=abc');

    const reqNoCookie = { headers: {} } as unknown as FastifyRequest;
    expect(adapter.getCookie(reqNoCookie)).toBeUndefined();
  });

  test('getBody() should return request.body', () => {
    const body = { items: [1, 2, 3] };
    const req = { body } as unknown as FastifyRequest;
    expect(adapter.getBody(req)).toBe(body);
  });

  test('setHeader() should invoke response.header()', () => {
    let nameCaptured = '';
    let valueCaptured = '';
    const res = {
      header: (n: string, v: string) => {
        nameCaptured = n;
        valueCaptured = v;
        return res;
      }
    } as unknown as FastifyReply;

    adapter.setHeader(res, 'X-Foo', 'bar');
    expect(nameCaptured).toBe('X-Foo');
    expect(valueCaptured).toBe('bar');
  });

  test('setStatus() should invoke response.status()', () => {
    let statusCaptured = 0;
    const res = {
      status: (code: number) => {
        statusCaptured = code;
        return res;
      }
    } as unknown as FastifyReply;

    adapter.setStatus(res, 404);
    expect(statusCaptured).toBe(404);
  });

  test('send() should invoke response.send()', () => {
    let bodyCaptured = '';
    const res = {
      send: (body: string) => {
        bodyCaptured = body;
        return res;
      }
    } as unknown as FastifyReply;

    adapter.send(res, 'bye');
    expect(bodyCaptured).toBe('bye');
  });
});
