import {
  CanActivate,
  ExecutionContext,
  Inject,
  Logger,
  mixin,
  Optional,
  Type,
  UnauthorizedException
} from '@nestjs/common';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import { Auth, createActionURL, setEnvDefaults } from '@auth/core';
import type {
  Session as CoreSession,
  User as CoreUser
} from '@auth/core/types';
import memoize from 'memoize';
import { HttpAdapter } from './adapters/http.adapter.js';
import { AdapterFactory } from './utils/adapter.factory.js';
import { defaultOptions } from './options.js';
import type { IAuthModuleOptions } from './auth-module.options.js';
import { AuthModuleOptions } from './auth-module.options.js';
import { IS_PUBLIC_KEY } from './auth.decorators.js';
import { AuthenticatedRequest } from './types.js';
import { AuthSession as AuthSessionClass } from './auth.session.js';

export type IAuthGuard = CanActivate & {
  handleRequest<TUser = CoreUser>(
    err: Error | null,
    user: TUser | null,
    info: unknown,
    context: ExecutionContext
  ): TUser;
  getAuthenticateOptions(
    context: ExecutionContext
  ): IAuthModuleOptions | undefined;
  getRequest(context: ExecutionContext): unknown;
};

const NO_STRATEGY_ERROR = 'Auth.js module must be imported to use AuthGuard';
const authLogger = new Logger('AuthGuard');

