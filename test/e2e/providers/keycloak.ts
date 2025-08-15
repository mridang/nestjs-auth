import Keycloak, { KeycloakProfile } from '@auth/core/providers/keycloak';
import type { User } from '@auth/core/types';

interface KeycloakConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
}

/**
 * Creates a Keycloak provider configuration for Auth.js with custom profile mapping.
 *
 * This provider handles OAuth authentication with Keycloak and maps the received profile
 * to include custom fields like roles and preserves the original user ID through customId.
 * The profile mapping extracts user data from the Keycloak response and ensures consistent
 * user identification across sessions.
 *
 * @param config - Keycloak configuration containing issuer URL and client credentials
 * @returns Configured Keycloak provider for Auth.js
 *
 * @example
 * ```typescript
 * const keycloakProvider = createKeycloakProvider({
 *   issuer: 'http://localhost:8080/realms/myrealm',
 *   clientId: 'my-client',
 *   clientSecret: 'my-secret'
 * });
 *
 * // Use in AuthModule
 * providers: [keycloakProvider]
 * ```
 *
 * @remarks
 * - Uses preferred_username as the primary user identifier
 * - Preserves the original Keycloak user ID in customId field for session callbacks
 * - Extracts roles directly from the Keycloak profile
 * - Maps standard profile fields: name, email from Keycloak response
 * - The profile function expects a consistent Keycloak token structure
 */
export function createKeycloakProvider(config: KeycloakConfig) {
  return Keycloak({
    issuer: config.issuer,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    profile(profile: KeycloakProfile): User {
      return {
        id: profile.preferred_username,
        customId: profile.preferred_username,
        name: profile.name,
        email: profile.email,
        roles: profile.roles,
      };
    },
  });
}
