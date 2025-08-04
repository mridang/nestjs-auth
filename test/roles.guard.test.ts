import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { Controller, ExecutionContext, Get } from '@nestjs/common';
import { RolesGuard } from '../src/roles.guard.js';
// noinspection ES6PreferShortImport
import { RequireRoles } from '../src/auth.decorators.js';
import type { Session } from '@auth/core/types';

declare module '@auth/core/types' {
  // eslint-disable-next-line no-undef
  interface User extends DefaultUser {
    roles?: string[];
  }

  // noinspection JSUnusedGlobalSymbols
  // eslint-disable-next-line no-undef
  interface Session extends DefaultSession {
    user: User;
  }
}

@Controller('test')
class TestController {
  @Get('public')
  publicMethod() {
    return 'public';
  }

  @Get('admin')
  @RequireRoles('admin')
  adminOnlyMethod() {
    return 'admin only';
  }

  @Get('staff')
  @RequireRoles('admin', 'moderator')
  staffMethod() {
    return 'staff only';
  }

  @Get('empty-roles')
  @RequireRoles()
  emptyRolesMethod() {
    return 'empty roles';
  }
}

describe('RolesGuard', () => {
  let guard: RolesGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesGuard, Reflector],
      controllers: [TestController]
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
  });

  describe('canActivate', () => {
    it('should allow access when no roles are required', () => {
      const mockContext = createMockContext(
        TestController.prototype.publicMethod,
        TestController,
        {}
      );

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should allow access when empty roles array is required', () => {
      const mockContext = createMockContext(
        TestController.prototype.emptyRolesMethod,
        TestController,
        {}
      );

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should deny access when user has no roles but roles are required', () => {
      const mockContext = createMockContext(
        TestController.prototype.adminOnlyMethod,
        TestController,
        {
          user: { id: '123', email: 'test@example.com' } // No roles
        }
      );

      const result = guard.canActivate(mockContext);

      expect(result).toBe(false);
    });

    it('should deny access when user has no matching roles', () => {
      const mockContext = createMockContext(
        TestController.prototype.staffMethod,
        TestController,
        {
          user: {
            id: '123',
            email: 'test@example.com',
            roles: ['user', 'viewer']
          }
        }
      );

      const result = guard.canActivate(mockContext);

      expect(result).toBe(false);
    });

    it('should allow access when user has one of the required roles', () => {
      const mockContext = createMockContext(
        TestController.prototype.staffMethod,
        TestController,
        {
          user: {
            id: '123',
            email: 'test@example.com',
            roles: ['user', 'moderator', 'viewer']
          }
        }
      );

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should allow access when user has all required roles', () => {
      const mockContext = createMockContext(
        TestController.prototype.adminOnlyMethod,
        TestController,
        {
          user: {
            id: '123',
            email: 'test@example.com',
            roles: ['admin', 'moderator', 'user']
          }
        }
      );

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should handle single required role', () => {
      const mockContext = createMockContext(
        TestController.prototype.adminOnlyMethod,
        TestController,
        {
          user: {
            id: '123',
            email: 'test@example.com',
            roles: ['admin']
          }
        }
      );

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should deny access when user is not present in request', () => {
      const mockContext = createMockContext(
        TestController.prototype.adminOnlyMethod,
        TestController,
        {} // No user property
      );

      const result = guard.canActivate(mockContext);

      expect(result).toBe(false);
    });

    it('should handle user with undefined roles', () => {
      const mockContext = createMockContext(
        TestController.prototype.adminOnlyMethod,
        TestController,
        {
          user: {
            id: '123',
            email: 'test@example.com',
            roles: undefined
          }
        }
      );

      const result = guard.canActivate(mockContext);

      expect(result).toBe(false);
    });
  });
});

/**
 * Helper function to create a mock ExecutionContext with real method references
 */
function createMockContext(
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  handler: Function,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  controllerClass: Function,
  requestData: {
    user?: Session['user'] & { roles?: string[] };
  }
): ExecutionContext {
  const mockRequest = { ...requestData };

  return {
    switchToHttp: () => ({
      getRequest: () => mockRequest
    }),
    getHandler: () => handler,
    getClass: () => controllerClass
  } as ExecutionContext;
}