function createAuthGuard(type?: string | readonly string[]): Type<IAuthGuard> {
  class MixinAuthGuard implements CanActivate {
    private httpAdapter?: HttpAdapter<unknown, unknown>;

    /**
     * Initializes the guard with dependencies.
     * @param reflector The `Reflector` for reading metadata.
     * @param options The module options provided at initialization.
     * @param adapterHost The host for the underlying HTTP adapter.
     */
    constructor(
      private readonly reflector: Reflector,
      @Optional()
      @Inject(AuthModuleOptions)
      protected readonly options?: AuthModuleOptions,
      @Optional()
      @Inject(HttpAdapterHost)
      private readonly adapterHost?: HttpAdapterHost
    ) {
      if (!this.options && !type) {
        authLogger.error(NO_STRATEGY_ERROR);
      }
    }

    /**
     * Determines if a route can be activated by verifying the user's session.
     * This method serves as the main entry point for the guard and delegates
     * to a public or protected route handler based on decorator metadata.
     * @param context The NestJS `ExecutionContext` for the current request.
     * @returns A `Promise<boolean>` that is always `true` on successful execution.
     * Access control is handled by throwing exceptions on failure.
     * @throws {UnauthorizedException} If a protected route is accessed without a valid session.
     */
    async canActivate(context: ExecutionContext): Promise<boolean> {
      if (context.getType() !== 'http') {
        return true;
      }

      const isPublic = this.reflector.getAllAndOverride<boolean>(
        IS_PUBLIC_KEY,
        [context.getHandler(), context.getClass()]
      );

      if (isPublic) {
        return this.handlePublicRoute(context);
      } else {
        return this.handleProtectedRoute(context);
      }
    }

    /**
     * Retrieves the framework-native request object from the execution context.
     * @param context The `ExecutionContext` for the current request.
     * @returns The request object, typed as `AuthenticatedRequest`.
     */
    getRequest(context: ExecutionContext): AuthenticatedRequest {
      return this.getOrCreateAdapter().getRequest(context);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Retrieves the framework-native response object from the execution context.
     * @param context The `ExecutionContext` for the current request.
     * @returns The raw response object.
     */
    getResponse<T = unknown>(context: ExecutionContext): T {
      return this.getOrCreateAdapter().getResponse(context) as T;
    }

    /**
     * Handles the result of an authentication attempt. It is responsible for
     * throwing an exception if authentication fails or the user is not found.
     * @param err An error object if an exception occurred.
     * @param user The user object from the session if successful.
     * @returns The validated `CoreUser` object.
     * @throws {UnauthorizedException} If `err` is present or `user` is null.
     */
    handleRequest(err: Error | null, user: CoreUser | null): CoreUser {
      if (err) {
        authLogger.error(`Authentication error: ${err.message}`);
      }
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      if (err) {
        throw new UnauthorizedException(err.message);
      }
      if (!user) {
        throw new UnauthorizedException('No user found in session');
      }
      return user;
    }

    /**
     * A hook to retrieve strategy-specific options for an authentication attempt.
     * Can be overridden in a child class to provide dynamic options.
     * @param _context The `ExecutionContext` for the current request.
     * @returns `IAuthModuleOptions` or `undefined`.
     */
    getAuthenticateOptions(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _context: ExecutionContext
    ): IAuthModuleOptions | undefined | Promise<IAuthModuleOptions> {
      return undefined;
    }

    /**
     * Lazily creates and retrieves the appropriate HTTP adapter (Express or Fastify).
     * @returns The singleton instance of the `HttpAdapter`.
     */
    private getOrCreateAdapter(): HttpAdapter<unknown, unknown> {
      if (!this.httpAdapter) {
        if (!this.adapterHost?.httpAdapter) {
          throw new Error(
            'No HTTP adapter found. Ensure app.init() is called.'
          );
        }
        this.httpAdapter = AdapterFactory.create(this.adapterHost);
      }
      return this.httpAdapter;
    }

    /**
     * Processes requests for routes marked as public.
     * This method ensures that public routes are always accessible. It will
     * attempt to retrieve the current session and attach it to the request
     * for optional use, but will never throw an error.
     * @param context The `ExecutionContext` for the current request.
     * @returns A promise that always resolves to `true`, granting access.
     */
    private async handlePublicRoute(
      context: ExecutionContext
    ): Promise<boolean> {
      const request = this.getRequest(context);
      const mergedOptions = {
        providers: [],
        ...defaultOptions,
        ...this.options,
        ...(await this.getAuthenticateOptions(context))
      };

      const [coreSession] = await this.getSessionOrError(
        request,
        mergedOptions
      );
      const publicSession =
        AuthSessionClass.fromCore(coreSession)?.toJSON() ?? null;

      const property = mergedOptions.property ?? defaultOptions.property;

      Object.assign(request, {
        // keep core session on the request to match AuthenticatedRequest
        session: coreSession,
        // expose user from the mapped public session
        [property]: publicSession?.user ?? null
      });

      return true;
    }

    /**
     * Processes requests for routes that are protected (not public).
     * This method enforces authentication by requiring a valid session. It throws an
     * `UnauthorizedException` if authentication fails.
     * @param context The `ExecutionContext` for the current request.
     * @returns A promise that always resolves to `true`, as access denial is
     * handled by throwing an exception.
     * @throws {UnauthorizedException} If authentication fails.
     */
    private async handleProtectedRoute(
      context: ExecutionContext
    ): Promise<boolean> {
      const request = this.getRequest(context);
      const mergedOptions = {
        providers: [],
        ...defaultOptions,
        ...this.options,
        ...(await this.getAuthenticateOptions(context))
      };

      const [coreSession, error] = await this.getSessionOrError(
        request,
        mergedOptions
      );

      const publicSession =
        AuthSessionClass.fromCore(coreSession)?.toJSON() ?? null;

      const user = this.handleRequest(error, publicSession?.user ?? null);

      const property = mergedOptions.property ?? defaultOptions.property;

      Object.assign(request, {
        session: coreSession,
        [property]: user
      });

      return true;
    }

    /**
     * A functional wrapper around `getSession` to handle errors without a `try/catch`
     * block at the call site.
     * @param request The framework-native request object.
     * @param options The merged Auth.js options.
     * @returns A promise resolving to a tuple of `[Session | null, Error | null]`.
     */
    private async getSessionOrError(
      request: unknown,
      options: IAuthModuleOptions
    ): Promise<[CoreSession | null, Error | null]> {
      try {
        const session = await this.getSession(request, options);
        return [session, null];
      } catch (err) {
        return [null, err instanceof Error ? err : new Error(String(err))];
      }
    }

    /**
     * The core method to retrieve a session by calling the `Auth` function from `@auth/core`.
     * @param request The framework-native request object.
     * @param options The merged Auth.js options.
     * @returns A promise resolving to the `Session` object or `null`.
     */
    private async getSession(
      request: unknown,
      options: IAuthModuleOptions
    ): Promise<CoreSession | null> {
      const adapter = this.getOrCreateAdapter();
      if (!options.providers?.length) {
        throw new Error('No authentication providers configured');
      }
      if (!options.secret && process.env.NODE_ENV === 'production') {
        throw new Error('AUTH_SECRET is required in production');
      }
      setEnvDefaults(process.env, options);

      const protocol = adapter.getProtocol(request);
      const host = adapter.getHost(request);
      const headers = adapter.getHeaders(request);
      const url = createActionURL(
        'session',
        protocol,
        new Headers({
          host,
          'x-forwarded-host': (headers['x-forwarded-host'] as string) ?? host,
          'x-forwarded-proto':
            (headers['x-forwarded-proto'] as string) ?? protocol
        }),
        process.env,
        options
      );
      const cookieHeader = adapter.getCookie(request) ?? '';
      const response = await Auth(
        new Request(url, { headers: { cookie: cookieHeader } }),
        options
      );
      if (!response.ok) {
        return null;
      }
      try {
        return (await response.json()) as CoreSession;
      } catch {
        return null;
      }
    }
  }

  const GuardType = mixin(MixinAuthGuard);
  return GuardType as Type<IAuthGuard>;
}

/**
 * Exported guard factory using `memoize` from npm
 */
export const AuthGuard = memoize(createAuthGuard) as (
  type?: string | readonly string[]
) => Type<IAuthGuard>;
