import {
  InjectionToken,
  ModuleMetadata,
  OptionalFactoryDependency,
  Type
} from '@nestjs/common';
import type { AuthConfig } from '@auth/core';
import type { Adapter } from '@auth/core/adapters';
import type { Provider as AuthProvider } from '@auth/core/providers';

/**
 * Configuration options for the Auth.js module. Extends core AuthConfig
 * while providing NestJS-specific options for session management and
 * request handling.
 */
export interface IAuthModuleOptions extends Omit<AuthConfig, 'raw'> {
  readonly defaultStrategy?: string | readonly string[];
  readonly session?: {
    strategy?: 'jwt' | 'database';
    maxAge?: number;
    updateAge?: number;
    generateSessionToken?: () => string;
  };
  readonly property?: string;
  readonly basePath?: string;
  readonly trustHost?: boolean;
  readonly adapter?: Adapter;
}

/**
 * Factory interface for creating Auth.js module options asynchronously.
 * Implement this interface to provide dynamic configuration based on
 * external services or runtime values.
 */
export interface AuthOptionsFactory {
  createAuthOptions(): Promise<IAuthModuleOptions> | IAuthModuleOptions;
}

/**
 * Asynchronous configuration options for the Auth.js module. Supports
 * multiple patterns for dependency injection and dynamic configuration.
 */
export interface AuthModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  readonly useExisting?: Type<AuthOptionsFactory>;
  readonly useClass?: Type<AuthOptionsFactory>;
  readonly useFactory?: (
    ...args: readonly unknown[]
  ) => Promise<IAuthModuleOptions> | IAuthModuleOptions;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

/**
 * Injectable class containing Auth.js module configuration. This class
 * is provided as a token for dependency injection throughout the module.
 */
export class AuthModuleOptions implements IAuthModuleOptions {
  readonly defaultStrategy?: string | readonly string[];
  readonly session?: {
    strategy?: 'jwt' | 'database';
    maxAge?: number;
    updateAge?: number;
    generateSessionToken?: () => string;
  };
  readonly property?: string;
  readonly basePath?: string;
  readonly providers: AuthProvider[] = [];
  readonly secret?: string;
  readonly trustHost?: boolean;
  readonly adapter?: Adapter;
}
