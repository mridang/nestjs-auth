import { HttpAdapterHost } from '@nestjs/core';
import { HttpAdapter } from '../adapters/http.adapter.js';
import { ExpressAdapter } from '../adapters/express.adapter.js';
import { FastifyAdapter } from '../adapters/fastify.adapter.js';

/**
 * Factory to create the appropriate HTTP adapter based on the
 * underlying HTTP server being used.
 */
export class AdapterFactory {
  static create(adapterHost: HttpAdapterHost): HttpAdapter<unknown, unknown> {
    const kind = adapterHost.httpAdapter.getType();

    switch (kind) {
      case 'express':
        return new ExpressAdapter();
      case 'fastify':
        return new FastifyAdapter();
      default:
        throw new Error(`Unsupported HTTP adapter: ${kind}`);
    }
  }
}
