// src/auth.session.ts

import type { Session as CoreSession } from '@auth/core/types';
import type { Session, AuthUser } from './types.js';

/**
 * Concrete runtime object that implements the public `Session` shape.
 * It encapsulates mapping from the underlying core session into the
 * public surface while preserving any app-augmented fields placed on
 * the core session by callbacks.
 */
export class AuthSession implements Session {
  /** The authenticated user, or null/undefined when absent. */
  user?: AuthUser | null;

  /** ISO-8601 timestamp indicating when the session expires. */
  expires?: string;

  /**
   * Factory: build from a core session. Returns null when no session.
   */
  static fromCore(core: CoreSession | null | undefined): AuthSession | null {
    return core ? new AuthSession(core) : null;
  }

  /**
   * Construct from a core session or a partial public session. Copies
   * base fields and safely preserves any extra fields present on the
   * source object (e.g., tokens added by app callbacks).
   */
  constructor(src: CoreSession | Partial<Session>) {
    // user
    const srcAsRec = toRecord(src);
    const srcUser = toRecord(srcAsRec?.user);
    if (srcUser) {
      const mergedUser: Record<string | symbol, unknown> = {};
      // copy base fields if present
      if ('name' in srcUser) mergedUser.name = srcUser.name;
      if ('email' in srcUser) mergedUser.email = srcUser.email;
      if ('image' in srcUser) mergedUser.image = srcUser.image;
      // copy any app-augmented user fields
      copyExtraProps(
        srcUser,
        mergedUser,
        new Set<PropertyKey>(['name', 'email', 'image'])
      );
      this.user = mergedUser as unknown as AuthUser;
    } else {
      this.user = null;
    }

    // expires
    if (
      srcAsRec &&
      'expires' in srcAsRec &&
      typeof srcAsRec.expires === 'string'
    ) {
      this.expires = srcAsRec.expires;
    }

    // copy any app-augmented session fields (tokens, errors, etc.)
    if (srcAsRec) {
      copyExtraProps(srcAsRec, this, new Set<PropertyKey>(['user', 'expires']));
    }
  }

  /**
   * Return a plain JSON object conforming to the public `Session`.
   */
  toJSON(): Session {
    const out: Record<string | symbol, unknown> = {};
    if (typeof this.user !== 'undefined') out.user = this.user;
    if (typeof this.expires !== 'undefined') out.expires = this.expires;
    copyExtraProps(this, out, new Set<PropertyKey>(['user', 'expires']));
    return out as unknown as Session;
  }

  /**
   * Shallow merge in additional fields and return `this`.
   */
  with(patch: Partial<Session>): AuthSession {
    const patchRec = toRecord(patch);
    if (patchRec) {
      copyExtraProps(patchRec, this, new Set<PropertyKey>([]));
    }
    return this;
  }
}

/* helpers (no `any`) */

function isObjectRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null;
}

function toRecord(value: unknown): Record<PropertyKey, unknown> | null {
  return isObjectRecord(value) ? (value as Record<PropertyKey, unknown>) : null;
}

function copyExtraProps(
  source: object,
  target: object,
  exclude: ReadonlySet<PropertyKey>
): void {
  const sDesc = Object.getOwnPropertyDescriptors(source);
  for (const key of Reflect.ownKeys(sDesc)) {
    if (exclude.has(key)) continue;
    const desc = sDesc[key as keyof typeof sDesc];
    if (desc) Object.defineProperty(target, key, desc);
  }
}
