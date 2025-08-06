import type { ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../types.js';

/**
 * An abstract class that defines a standardized interface for interacting with
 * different underlying HTTP server frameworks (e.g., Express, Fastify). This
 * adapter allows for framework-agnostic logic by providing a consistent API
 * to access request and response objects.
 *
 * @template TRequest The type of the framework-specific request object.
 * @template TResponse The type of the framework-specific response object.
 */
export abstract class HttpAdapter<TRequest, TResponse> {
  /**
   * Extracts the native HTTP request object from the NestJS execution context.
   * The request is intersected with AuthenticatedRequest to ensure user
   * details are available.
   * @param context The NestJS execution context.
   * @returns The framework-specific request object.
   */
  abstract getRequest(context: ExecutionContext): AuthenticatedRequest;

  /**
   * Extracts the native HTTP response object from the NestJS execution context.
   * @param context The NestJS execution context.
   * @returns The framework-specific response object.
   */
  abstract getResponse(context: ExecutionContext): TResponse;

  /**
   * Retrieves the request protocol ('http' or 'https').
   * @param request The framework-specific request object.
   * @returns The protocol as a string.
   */
  abstract getProtocol(request: TRequest): string;

  /**
   * Retrieves the host name from the request.
   * @param request The framework-specific request object.
   * @returns The host name as a string.
   */
  abstract getHost(request: TRequest): string;

  /**
   * Retrieves the URL from the request.
   * @param request The framework-specific request object.
   * @returns The URL as a string.
   */
  abstract getUrl(request: TRequest): string;

  /**
   * Retrieves the HTTP method from the request (e.g., 'GET', 'POST').
   * @param request The framework-specific request object.
   * @returns The HTTP method as a string.
   */
  abstract getMethod(request: TRequest): string;

  /**
   * Retrieves all headers from the request.
   * @param request The framework-specific request object.
   * @returns A record of header names and their values.
   */
  abstract getHeaders(
    request: TRequest
  ): Record<string, string | string[] | undefined>;

  /**
   * Retrieves the raw 'cookie' header string from the request.
   * @param request The framework-specific request object.
   * @returns The cookie string, or undefined if not present.
   */
  abstract getCookie(request: TRequest): string | undefined;

  /**
   * Retrieves the body from the request.
   * @param request The framework-specific request object.
   * @returns The request body.
   */
  abstract getBody(request: TRequest): unknown;

  /**
   * Sets a header on the response.
   * @param response The framework-specific response object.
   * @param name The name of the header.
   * @param value The value of the header.
   */
  abstract setHeader(
    response: TResponse,
    name: string,
    value: string | string[]
  ): void;

  /**
   * Sets the HTTP status code on the response.
   * @param response The framework-specific response object.
   * @param code The HTTP status code.
   */
  abstract setStatus(response: TResponse, code: number): void;

  /**
   * Sends the final response to the client.
   * @param response The framework-specific response object.
   * @param body The response body to send as a string.
   */
  abstract send(response: TResponse, body: string): void;
}
