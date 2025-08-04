import { HttpAdapter } from '../adapters/http.adapter.js';
import type {
  Request as ExpressRequest,
  Response as ExpressResponse
} from 'express';
import type { FastifyReply, FastifyRequest } from 'fastify';
import qs from 'qs';

/**
 * Converts a framework-specific request (Fastify or Express) into a
 * standard Web API `Request` object. This function acts as a universal
 * adapter, enabling a single, transport-agnostic processing logic (e.g.,
 * for authentication) by abstracting the underlying HTTP server details.
 *
 * It meticulously reconstructs the URL, headers, method, and body from the
 * incoming request using the provided `HttpAdapter`. Special handling is
 * implemented for different `Content-Type` headers, such as
 * 'application/x-www-form-urlencoded' and 'application/json', to ensure
 * the body is correctly serialized for the Web API `Request`.
 *
 * @param request The incoming request object from Fastify or Express. This
 * object contains all the raw data of the HTTP request.
 * @param adapter An instance of `HttpAdapter` that provides a standardized
 * interface to access request properties (e.g., headers, body, method)
 * regardless of the underlying framework.
 * @returns A standard Web API `Request` object, fully populated and ready
 * for use with libraries that operate on the Fetch API standard.
 */
export function toWebRequest(
  request: FastifyRequest | ExpressRequest,
  adapter: HttpAdapter<unknown, unknown>
): Request {
  const protocol = adapter.getProtocol(request);
  const host = adapter.getHost(request);
  const url = `${protocol}://${host}${adapter.getUrl(request)}`;

  const headers = new Headers();
  const rawHeaders = adapter.getHeaders(request);

  Object.entries(rawHeaders).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => v && headers.append(key, v));
    } else if (value) {
      headers.append(key, value);
    }
  });

  const method = adapter.getMethod(request);
  const contentType = headers.get('content-type');

  let body: BodyInit | undefined;

  if (!/GET|HEAD/.test(method)) {
    const rawBody = adapter.getBody(request);

    if (rawBody !== undefined && rawBody !== null) {
      if (contentType?.includes('application/x-www-form-urlencoded')) {
        body = qs.stringify(rawBody, { arrayFormat: 'repeat' });
      } else if (contentType?.includes('application/json')) {
        body = JSON.stringify(rawBody);
      } else if (typeof rawBody === 'string') {
        body = rawBody;
      } else if (Buffer.isBuffer(rawBody)) {
        body = rawBody;
      } else if (typeof rawBody === 'object') {
        // Fallback for object bodies without a proper content-type, which can
        // occur in certain scenarios (e.g., CSRF token submission).
        body = qs.stringify(rawBody, { arrayFormat: 'repeat' });
      }
    }
  }

  return new Request(url, {
    method,
    headers,
    body
  });
}

/**
 * Maps a standard Web API `Response` object to a framework-specific
 * response object (Fastify `FastifyReply` or Express `ExpressResponse`).
 * This allows a common handler to return a standard response, which is then
 * translated back into the native format of the running server.
 *
 * This function efficiently processes headers, paying special attention to
 * the `set-cookie` header, which can appear multiple times. It groups these
 * headers into an array to ensure all cookies are set correctly. The
 * response body is streamed as text. The function is `async` because
 * reading the body of a `Response` is an asynchronous operation.
 *
 * @param webResponse The standard Web API `Response` object that needs to be
 * sent to the client. This is typically the output of a core process.
 * @param res The target Fastify or Express response object, which will be
 * mutated by this function to send the final HTTP response.
 * @param adapter An `HttpAdapter` that provides methods to set the status,
 * headers, and send the body on the framework-specific response object.
 * @returns A `Promise<void>` that resolves once the response has been
 * fully sent to the client.
 */
export async function toHttpResponse(
  webResponse: Response,
  res: FastifyReply | ExpressResponse,
  adapter: HttpAdapter<unknown, unknown>
): Promise<void> {
  const groupedHeaders = Array.from(webResponse.headers.entries()).reduce(
    (acc, [key, value]) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'set-cookie') {
        acc[lowerKey] = [...(acc[lowerKey] || []), value];
      } else {
        acc[key] = value;
      }
      return acc;
    },
    {} as Record<string, string | string[]>
  );

  Object.entries(groupedHeaders).forEach(([key, value]) => {
    adapter.setHeader(res, key, value);
  });

  adapter.setStatus(res, webResponse.status);
  adapter.send(res, await webResponse.text());
}
