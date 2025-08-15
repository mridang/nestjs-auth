import type {
  Adapter,
  AdapterAccount,
  AdapterSession,
  AdapterUser,
  VerificationToken,
} from '@auth/core/adapters';
import { randomUUID } from 'crypto';

interface UserWithRoles extends AdapterUser {
  roles: string[];
}

/**
 * Creates an in-memory implementation of the Auth.js Adapter.
 *
 * This adapter is suitable for testing environments only.
 * All data is stored in memory and will be lost when the process exits.
 *
 * @returns An Auth.js-compatible Adapter instance.
 */
export function MemoryAdapter(): Adapter {
  const users = new Map<string, UserWithRoles>();
  const sessions = new Map<string, AdapterSession>();
  const accounts = new Map<string, AdapterAccount>();
  const verificationTokens = new Map<string, VerificationToken>();

  return {
    /**
     * Creates a new user.
     * @param user - User data to be created.
     * @returns The created user.
     */
    async createUser(user: AdapterUser): Promise<AdapterUser> {
      const id =
        (user as { stableId?: string }).stableId ?? user.id ?? randomUUID();

      const newUser: UserWithRoles = {
        ...(user as AdapterUser),
        id,
        emailVerified: user.emailVerified ?? null,
        roles: (user as UserWithRoles).roles ?? [],
      };

      users.set(id, newUser);
      return newUser;
    },

    /**
     * Retrieves a user by their unique ID.
     * @param id - The user's ID.
     * @returns The user or null if not found.
     */
    async getUser(id: string): Promise<AdapterUser | null> {
      const user = users.get(id);
      if (user) {
        return user;
      } else {
        return null;
      }
    },

    /**
     * Retrieves a user by their email address.
     * @param email - The email to look up.
     * @returns The user or null if not found.
     */
    async getUserByEmail(email: string): Promise<AdapterUser | null> {
      for (const user of users.values()) {
        if (user.email === email) {
          return user;
        }
      }
      return null;
    },

    /**
     * Retrieves a user by their linked account.
     * @param params - The provider and providerAccountId.
     * @returns The user or null if not found.
     */
    async getUserByAccount(params: {
      provider: string;
      providerAccountId: string;
    }): Promise<AdapterUser | null> {
      const key = `${params.provider}:${params.providerAccountId}`;
      const account = accounts.get(key);

      if (account) {
        const user = users.get(account.userId);
        if (user) {
          return user;
        } else {
          return null;
        }
      } else {
        return null;
      }
    },

    /**
     * Updates a user's data.
     * @param data - The user data with an ID.
     * @returns The updated user.
     */
    async updateUser(
      data: Partial<AdapterUser> & Pick<AdapterUser, 'id'>,
    ): Promise<AdapterUser> {
      const user = users.get(data.id);

      if (user) {
        const updated = { ...user, ...data } as UserWithRoles;
        users.set(data.id, updated);
        return updated;
      } else {
        throw new Error('User not found');
      }
    },

    /**
     * Deletes a user by ID.
     * @param userId - The ID of the user to delete.
     * @returns The deleted user or null if not found.
     */
    async deleteUser(userId: string): Promise<AdapterUser | null> {
      const user = users.get(userId);

      if (user) {
        users.delete(userId);
        return user;
      } else {
        return null;
      }
    },

    /**
     * Links an external account to a user.
     * @param account - The external account details.
     * @returns The linked account.
     */
    async linkAccount(account: AdapterAccount): Promise<AdapterAccount> {
      const key = `${account.provider}:${account.providerAccountId}`;
      accounts.set(key, account);
      return account;
    },

    /**
     * Unlinks an account from a user.
     * Removes the account associated with the given provider and providerAccountId.
     *
     * @param account - The account to unlink.
     * @returns The unlinked account if found, otherwise undefined.
     */
    async unlinkAccount(
      account: Pick<AdapterAccount, 'provider' | 'providerAccountId'>,
    ): Promise<AdapterAccount | undefined> {
      for (const [key, value] of accounts.entries()) {
        if (
          value.provider === account.provider &&
          value.providerAccountId === account.providerAccountId
        ) {
          accounts.delete(key);
          return value;
        }
      }

      return undefined;
    },

    /**
     * Creates a new session for a user.
     * @param session - The session data.
     * @returns The created session.
     */
    async createSession(session: AdapterSession): Promise<AdapterSession> {
      sessions.set(session.sessionToken, session);
      return session;
    },

    /**
     * Retrieves a session and its associated user.
     * @param sessionToken - The session token.
     * @returns The session and user, or null if not found.
     */
    async getSessionAndUser(
      sessionToken: string,
    ): Promise<{ session: AdapterSession; user: AdapterUser } | null> {
      const session = sessions.get(sessionToken);

      if (session) {
        const user = users.get(session.userId);

        if (user) {
          return { session, user };
        } else {
          return null;
        }
      } else {
        return null;
      }
    },

    /**
     * Updates an existing session.
     * @param data - The updated session data.
     * @returns The updated session or null if not found.
     */
    async updateSession(
      data: Partial<AdapterSession> & Pick<AdapterSession, 'sessionToken'>,
    ): Promise<AdapterSession | null> {
      const existing = sessions.get(data.sessionToken);

      if (existing) {
        const updated = { ...existing, ...data };
        sessions.set(data.sessionToken, updated);
        return updated;
      } else {
        return null;
      }
    },

    /**
     * Deletes a session.
     * @param sessionToken - The session token to delete.
     * @returns The deleted session or null if not found.
     */
    async deleteSession(sessionToken: string): Promise<AdapterSession | null> {
      const session = sessions.get(sessionToken);

      if (session) {
        sessions.delete(sessionToken);
        return session;
      } else {
        return null;
      }
    },

    /**
     * Creates a new verification token.
     * @param verificationToken - The token data.
     * @returns The created verification token.
     */
    async createVerificationToken(
      verificationToken: VerificationToken,
    ): Promise<VerificationToken> {
      const key = `${verificationToken.identifier}:${verificationToken.token}`;
      verificationTokens.set(key, verificationToken);
      return verificationToken;
    },

    /**
     * Consumes and returns a verification token.
     * @param params - Identifier and token to use.
     * @returns The token if found, otherwise null.
     */
    async useVerificationToken(params: {
      identifier: string;
      token: string;
    }): Promise<VerificationToken | null> {
      const key = `${params.identifier}:${params.token}`;
      const token = verificationTokens.get(key);

      if (token) {
        verificationTokens.delete(key);
        return token;
      } else {
        return null;
      }
    },

    /**
     * Retrieves an account by provider and account ID.
     * @param providerAccountId - The account ID.
     * @param provider - The external provider.
     * @returns The account or null if not found.
     */
    async getAccount(
      providerAccountId: string,
      provider: string,
    ): Promise<AdapterAccount | null> {
      const key = `${provider}:${providerAccountId}`;
      const account = accounts.get(key);

      if (account) {
        return account;
      } else {
        return null;
      }
    },
  };
}
