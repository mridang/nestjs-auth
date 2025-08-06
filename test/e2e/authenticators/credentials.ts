/**
 * authenticateCredentials performs a form-based sign-in against the
 * Auth.js credentials provider. It retrieves a CSRF token, submits
 * the login payload to the credential callback route, and waits for
 * the expected redirect that establishes the session. The function
 * does not assert cookies or response bodies; those checks are left
 * to the test matrix that invokes this helper.
 *
 * This helper is intentionally minimal and synchronous from the
 * caller’s perspective: it completes only after Auth.js has set the
 * session for the provided agent. The agent can then be used to call
 * protected routes under the authenticated context.
 *
 * @param agent A supertest agent bound to the running Nest server.
 * @param who   A user record containing id, email, roles, and
 *              password used by the credential provider.
 * @returns     A promise that resolves when the credential flow has
 *              completed and the agent holds an authenticated
 *              session. The promise is rejected if any step fails.
 */
import request from 'supertest';
import type { E2EUser } from '../e2e.module.js';

export async function authenticateCredentials(
  agent: ReturnType<typeof request.agent>,
  who: E2EUser
): Promise<void> {
  const csrfRes = await agent.get('/auth/csrf').expect(200);
  const csrfToken = csrfRes.body?.csrfToken;
  if (!csrfToken) throw new Error('Missing csrfToken (credentials)');

  await agent
    .post('/auth/callback/credentials')
    .type('form')
    .send({
      username: who.email,
      password: who.password,
      csrfToken
    })
    .expect(302);
}
