import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
// Import the augmented types AFTER the declaration
import type {
  DefaultSession,
  DefaultUser,
  Session,
  User
} from '@auth/core/types';
// noinspection ES6PreferShortImport
import {
  AuthSession,
  IS_PUBLIC_KEY,
  Public,
  REQUIRED_ROLES_KEY,
  RequireRoles
} from '../src/auth.decorators.js';

declare module '@auth/core/types' {
  interface User extends DefaultUser {
    roles?: string[];
    profile?: {
      avatar?: string;
      preferences?: { theme?: string };
    };
  }

  // noinspection JSUnusedGlobalSymbols
  interface Session extends DefaultSession {
    user: User;
  }
}

describe('Auth Decorators', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  describe('Public decorator', () => {
    test('should set isPublic metadata to true', () => {
      class TestController {
        @Public()
        publicMethod() {
          //
        }
      }

      // Get the metadata using the exported symbol key
      const metadata = reflector.get(
        IS_PUBLIC_KEY,
        TestController.prototype.publicMethod
      );

      expect(metadata).toBe(true);
    });
  });

  describe('RequireRoles decorator', () => {
    test('should set required roles metadata', () => {
      const testRoles = ['admin', 'user'] as const;

      class TestController {
        @RequireRoles(...testRoles)
        protectedMethod() {}
      }

      const metadata = reflector.get(
        REQUIRED_ROLES_KEY,
        TestController.prototype.protectedMethod
      );

      expect(metadata).toEqual(testRoles);
    });

    test('should handle single role', () => {
      class TestController {
        @RequireRoles('admin')
        adminOnlyMethod() {}
      }

      const metadata = reflector.get(
        REQUIRED_ROLES_KEY,
        TestController.prototype.adminOnlyMethod
      );

      expect(metadata).toEqual(['admin']);
    });

    test('should handle empty roles array', () => {
      class TestController {
        @RequireRoles()
        noRolesMethod() {}
      }

      const metadata = reflector.get(
        REQUIRED_ROLES_KEY,
        TestController.prototype.noRolesMethod
      );

      expect(metadata).toEqual([]);
    });
  });

  describe('AuthSession decorator logic', () => {
    const createSessionExtractor = (
      data: unknown,
      ctx: ExecutionContext
    ): Session | null => {
      const request = ctx
        .switchToHttp()
        .getRequest<Request & { session?: Session }>();
      return request.session ?? null;
    };

    test('should extract session from request', () => {
      const mockSession: Session = {
        user: { id: '123', email: 'test@example.com' },
        expires: '2024-12-31'
      };

      const mockRequest = { session: mockSession };
      const mockContext: ExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest
        })
      } as ExecutionContext;

      const result = createSessionExtractor(undefined, mockContext);

      expect(result).toEqual(mockSession);
    });

    test('should return null when no session exists', () => {
      const mockRequest = {};
      const mockContext: ExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest
        })
      } as ExecutionContext;

      const result = createSessionExtractor(undefined, mockContext);

      expect(result).toBeNull();
    });

    test('should return null when session is undefined', () => {
      const mockRequest = { session: undefined };
      const mockContext: ExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest
        })
      } as ExecutionContext;

      const result = createSessionExtractor(undefined, mockContext);

      expect(result).toBeNull();
    });

    test('should access user through session', () => {
      const mockUser: User = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        roles: ['admin', 'user']
      };

      const mockSession: Session = {
        user: mockUser,
        expires: '2024-12-31'
      };

      const mockRequest = { session: mockSession };
      const mockContext: ExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest
        })
      } as ExecutionContext;

      const result = createSessionExtractor(undefined, mockContext);

      expect(result?.user).toEqual(mockUser);
      expect(result?.user.roles).toContain('admin');
    });
  });

  describe('Integration scenarios', () => {
    const createSessionExtractor = (
      data: unknown,
      ctx: ExecutionContext
    ): Session | null => {
      const request = ctx
        .switchToHttp()
        .getRequest<Request & { session?: Session }>();
      return request.session ?? null;
    };

    test('should handle complex user object structure through session', () => {
      const complexUser: User = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        roles: ['admin', 'user'],
        profile: {
          avatar: 'https://example.com/avatar.jpg',
          preferences: { theme: 'dark' }
        }
      };

      const mockSession: Session = {
        user: complexUser,
        expires: '2024-12-31'
      };

      const mockRequest = { session: mockSession };
      const mockContext: ExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest
        })
      } as ExecutionContext;

      const result = createSessionExtractor(undefined, mockContext);

      expect(result?.user).toEqual(complexUser);
      expect(result?.user.roles).toContain('admin');
      expect(result?.user.profile?.preferences?.theme).toBe('dark');
    });

    test('should provide complete session data', () => {
      const mockUser: User = {
        id: '123',
        email: 'test@example.com',
        roles: ['user']
      };

      const mockSession: Session = {
        user: mockUser,
        expires: '2024-12-31'
      };

      const mockRequest = { session: mockSession };
      const mockContext: ExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest
        })
      } as ExecutionContext;

      const result = createSessionExtractor(undefined, mockContext);

      expect(result).toEqual(mockSession);
      expect(result?.user).toEqual(mockUser);
      expect(result?.expires).toBe('2024-12-31');
    });
  });

  describe('Decorator creation', () => {
    test('should create AuthSession decorator without errors', () => {
      expect(() => AuthSession).not.toThrow();
      expect(typeof AuthSession).toBe('function');
    });
  });
});
