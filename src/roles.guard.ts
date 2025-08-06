import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request as ExpressRequest } from 'express';
import type { Session } from './types.js';

// Import the symbol from decorators
import { REQUIRED_ROLES_KEY } from './auth.decorators.js';

/**
 * Guard that enforces role-based access control. Works in conjunction
 * with the @RequireRoles() decorator to restrict access to routes based on
 * user roles stored in the session.
 *
 * @example
 * ```ts
 * @Controller('admin')
 * @UseGuards(RolesGuard)
 * export class AdminController {
 *   @Get('users')
 *   @RequireRoles('admin', 'moderator')
 *   getUsers() {
 *     // Only users with 'admin' or 'moderator' roles can access
 *   }
 * }
 * ```
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {
    //
  }

  /**
   * Determines if the current request should be allowed based on user roles.
   *
   * @param context - The execution context containing request and handler info
   * @returns true if access should be granted, false otherwise
   */
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );

    // If no roles are required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<
        ExpressRequest & { user?: Session['user'] & { roles?: string[] } }
      >();

    const userRoles = request.user?.roles ?? [];

    // User must have at least one of the required roles
    return requiredRoles.some((role) => userRoles.includes(role));
  }
}
