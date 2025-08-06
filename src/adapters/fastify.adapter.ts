import type { ExecutionContext } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { HttpAdapter } from './http.adapter.js';
import type { AuthenticatedRequest } from '../types.js';

/**
 * Fastify adapter for NestJS Auth.js module.
 */
export class FastifyAdapter extends HttpAdapter<FastifyRequest, FastifyReply> {
  getRequest(context: ExecutionContext): AuthenticatedRequest {
    return context
      .switchToHttp()
      .getRequest<FastifyRequest>() as unknown as AuthenticatedRequest;
  }

  getResponse(context: ExecutionContext): FastifyReply {
    return context.switchToHttp().getResponse<FastifyReply>();
  }

  getProtocol(request: FastifyRequest): string {
    return request.protocol;
  }

  getHost(request: FastifyRequest): string {
    return request.hostname;
  }

  getUrl(request: FastifyRequest): string {
    return request.url;
  }

  getMethod(request: FastifyRequest): string {
    return request.method;
  }

  getHeaders(
    request: FastifyRequest
  ): Record<string, string | string[] | undefined> {
    return request.headers;
  }

  getCookie(request: FastifyRequest): string | undefined {
    return request.headers.cookie;
  }

  getBody(request: FastifyRequest): unknown {
    return request.body;
  }

  setHeader(
    response: FastifyReply,
    name: string,
    value: string | string[]
  ): void {
    response.header(name, value);
  }

  setStatus(response: FastifyReply, code: number): void {
    response.status(code);
  }

  send(response: FastifyReply, body: string): void {
    response.send(body);
  }
}
