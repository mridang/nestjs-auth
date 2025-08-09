import { All, Controller, Next, Req, Res } from '@nestjs/common';
import { AuthMiddleware } from './auth.middleware.js';
import { Public } from './auth.decorators.js';
import type {
  Request as ExpressRequest,
  Response as ExpressResponse
} from 'express';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Controller that handles all Auth.js routes.
 * Delegates all requests to AuthMiddleware for processing.
 */
@Controller('auth')
@Public()
export class AuthController {
  constructor(private readonly authMiddleware: AuthMiddleware) {
    //
  }

  /**
   * Handles all Auth.js routes including
   * - GET/POST /auth/signin
   * - GET /auth/callback/:provider
   * - POST /auth/signout
   * - GET /auth/session
   * - etc.
   */
  @All('*path')
  async handleAuthRoutes(
    @Req() req: ExpressRequest | FastifyRequest,
    @Res() res: ExpressResponse | FastifyReply,
    @Next() next: () => void
  ): Promise<void> {
    return this.authMiddleware.use(req, res, next);
  }
}
