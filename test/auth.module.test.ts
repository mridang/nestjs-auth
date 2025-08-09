import { Test, TestingModule } from '@nestjs/testing';
import type { FactoryProvider, Provider, Type } from '@nestjs/common';
import { Injectable, Module } from '@nestjs/common';
import { APP_GUARD, HttpAdapterHost } from '@nestjs/core';
// noinspection ES6PreferShortImport
import { AuthModule } from '../src/auth.module.js';
// noinspection ES6PreferShortImport
import type {
  AuthModuleAsyncOptions,
  AuthOptionsFactory,
  IAuthModuleOptions
} from '../src/auth-module.options.js';
// noinspection ES6PreferShortImport
import { AuthModuleOptions } from '../src/auth-module.options.js';
// noinspection ES6PreferShortImport
import { AuthController } from '../src/auth.controller.js';

/* -------------------------- helpers / type guards ------------------------- */

type InjectionToken = string | symbol | Type<unknown>;

function isObjectRecord(v: unknown): v is Record<PropertyKey, unknown> {
  return typeof v === 'object' && v !== null;
}

function hasProvide(
  p: unknown,
  token?: InjectionToken
): p is { provide: InjectionToken } {
  return (
    isObjectRecord(p) &&
    'provide' in p &&
    (token === undefined ||
      (p as { provide: InjectionToken }).provide === token)
  );
}

function isFactoryProvider<T = unknown>(p: unknown): p is FactoryProvider<T> {
  return (
    isObjectRecord(p) &&
    typeof (p as { useFactory?: unknown }).useFactory === 'function'
  );
}

function findProvider(
  providers: readonly Provider[] | undefined,
  token: InjectionToken
): (Provider & { provide: InjectionToken }) | undefined {
  return providers?.find((p): p is Provider & { provide: InjectionToken } =>
    hasProvide(p, token)
  );
}

/** Minimal shape for your OAuth provider assertions in tests */
interface OAuthProvider {
  id: string;
  name: string;
  type: 'oauth';
  clientId: string;
  clientSecret: string;
}

