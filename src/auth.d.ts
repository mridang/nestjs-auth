// noinspection JSUnusedGlobalSymbols
import type { DefaultSession, DefaultUser, Session } from '@auth/core/types';

declare module '@auth/core/types' {
  interface User extends DefaultUser {
    roles?: string[];
  }

  // noinspection JSUnusedGlobalSymbols
  interface Session extends DefaultSession {
    user: User;
  }
}

declare global {
  namespace Express {
    export interface Request {
      session?: Session;
      /** The user object from the Auth.js session. */
      user?: Session['user'];
    }
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    /** The Auth.js session object. */
    session?: Session;
    /** The user object from the Auth.js session. */
    user?: Session['user'];
  }
}
