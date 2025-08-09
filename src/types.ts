import type { Session as CoreSession } from '@auth/core/types';

/**
 * @fileoverview Public and internal types for the integration.  Exposes a
 * minimal public surface that apps can augment, and a request shape used
 * internally by adapters/guards.  Application code should import types
 * from this module only, not from @auth/* directly.
 *
 * Augment in an app with:
 *
 * declare module '@mridang/nestjs-auth' {
 *   interface AuthUserAugmentation { roles?: string[] }
 *   interface SessionAugmentation {
 *     idToken?: string; accessToken?: string; refreshToken?: string; error?: string;
 *   }
 * }
 */

/**
 * Minimal user fields commonly present on `session.user`.  These map to
 * baseline profile data and are safe to rely on across providers.
 */
export interface AuthUserBase {
  /** Display name of the user, if available. */
  name?: string | null;
  /** Primary email address of the user, if available. */
  email?: string | null;
  /** URL for the user’s avatar image, if available. */
  image?: string | null;
}

/**
 * Minimal session fields that remain stable across providers.  Provider
 * tokens and other details are intentionally excluded here.
 */
export interface SessionBase {
  /** The authenticated user object or null/undefined when absent. */
  user?: AuthUserBase | null;
  /** ISO-8601 timestamp indicating when the session will expire. */
  expires?: string;
}

/**
 * Application-side hook for widening the public user shape.  This must
 * not be empty to satisfy lint rules; the sentinel field is optional
 * and `never`, so it has no runtime effect and will not constrain
 * augmentation.
 */
export interface AuthUserAugmentation {
  /** @internal sentinel to keep interface non-empty for augmentation. */
  __augmentationBrand__?: never;
}

/**
 * Application-side hook for widening the public session shape.  This
 * must not be empty to satisfy lint rules; the sentinel field is
 * optional and `never`, so it has no runtime effect and will not
 * constrain augmentation.
 */
export interface SessionAugmentation {
  /** @internal sentinel to keep interface non-empty for augmentation. */
  __augmentationBrand__?: never;
}

/** Public user type = base plus any application augmentations. */
export type AuthUser = AuthUserBase & AuthUserAugmentation;

/** Public session type = base plus any application augmentations. */
export type Session = SessionBase & SessionAugmentation;

/**
 * Narrow request view used internally when attaching authentication.
 * It reflects the core session shape returned by the auth engine.  The
 * library may map this to the public `Session` before exposing it.
 */
export interface AuthenticatedRequest {
  /**
   * The current authentication session as produced by the auth engine.
   * This will be undefined when no session is present.
   */
  session?: CoreSession;
  /**
   * Convenience reference to the current user derived from the session.
   * May be null/undefined depending on configuration.
   */
  user?: CoreSession['user'];
  /**
   * Snapshot of inbound headers.  Names should be treated case-insensitively.
   * Values may be a string, an array of strings, or absent.
   */
  headers?: Record<string, string | string[] | undefined>;
  /**
   * Request URL path (and query string, if present) as observed by the
   * active HTTP server.
   */
  url?: string;
  /**
   * HTTP method for this request.  Typically an upper-case token such as
   * "GET" or "POST".
   */
  method?: string;
  /**
   * Parsed request body, when available.  No schema is enforced here;
   * callers should validate shape prior to use.
   */
  body?: unknown;
}
