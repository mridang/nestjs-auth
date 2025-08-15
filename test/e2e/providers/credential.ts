import CredentialsProvider from '@auth/core/providers/credentials';
import type { User } from '@auth/core/types';
import { TestUser } from '../client-sessions.module.js';

/**
 * Creates a credentials provider configuration for Auth.js with username/password authentication.
 *
 * This provider allows users to authenticate using email (as username) and password from a
 * predefined set of test users. It's designed for testing environments where OAuth flows
 * are not desired.
 *
 * @param users - Record of test users keyed by user ID, each containing authentication data
 * @returns Configured credentials provider for Auth.js
 *
 * @example
 * ```typescript
 * const testUsers = {
 *   '1': {
 *     id: '1',
 *     name: 'Admin User',
 *     email: 'admin@example.com',
 *     roles: ['admin'],
 *     password: 'password123'
 *   },
 *   '2': {
 *     id: '2',
 *     name: 'Regular User',
 *     email: 'user@example.com',
 *     roles: ['user'],
 *     password: 'password456'
 *   }
 * };
 *
 * const credentialsProvider = createCredentialsProvider(testUsers);
 * ```
 *
 * @remarks
 * - The username field expects an email address that matches a user's email property
 * - Password comparison is done in plain text (suitable only for testing)
 * - Returns null for invalid credentials, which Auth.js treats as authentication failure
 * - Successfully authenticated users receive all properties: id, name, email, and roles
 */
export function createCredentialsProvider(users: Record<string, TestUser>) {
  return CredentialsProvider({
    name: 'credentials',
    credentials: {
      username: {
        label: 'Username',
        type: 'text'
      },
      password: {
        label: 'Password',
        type: 'password'
      }
    },
    async authorize(
      credentials: Partial<Record<string, unknown>>
    ): Promise<User | null> {
      const c = credentials as { username?: string; password?: string };

      if (!c?.username || !c?.password) {
        return null;
      } else {
        const match = Object.values(users).find((u) => u.email === c.username);

        if (match && match.password === c.password) {
          const { id, name, email, roles } = match;
          return { id, name, email, roles };
        } else {
          return null;
        }
      }
    }
  });
}
