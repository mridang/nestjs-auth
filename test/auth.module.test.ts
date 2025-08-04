import { Test, TestingModule } from '@nestjs/testing';
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
  private config = {
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
  constructor(private configService: MockConfigService) {}

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
    it('should create module with static configuration', async () => {
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

      // FIX: Find the options provider and check for a 'useFactory' property
      const optionsProvider = dynamicModule.providers!.find(
        (p) =>
          typeof p === 'object' &&
          'provide' in p &&
          p.provide === AuthModuleOptions
      );

      expect(optionsProvider).toBeDefined();

      // Assert the new structure
      expect(optionsProvider).toHaveProperty('useFactory');
      expect(optionsProvider).not.toHaveProperty('useValue'); // Optional: explicitly check that useValue is gone

      // You can also check the result of the factory to be extra sure
      const factoryResult = await (optionsProvider as any).useFactory();
      expect(factoryResult).toEqual(staticOptions);
    });

    it('should configure global guards by default', () => {
      const staticOptions: IAuthModuleOptions = {
        providers: [],
        secret: 'test-secret',
        trustHost: true
      };

      const dynamicModule = AuthModule.register(staticOptions);

      // Should include global guards by default
      const guardProviders = dynamicModule.providers!.filter(
        (p) =>
          typeof p === 'object' && 'provide' in p && p.provide === APP_GUARD
      );

      expect(guardProviders).toHaveLength(2); // Auth guard + Roles guard
    });

    it('should allow disabling global guards', () => {
      const staticOptions: IAuthModuleOptions = {
        providers: [],
        secret: 'test-secret',
        trustHost: true
      };

      const dynamicModule = AuthModule.register(staticOptions, {
        globalGuard: false,
        rolesGuard: false
      });

      // Should not include global guards when disabled
      const guardProviders = dynamicModule.providers!.filter(
        (p) =>
          typeof p === 'object' && 'provide' in p && p.provide === APP_GUARD
      );

      expect(guardProviders).toHaveLength(0);
    });
  });

  describe('registerAsync with useFactory', () => {
    it('should create module with factory configuration', async () => {
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

      // Should include middleware and options provider
      const optionsProvider = dynamicModule.providers!.find(
        (p) =>
          typeof p === 'object' &&
          'provide' in p &&
          p.provide === AuthModuleOptions
      );
      expect(optionsProvider).toMatchObject({
        provide: AuthModuleOptions,
        useFactory: factoryOptions.useFactory,
        inject: [MockConfigService]
      });
    });

    it('should provide factory-created options that can be injected', async () => {
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

    it('should handle factory with no inject dependencies', async () => {
      const factoryOptions: AuthModuleAsyncOptions = {
        useFactory: () => ({
          providers: [],
          secret: 'factory-secret',
          trustHost: false
        })
      };

      const dynamicModule = AuthModule.registerAsync(factoryOptions);

      // FIX: Find the provider instead of assuming its position.
      const optionsProvider = dynamicModule.providers!.find(
        (p) =>
          typeof p === 'object' &&
          'provide' in p &&
          p.provide === AuthModuleOptions
      );

      // Add a check to make sure the provider was found before asserting against it.
      expect(optionsProvider).toBeDefined();

      expect(optionsProvider).toMatchObject({
        provide: AuthModuleOptions,
        useFactory: factoryOptions.useFactory,
        inject: [] // This correctly asserts that inject is an empty array
      });
    });
  });

  describe('registerAsync with useClass', () => {
    it('should create module with class-based configuration', async () => {
      const classOptions: AuthModuleAsyncOptions = {
        // You can remove imports here if MockAuthConfigService doesn't depend on MockConfigModule
        // since MockProviderModule is what provides MockConfigService's dependency.
        // However, keeping it doesn't harm anything.
        imports: [MockConfigModule],
        useClass: MockAuthConfigService
      };

      const dynamicModule = AuthModule.registerAsync(classOptions);

      expect(dynamicModule.module).toBe(AuthModule);
      expect(dynamicModule.imports).toEqual([MockConfigModule]);
      expect(dynamicModule.exports).toEqual([AuthModuleOptions]);

      // 1. FIX: Expect the correct number of providers
      expect(dynamicModule.providers).toHaveLength(5);

      // 2. FIX: Find providers robustly instead of relying on array order
      const optionsProvider = dynamicModule.providers!.find(
        (p) =>
          typeof p === 'object' &&
          'provide' in p &&
          p.provide === AuthModuleOptions
      );

      const classProvider = dynamicModule.providers!.find(
        (p) =>
          typeof p === 'object' &&
          'provide' in p &&
          p.provide === MockAuthConfigService
      );

      // Assert that the providers were actually found
      expect(optionsProvider).toBeDefined();
      expect(classProvider).toBeDefined();

      // The rest of your assertions are correct
      expect(optionsProvider).toMatchObject({
        provide: AuthModuleOptions,
        inject: [MockAuthConfigService]
      });

      expect(classProvider).toEqual({
        provide: MockAuthConfigService,
        useClass: MockAuthConfigService
      });
    });

    it('should provide class-created options that can be injected', async () => {
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

      // Type assertion for Auth.js provider
      const authProvider = options.providers[0] as any;
      expect(authProvider.clientId).toBe('test-client-id');
    });
  });

  describe('registerAsync with useExisting', () => {
    it('should create module with existing provider configuration', async () => {
      const existingOptions: AuthModuleAsyncOptions = {
        imports: [MockConfigModule],
        useExisting: MockAuthConfigService
      };

      const dynamicModule = AuthModule.registerAsync(existingOptions);

      expect(dynamicModule.module).toBe(AuthModule);
      expect(dynamicModule.imports).toEqual([MockConfigModule]);
      expect(dynamicModule.controllers).toEqual([AuthController]);
      expect(dynamicModule.exports).toEqual([AuthModuleOptions]);

      const optionsProvider = dynamicModule.providers!.find(
        (p) =>
          typeof p === 'object' &&
          'provide' in p &&
          p.provide === AuthModuleOptions
      );
      expect(optionsProvider).toMatchObject({
        provide: AuthModuleOptions,
        inject: [MockAuthConfigService]
      });
    });

    it('should provide existing provider options that can be injected', async () => {
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

      // Type assertion for Auth.js provider
      const authProvider = options.providers[0] as any;
      expect(authProvider.name).toBe('Google');
    });
  });

  describe('error handling', () => {
    it('should throw error when no async options are provided', () => {
      expect(() => {
        AuthModule.registerAsync({} as AuthModuleAsyncOptions);
      }).toThrow('Invalid Auth.js module async options');
    });

    it('should throw error when useFactory is missing inject target', () => {
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
    it('should include imports in registerAsync', () => {
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

    it('should handle empty imports array', () => {
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

    it('should handle undefined imports', () => {
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
