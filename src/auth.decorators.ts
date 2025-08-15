import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Session } from './types.js';
import { AuthSession as AuthSessionClass } from './auth.session.js';

export const IS_PUBLIC_KEY = Symbol('isPublic');
export const REQUIRED_ROLES_KEY = Symbol('requiredRoles');

/**
 * Marks a route as publicly accessible, bypassing authentication requirements.
 *
 * Routes decorated with `@Public()` will not require a valid session and will
 * be accessible to unauthenticated users. This decorator should be used sparingly
 * and only for endpoints that genuinely need to be public (e.g., login, health checks).
 *
 * @example
 * ```ts
 * @Controller('auth')
 * export class AuthController {
 *   @Get('login')
 *   @Public()
 *   getLoginPage() {
 *     return { message: 'Login page' };
 *   }
 * }
 * ```
 *
 * @returns A method decorator that sets the 'isPublic' metadata to true
 */
export const Public = (): ClassDecorator & MethodDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Restricts route access to users with specific roles.
 *
 * Users must have at least one of the specified roles to access the decorated route.
 * The roles are checked against the user's roles array in their session. If the user
 * has no roles or none of the required roles, access will be denied.
 *
 * @param roles - One or more role names that are allowed to access this route
 *
 * @example
 * ```ts
 * @Controller('admin')
 * export class AdminController {
 *   @Get('users')
 *   @RequireRoles('admin', 'moderator')
 *   getUsers() {
 *     return { users: [] };
 *   }
 *
 *   @Delete('user/:id')
 *   @RequireRoles('admin')
 *   deleteUser(@Param('id') id: string) {
 *     // Only admin role can delete users
 *   }
 * }
 * ```
 *
 * @returns A method decorator that sets the 'requiredRoles' metadata
 */
export const RequireRoles = (...roles: readonly string[]): MethodDecorator =>
  SetMetadata(REQUIRED_ROLES_KEY, roles);

/**
 * Injects the current Auth.js session into the route handler parameter.
 *
 * This decorator extracts the session object from the request and injects it
 * as a parameter into your route handler. The session contains user information,
 * expiration data, and other Auth.js session properties.
 *
 * Returns `null` if no valid session exists (user is not authenticated).
 * Access the user data via `session.user` and session metadata via other properties.
 *
 * @param data - Optional data parameter (not used in this implementation)
 * @param ctx - The execution context provided by NestJS
 *
 * @example
 * ```ts
 * @Controller('profile')
 * export class ProfileController {
 *   @Get('me')
 *   getCurrentUser(@AuthSession() session: Session | null) {
 *     if (!session) {
 *       throw new UnauthorizedException('Not authenticated');
 *     }
 *
 *     return {
 *       user: session.user,
 *       expires: session.expires,
 *       // Access other session properties as needed
 *     };
 *   }
 *
 *   @Get('dashboard')
 *   getDashboard(@AuthSession() session: Session | null) {
 *     const user = session?.user;
 *     if (!user) {
 *       throw new UnauthorizedException();
 *     }
 *
 *     return {
 *       welcome: `Hello, ${user.name}!`,
 *       email: user.email,
 *       roles: user.roles || []
 *     };
 *   }
 * }
 * ```
 *
 * @returns The current session object or null if no session exists
 */
export const AuthSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Session | null => {
    const request = ctx
      .switchToHttp()
      .getRequest<unknown & { session?: unknown }>();
    return (
      AuthSessionClass.fromCore(
        request.session as unknown as import('@auth/core/types').Session | null,
      )?.toJSON() ?? null
    );
  },
);
