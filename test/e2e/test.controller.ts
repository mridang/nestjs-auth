/**
 * E2EController exposes a minimal set of HTTP routes to exercise
 * Auth.js behavior end to end in tests. Routes are intentionally
 * simple and map to clear access rules, so the test matrix can
 * verify authentication, role checks, and cookie behavior.
 *
 * The controller is framework-agnostic apart from relying on the
 * application’s global Auth.js guards and the custom decorators
 * provided by the testing module, namely:
 *
 * - @Public() to mark routes as accessible without a session
 * - @RequireRoles(...) to express role-based access control
 * - @AuthSession() to retrieve the current Auth.js Session or
 *   null when no session exists
 *
 * The goal is to keep this controller decoupled from test setup
 * and providers, so the same routes can be reused in different
 * e2e scenarios and module configurations without modification.
 */
import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import type { Session } from '@auth/core/types';
// noinspection ES6PreferShortImport
import { AuthSession, Public, RequireRoles } from '../../src/index.js';

@Controller()
export class E2EController {
  @Get('public')
  @Public()
  getPublic() {
    return { message: 'This is a public endpoint', timestamp: Date.now() };
  }

  @Get('session-info')
  @Public()
  getSessionInfo(@AuthSession() session: Session | null) {
    return {
      hasSession: !!session,
      user: session?.user || null,
      message: 'Session info (public)',
    };
  }

  @Get('profile')
  getProfile(@AuthSession() session: Session | null) {
    if (!session?.user) throw new UnauthorizedException('No session found');
    return {
      user: session.user,
      expires: session.expires,
      message: 'Profile data',
    };
  }

  @Get('user/settings')
  @RequireRoles('user')
  getUserSettings(@AuthSession() session: Session | null) {
    return {
      user: session?.user,
      message: 'User settings page',
      userAccess: true,
    };
  }

  @Get('admin/dashboard')
  @RequireRoles('admin')
  getAdminDashboard(@AuthSession() session: Session | null) {
    return {
      user: session?.user,
      message: 'Welcome to the admin dashboard',
      adminOnly: true,
    };
  }

  @Get('staff/area')
  @RequireRoles('admin', 'moderator')
  getStaffArea(@AuthSession() session: Session | null) {
    return {
      user: session?.user,
      message: 'Staff only area',
      staffAccess: true,
    };
  }

  @Get('auth/login')
  @Public()
  customAuthLogin() {
    return { page: 'custom-login', ok: true };
  }
}
