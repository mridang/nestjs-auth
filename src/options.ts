// file: src/options.ts
/**
 * Default configuration options for the Auth.js module.
 *
 * @remarks
 * These defaults prioritize security while maintaining usability. They can be
 * overridden at module registration or per-guard level.
 *
 * @example
 * ```ts
 * // Override defaults when registering the module
 * AuthJsModule.register({
 *   ...defaultOptions,
 *   session: {
 *     ...defaultOptions.session,
 *     maxAge: 7 * 24 * 60 * 60 // 1 week
 *   }
 * })
 * ```
 */
export const defaultOptions = {
  /**
   * Session configuration
   */
  session: {
    /**
     * Session storage strategy
     * @default 'jwt' - Stateless JWT sessions
     */
    strategy: 'jwt' as const,

    /**
     * Maximum age of a session in seconds
     * @default 86400 (24 hours)
     */
    maxAge: 24 * 60 * 60,

    /**
     * How frequently to update the session expiry in seconds
     * @default 3600 (1 hour)
     */
    updateAge: 60 * 60
  },

  /**
   * Property name to attach the user object to the request
   * @default 'user'
   * @example
   * ```ts
   * // Access in controller
   * @Get()
   * getProfile(@Req() req: Request) {
   *   return req.user; // or req['user']
   * }
   * ```
   */
  property: 'user',

  /**
   * Base path for Auth.js routes
   * @default '/auth'
   * @example Results in routes like:
   * - GET /auth/signin
   * - POST /auth/signout
   * - GET /auth/session
   * - GET /auth/callback/:provider
   */
  basePath: '/auth',

  /**
   * Whether to trust the Host header
   * @default true in development, false in production
   * @remarks
   * In production, you should explicitly set this or configure
   * allowed hosts to prevent host header injection attacks
   */
  trustHost: process.env.NODE_ENV === 'development',

  /**
   * Enable CSRF protection
   * @default true
   * @remarks
   * Protects against Cross-Site Request Forgery attacks.
   * Only disable if you have alternative CSRF protection.
   */
  csrf: true,

  /**
   * Use secure cookies (HTTPS only)
   * @default true in production, false in development
   * @remarks
   * Secure cookies are only sent over HTTPS connections,
   * preventing interception over insecure connections
   */
  useSecureCookies: process.env.NODE_ENV === 'production',

  /**
   * Security callbacks
   */
  callbacks: {
    /**
     * Validates redirect URLs to prevent open redirect vulnerabilities
     * @param url - The redirect URL to validate
     * @param baseUrl - The application's base URL
     * @returns The validated redirect URL or baseUrl if invalid
     * @remarks
     * Default implementation only allows:
     * - Relative URLs starting with single "/"
     * - Absolute URLs with same origin as baseUrl
     */
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      if (url.startsWith('/') && !url.startsWith('//')) return url;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    }
  }
} as const;