function isOAuthProvider(v: unknown): v is OAuthProvider {
  return (
    isObjectRecord(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    v.type === 'oauth' &&
    typeof v.clientId === 'string' &&
    typeof v.clientSecret === 'string'
  );
}

/* --------------------------------- mocks ---------------------------------- */

// Mock HttpAdapterHost for testing
class MockHttpAdapterHost {
  // noinspection JSUnusedGlobalSymbols
  httpAdapter = {
    constructor: { name: 'ExpressAdapter' }
  };
}

// Mock configuration service for testing
@Injectable()
class MockConfigService {
  private readonly config = {
    AUTH_SECRET: 'test-secret',
    GOOGLE_CLIENT_ID: 'test-client-id',
    GOOGLE_CLIENT_SECRET: 'test-client-secret'
  };

  get(key: string): string {
    return this.config[key as keyof typeof this.config];
  }
}

// Mock Auth.js options factory for testing
@Injectable()
class MockAuthConfigService implements AuthOptionsFactory {
  constructor(private readonly configService: MockConfigService) {}

  createAuthOptions(): IAuthModuleOptions {
    return {
      providers: [
        {
          id: 'google',
          name: 'Google',
          type: 'oauth',
          clientId: this.configService.get('GOOGLE_CLIENT_ID'),
          clientSecret: this.configService.get('GOOGLE_CLIENT_SECRET')
        }
      ],
      secret: this.configService.get('AUTH_SECRET'),
      trustHost: true,
      pages: {
        signIn: '/auth/signin'
      }
    };
  }
}

// Test module that provides MockConfigService
@Module({
  providers: [MockConfigService],
  exports: [MockConfigService]
})
class MockProviderModule {}

// Test module for useExisting pattern
@Module({
  imports: [MockProviderModule],
  providers: [MockAuthConfigService],
  exports: [MockAuthConfigService]
})
class MockConfigModule {}

describe('AuthModule', () => {
  describe('register (synchronous)', () => {
    test('should create module with static configuration', async () => {
      const staticOptions: IAuthModuleOptions = {
        providers: [
          {
            id: 'github',
            name: 'GitHub',
            type: 'oauth',
            clientId: 'github-client-id',
            clientSecret: 'github-client-secret'
          }
        ],
        secret: 'static-secret',
        trustHost: true,
        pages: {
          signIn: '/login'
        }
      };

      const dynamicModule = AuthModule.register(staticOptions);

      expect(dynamicModule.module).toBe(AuthModule);
      expect(dynamicModule.controllers).toEqual([AuthController]);
      expect(dynamicModule.exports).toEqual([AuthModuleOptions]);

      // Find the options provider and check for a 'useFactory' property
      const optionsProvider = findProvider(
        dynamicModule.providers,
        AuthModuleOptions
      );
      expect(optionsProvider).toBeDefined();
      expect(isFactoryProvider<IAuthModuleOptions>(optionsProvider)).toBe(true);

      // Check the result of the factory
      const factory = (optionsProvider as FactoryProvider<IAuthModuleOptions>)
        .useFactory!;
      const factoryResult = await factory();
      expect(factoryResult).toEqual(staticOptions);
    });

    test('should configure global guards by default', () => {
      const staticOptions: IAuthModuleOptions = {
        providers: [],
        secret: 'test-secret',
        trustHost: true
      };

      const dynamicModule = AuthModule.register(staticOptions);

      const guardProviders =
        dynamicModule.providers?.filter((p) => hasProvide(p, APP_GUARD)) ?? [];

      expect(guardProviders).toHaveLength(2); // Auth guard + Roles guard
    });

    test('should allow disabling global guards', () => {
      const staticOptions: IAuthModuleOptions = {
        providers: [],
        secret: 'test-secret',
        trustHost: true
      };

      const dynamicModule = AuthModule.register(staticOptions, {
        globalGuard: false,
        rolesGuard: false
      });

      const guardProviders =
        dynamicModule.providers?.filter((p) => hasProvide(p, APP_GUARD)) ?? [];

      expect(guardProviders).toHaveLength(0);
    });
  });

  describe('registerAsync with useFactory', () => {
    test('should create module with factory configuration', async () => {
      const factoryOptions: AuthModuleAsyncOptions = {
        useFactory: (...args: readonly unknown[]) => {
          const [configService] = args as [MockConfigService];
          return {
            providers: [
              {
                id: 'google',
                name: 'Google',
                type: 'oauth',
                clientId: configService.get('GOOGLE_CLIENT_ID'),
                clientSecret: configService.get('GOOGLE_CLIENT_SECRET')
              }
            ],
            secret: configService.get('AUTH_SECRET'),
            trustHost: true
          };
        },
        inject: [MockConfigService]
      };

      const dynamicModule = AuthModule.registerAsync(factoryOptions);

      expect(dynamicModule.module).toBe(AuthModule);
      expect(dynamicModule.controllers).toEqual([AuthController]);
      expect(dynamicModule.exports).toEqual([AuthModuleOptions]);

      const optionsProvider = findProvider(
        dynamicModule.providers,
        AuthModuleOptions
      );
      expect(optionsProvider).toMatchObject({
        provide: AuthModuleOptions,
        useFactory: factoryOptions.useFactory,
        inject: [MockConfigService]
      });
    });

    test('should provide factory-created options that can be injected', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: HttpAdapterHost,
            useClass: MockHttpAdapterHost
          }
        ],
        imports: [
          AuthModule.registerAsync({
            imports: [MockProviderModule],
            useFactory: (...args: readonly unknown[]) => {
              const [configService] = args as [MockConfigService];
              return {
                providers: [],
                secret: configService.get('AUTH_SECRET'),
                trustHost: true
              };
            },
            inject: [MockConfigService]
          })
        ]
      }).compile();

      const options = module.get<IAuthModuleOptions>(AuthModuleOptions);
      expect(options.secret).toBe('test-secret');
      expect(options.trustHost).toBe(true);
    });

    test('should handle factory with no inject dependencies', async () => {
      const factoryOptions: AuthModuleAsyncOptions = {
        useFactory: () => ({
          providers: [],
          secret: 'factory-secret',
          trustHost: false
        })
      };

      const dynamicModule = AuthModule.registerAsync(factoryOptions);

      const optionsProvider = findProvider(
        dynamicModule.providers,
        AuthModuleOptions
      );
      expect(optionsProvider).toBeDefined();

      expect(optionsProvider).toMatchObject({
        provide: AuthModuleOptions,
        useFactory: factoryOptions.useFactory,
        inject: [] // empty array
      });
    });
  });

  describe('registerAsync with useClass', () => {
    test('should create module with class-based configuration', async () => {
      const classOptions: AuthModuleAsyncOptions = {
        imports: [MockConfigModule],
        useClass: MockAuthConfigService
      };

      const dynamicModule = AuthModule.registerAsync(classOptions);

      expect(dynamicModule.module).toBe(AuthModule);
      expect(dynamicModule.imports).toEqual([MockConfigModule]);
      expect(dynamicModule.exports).toEqual([AuthModuleOptions]);

      // Expect the correct number of providers
      expect(dynamicModule.providers).toHaveLength(5);

      // Find providers robustly
      const optionsProvider = findProvider(
        dynamicModule.providers,
        AuthModuleOptions
      );
      const classProvider = findProvider(
        dynamicModule.providers,
        MockAuthConfigService
      );

      expect(optionsProvider).toBeDefined();
      expect(classProvider).toBeDefined();

      expect(optionsProvider).toMatchObject({
        provide: AuthModuleOptions,
        inject: [MockAuthConfigService]
      });

      expect(classProvider).toEqual({
        provide: MockAuthConfigService,
        useClass: MockAuthConfigService
      });
    });

    test('should provide class-created options that can be injected', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          AuthModule.registerAsync({
            imports: [MockProviderModule],
            useClass: MockAuthConfigService
          })
        ]
      }).compile();

      const options = module.get<IAuthModuleOptions>(AuthModuleOptions);
      expect(options.secret).toBe('test-secret');
      expect(options.providers).toHaveLength(1);

      const authProviderCandidate = options.providers[0];
      expect(isOAuthProvider(authProviderCandidate)).toBe(true);
      if (isOAuthProvider(authProviderCandidate)) {
        expect(authProviderCandidate.clientId).toBe('test-client-id');
      }
    });
  });

  describe('registerAsync with useExisting', () => {
    test('should create module with existing provider configuration', async () => {
      const existingOptions: AuthModuleAsyncOptions = {
        imports: [MockConfigModule],
        useExisting: MockAuthConfigService
      };

      const dynamicModule = AuthModule.registerAsync(existingOptions);

      expect(dynamicModule.module).toBe(AuthModule);
      expect(dynamicModule.imports).toEqual([MockConfigModule]);
      expect(dynamicModule.controllers).toEqual([AuthController]);
      expect(dynamicModule.exports).toEqual([AuthModuleOptions]);

      const optionsProvider = findProvider(
        dynamicModule.providers,
        AuthModuleOptions
      );
      expect(optionsProvider).toMatchObject({
        provide: AuthModuleOptions,
        inject: [MockAuthConfigService]
      });
    });

    test('should provide existing provider options that can be injected', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          MockConfigModule,
          AuthModule.registerAsync({
            imports: [MockConfigModule],
            useExisting: MockAuthConfigService
          })
        ]
      }).compile();

      const options = module.get<IAuthModuleOptions>(AuthModuleOptions);
      expect(options.secret).toBe('test-secret');
      expect(options.providers).toHaveLength(1);

      const provider0 = options.providers[0];
      expect(isOAuthProvider(provider0)).toBe(true);
      if (isOAuthProvider(provider0)) {
        expect(provider0.name).toBe('Google');
      }
    });
  });

  describe('error handling', () => {
    test('should throw error when no async options are provided', () => {
      expect(() => {
        AuthModule.registerAsync({} as AuthModuleAsyncOptions);
      }).toThrow('Invalid Auth.js module async options');
    });

    test('should throw error when useFactory is missing inject target', () => {
      expect(() => {
        AuthModule.registerAsync({
          useClass: undefined,
          useExisting: undefined,
          useFactory: undefined
        });
      }).toThrow('Invalid Auth.js module async options');
    });
  });

  describe('module imports', () => {
    test('should include imports in registerAsync', () => {
      const dynamicModule = AuthModule.registerAsync({
        imports: [MockConfigModule],
        useFactory: () => ({
          providers: [],
          secret: 'test',
          trustHost: true
        })
      });

      expect(dynamicModule.imports).toEqual([MockConfigModule]);
    });

    test('should handle empty imports array', () => {
      const dynamicModule = AuthModule.registerAsync({
        imports: [],
        useFactory: () => ({
          providers: [],
          secret: 'test',
          trustHost: true
        })
      });

      expect(dynamicModule.imports).toEqual([]);
    });

    test('should handle undefined imports', () => {
      const dynamicModule = AuthModule.registerAsync({
        useFactory: () => ({
          providers: [],
          secret: 'test',
          trustHost: true
        })
      });

      expect(dynamicModule.imports).toEqual([]);
    });
  });
});
