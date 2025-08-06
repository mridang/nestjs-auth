import type { Session } from '@auth/core/types';

/**
 * Base authenticated request interface that can be extended
 * for different transports (Express, Fastify, etc).
 */
export interface AuthenticatedRequest {
  session?: Session;
  user?: Session['user'];
  headers?: Record<string, string | string[] | undefined>;
  url?: string;
  method?: string;
  body?: unknown;
}
