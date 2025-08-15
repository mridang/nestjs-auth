import type { ExecutionContext } from '@nestjs/common';
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { HttpAdapter } from './http.adapter.js';
import type { AuthenticatedRequest } from '../types.js';
import { Readable } from 'node:stream';

/**
 * Express adapter for NestJS Auth.js module.
 */
export class ExpressAdapter extends HttpAdapter<
  ExpressRequest,
  ExpressResponse
> {
  getRequest(context: ExecutionContext): AuthenticatedRequest {
    return context
      .switchToHttp()
      .getRequest<ExpressRequest>() as unknown as AuthenticatedRequest;
  }

  getResponse(context: ExecutionContext): ExpressResponse {
    return context.switchToHttp().getResponse<ExpressResponse>();
  }

  getProtocol(request: ExpressRequest): string {
    return request.protocol;
  }

  getHost(request: ExpressRequest): string {
    return request.get('host') ?? 'localhost';
  }

  getUrl(request: ExpressRequest): string {
    return request.originalUrl;
  }

  getMethod(request: ExpressRequest): string {
    return request.method;
  }

  getHeaders(
    request: ExpressRequest,
  ): Record<string, string | string[] | undefined> {
    return request.headers;
  }

  getCookie(request: ExpressRequest): string | undefined {
    return request.headers.cookie;
  }

  getBody(request: ExpressRequest): unknown {
    return request.body;
  }

  setHeader(
    response: ExpressResponse,
    name: string,
    value: string | string[],
  ): void {
    response.setHeader(name, value);
  }

  setStatus(response: ExpressResponse, code: number): void {
    response.status(code);
  }

  send(response: ExpressResponse, body: string | Buffer | Readable): void {
    if (typeof body === 'string' || Buffer.isBuffer(body)) {
      response.send(body);
    } else {
      body.pipe(response);
    }
  }
}
