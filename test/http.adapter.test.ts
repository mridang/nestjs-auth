import type {
  Request as ExpressRequest,
  Response as ExpressResponse
} from 'express';
import type { FastifyRequest } from 'fastify';
// noinspection ES6PreferShortImport
import { toHttpResponse, toWebRequest } from '../src/utils/http-adapters.js';
import { HttpAdapter } from '../src/adapters/http.adapter.js';

describe('Framework Agnostic HTTP Conversion', () => {
  const frameworks = [
    { name: 'ExpressRequest', rawReq: {} as ExpressRequest },
    { name: 'FastifyRequest', rawReq: {} as FastifyRequest }
  ];

  describe('toWebRequest', () => {
    frameworks.forEach(({ name, rawReq }) => {
      describe(`when using ${name}`, () => {
        it('builds a GET request and filters headers', async () => {
          const adapter: Partial<HttpAdapter<unknown, unknown>> = {
            getProtocol: () => 'https',
            getHost: () => 'example.com',
            getUrl: () => '/test',
            getMethod: () => 'GET',
            getHeaders: () => ({
              'content-type': 'application/json',
              'x-array': ['first', '', 'second'],
              'x-single': undefined
            }),
            getBody: () => null
          };

          const req = toWebRequest(
            rawReq,
            adapter as HttpAdapter<unknown, unknown>
          );

          expect(req.url).toBe('https://example.com/test');
          expect(req.method).toBe('GET');
          expect(req.headers.get('content-type')).toBe('application/json');
          expect(req.headers.get('x-array')).toBe('first, second');
          expect(req.headers.has('x-single')).toBe(false);
          expect(await req.text()).toBe('');
        });

        it('serializes a JSON body for POST requests', async () => {
          const body = { foo: 'bar', baz: 2 };
          const adapter: Partial<HttpAdapter<unknown, unknown>> = {
            getProtocol: () => 'https',
            getHost: () => 'api.example',
            getUrl: () => '/json',
            getMethod: () => 'POST',
            getHeaders: () => ({ 'content-type': 'application/json' }),
            getBody: () => body
          };

          const req = toWebRequest(
            rawReq,
            adapter as HttpAdapter<unknown, unknown>
          );

          expect(req.method).toBe('POST');
          expect(await req.json()).toEqual(body);
        });

        it('url-encodes a body for PUT requests', async () => {
          const body = { alpha: 'one', beta: 'two' };
          const adapter: Partial<HttpAdapter<unknown, unknown>> = {
            getProtocol: () => 'https',
            getHost: () => 'form.example',
            getUrl: () => '/form',
            getMethod: () => 'PUT',
            getHeaders: () => ({
              'content-type': 'application/x-www-form-urlencoded'
            }),
            getBody: () => body
          };

          const req = toWebRequest(
            rawReq,
            adapter as HttpAdapter<unknown, unknown>
          );

          expect(await req.text()).toBe('alpha=one&beta=two');
        });

        it('passes through a string body', async () => {
          const adapter: Partial<HttpAdapter<unknown, unknown>> = {
            getProtocol: () => 'https',
            getHost: () => 'text.example',
            getUrl: () => '/text',
            getMethod: () => 'PATCH',
            getHeaders: () => ({ 'content-type': 'text/plain' }),
            getBody: () => 'plain text body'
          };

          const req = toWebRequest(
            rawReq,
            adapter as HttpAdapter<unknown, unknown>
          );

          expect(await req.text()).toBe('plain text body');
        });

        it('passes through a Buffer body', async () => {
          const buffer = Buffer.from('buffer body');
          const adapter: Partial<HttpAdapter<unknown, unknown>> = {
            getProtocol: () => 'http',
            getHost: () => 'buffer.example',
            getUrl: () => '/buffer',
            getMethod: () => 'DELETE',
            getHeaders: () => ({}),
            getBody: () => buffer
          };

          const req = toWebRequest(
            rawReq,
            adapter as HttpAdapter<unknown, unknown>
          );
          const result = await req.arrayBuffer();

          expect(Buffer.from(result)).toEqual(buffer);
        });
      });
    });
  });

  describe('toHttpResponse', () => {
    it('groups multiple "set-cookie" headers into an array', async () => {
      const captured: {
        status?: number;
        body?: BodyInit;
        headers: Record<string, string | string[]>;
      } = { headers: {} };

      const adapter: Partial<HttpAdapter<unknown, unknown>> = {
        setHeader: (res, key, value) => (captured.headers[key] = value),
        setStatus: (res, code) => (captured.status = code),
        send: (res, body) => (captured.body = body)
      };

      const webResponse = new Response('OK', {
        status: 201,
        headers: {
          'Content-Type': 'text/plain',
          'Set-Cookie': 'A=1; Path=/; HttpOnly'
        }
      });
      webResponse.headers.append('Set-Cookie', 'B=2; Path=/; Secure');

      await toHttpResponse(
        webResponse,
        {} as ExpressResponse,
        adapter as HttpAdapter<unknown, unknown>
      );

      expect(captured.status).toBe(201);
      expect(captured.body).toBe('OK');
      expect(captured.headers['content-type']).toBe('text/plain');
      expect(captured.headers['set-cookie']).toEqual([
        'A=1; Path=/; HttpOnly',
        'B=2; Path=/; Secure'
      ]);
    });
  });
});
