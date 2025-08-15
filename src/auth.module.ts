import { DynamicModule, Module, Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModuleOptions } from './auth-module.options.js';
import type {
  AuthModuleAsyncOptions,
  AuthOptionsFactory,
  IAuthModuleOptions,
} from './auth-module.options.js';
import { AuthMiddleware } from './auth.middleware.js';
import { AuthGuard } from './auth.guards.js';
import { RolesGuard } from './roles.guard.js';
import { AuthController } from './auth.controller.js';

/**
 * Configuration options for Auth.js module registration
 */
export interface AuthModuleConfig {
  /**
   * Whether to register a global authentication guard.
   * When true, all routes require authentication by default.
   * Use @Public() decorator to bypass authentication.
   * @default true
   */
  globalGuard?: boolean;

  /**
   * Whether to register global roles guard.
   * When true, role-based authorization is enforced globally.
   * @default true
   */
  rolesGuard?: boolean;

  /**
   * Base path for Auth.js routes
   * @default '/auth'
   */
  basePath?: string;
}

/**
 * Main Auth.js module for NestJS applications. Provides authentication
 * infrastructure using Auth.js core with NestJS patterns and conventions.
 *
 * This module automatically registers:
 * - Auth.js routes (/auth/signin, /auth/callback, etc.)
 * - Global authentication guard (optional)
 * - Global authorization guard (optional)
 * - Session management middleware
 *
 * @example
 * **Basic Setup (Recommended)**
 * ```ts
 * @Module({
 *   imports: [
 *     AuthModule.register({
 *       providers: [
 *         GoogleProvider({
 *           clientId: process.env.GOOGLE_CLIENT_ID,
 *           clientSecret: process.env.GOOGLE_CLIENT_SECRET,
 *         })
 *       ],
 *       secret: process.env.AUTH_SECRET,
 *       trustHost: true
 *     })
 *   ]
 * })
 * export class AppModule {}
 * ```
 *
 * @example
 * **Custom Configuration**
 * ```ts
 * @Module({
 *   imports: [
 *     AuthModule.register({
 *       providers: [GoogleProvider(...)],
 *       secret: process.env.AUTH_SECRET,
 *       trustHost: true
 *     }, {
 *       globalGuard: true, // Require auth by default
 *       rolesGuard: true, // Enable role-based access
 *       basePath: '/auth' // Auth routes a base path
 *     })
 *   ]
 * })
 * export class AppModule {}
 * ```
 *
 * @example
 * **Using in Controllers**
 * ```ts
 * @Controller('api')
 * export class ApiController {
 *   @Get('public')
 *   @Public() // Bypass authentication
 *   getPublicData() {
 *     return { message: 'Public endpoint' };
 *   }
 *
 *   @Get('profile')
 *   // Authenticated by default (global guard)
 *   getProfile(@AuthSession() session: Session | null) {
 *     return { user: session?.user };
 *   }
 *
 *   @Get('admin')
 *   @RequireRoles('admin') // Role-based access
 *   getAdminData(@AuthSession() session: Session | null) {
 *     return { adminData: true };
 *   }
 * }
 * ```
 */
@Module({})
export class AuthModule {
  /**
   * Register the Auth.js module with static configuration options.
   *
   * @param options - Static configuration options for Auth.js
   * @param config - Module configuration options
   * @returns A configured dynamic module
   */
  static register(
    options: IAuthModuleOptions,
    config: AuthModuleConfig = {},
  ): DynamicModule {
    return this.registerAsync(
      {
        useFactory: () => options,
      },
      config,
    );
  }

  /**
   * Register the Auth.js module with dynamic configuration options.
   *
   * @param options - Async configuration options for Auth.js
   * @param config - Module configuration options
   * @returns A configured dynamic module with async providers
   */
  static registerAsync(
    options: AuthModuleAsyncOptions,
    config: AuthModuleConfig = {},
  ): DynamicModule {
    const asyncProviders = this.createAsyncProviders(options);
    const guardProviders = this.createGuardProviders(config);

    return {
      module: AuthModule,
      imports: options.imports ?? [],
      controllers: [AuthController],
      providers: [...asyncProviders, ...guardProviders],
      exports: [AuthModuleOptions],
    };
  }

  /**
   * Creates guard providers based on configuration
   */
  private static createGuardProviders(config: AuthModuleConfig): Provider[] {
    const providers: Provider[] = [];

    // Global authentication guard
    if (config.globalGuard !== false) {
      providers.push({
        provide: APP_GUARD,
        useClass: AuthGuard(),
      });
    }

    // Global roles guard
    if (config.rolesGuard !== false) {
      providers.push({
        provide: APP_GUARD,
        useClass: RolesGuard,
      });
    }

    return providers;
  }

  /**
   * Creates providers for async registration
   */
  private static createAsyncProviders(
    options: AuthModuleAsyncOptions,
  ): readonly Provider[] {
    const baseProviders: Provider[] = [AuthMiddleware];

    if (options.useExisting || options.useFactory) {
      return [...baseProviders, this.createAsyncOptionsProvider(options)];
    }

    if (!options.useClass) {
      throw new Error(
        'Invalid Auth.js module async options. Must provide one of: useFactory, useClass, or useExisting',
      );
    }

    return [
      ...baseProviders,
      this.createAsyncOptionsProvider(options),
      {
        provide: options.useClass,
        useClass: options.useClass,
      },
    ];
  }

  /**
   * Creates the option provider for async configuration
   */
  private static createAsyncOptionsProvider(
    options: AuthModuleAsyncOptions,
  ): Provider {
    if (options.useFactory) {
      return {
        provide: AuthModuleOptions,
        useFactory: options.useFactory,
        inject: [...(options.inject ?? [])],
      };
    }

    const inject = options.useExisting ?? options.useClass;
    if (!inject) {
      throw new Error(
        'Invalid Auth.js module async options. useClass or useExisting must be provided',
      );
    }

    return {
      provide: AuthModuleOptions,
      useFactory: async (optionsFactory: AuthOptionsFactory) =>
        await optionsFactory.createAuthOptions(),
      inject: [inject],
    };
  }
}
