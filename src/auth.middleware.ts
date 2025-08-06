import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Auth, setEnvDefaults } from '@auth/core';
import { toHttpResponse, toWebRequest } from './utils/http-adapters.js';
import { AdapterFactory } from './utils/adapter.factory.js';
import { HttpAdapter } from './adapters/http.adapter.js';
import { AuthModuleOptions } from './auth-module.options.js';
import type { IAuthModuleOptions } from './auth-module.options.js';
import type {
  Request as ExpressRequest,
  Response as ExpressResponse
} from 'express';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Middleware that intercepts requests to Auth.js routes and processes
 * them through Auth.js core. Handles all authentication flows including
 * sign-in, sign-out, callbacks, and session management.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private httpAdapter?: HttpAdapter<unknown, unknown>;

  constructor(
    @Inject(AuthModuleOptions)
    private readonly options: IAuthModuleOptions,
    @Inject(HttpAdapterHost)
    private readonly adapterHost: HttpAdapterHost
  ) {}

  async use(
    req: FastifyRequest | ExpressRequest,
    res: FastifyReply | ExpressResponse,
    next: (error?: unknown) => void
  ): Promise<void> {
    if (!this.httpAdapter) {
      this.httpAdapter = AdapterFactory.create(this.adapterHost);
    }

    const config = { ...this.options };
    setEnvDefaults(process.env, config);

    try {
      const webRequest = toWebRequest(req, this.httpAdapter);
      const webResponse = await Auth(webRequest, config);
      await toHttpResponse(webResponse, res, this.httpAdapter);
      next();
    } catch (error) {
      next(error);
    }
  }
}
