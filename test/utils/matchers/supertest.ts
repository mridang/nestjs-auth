import { URL } from 'url';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    // noinspection JSUnusedGlobalSymbols
    interface Matchers<R> {
      toRedirectTo(pathname: string): R;

      toHaveCookie(name: string, options?: { secure?: boolean }): R;
    }
  }
}

expect.extend({
  toRedirectTo(response, pathname: string) {
    if (response.status !== 302) {
      return {
        pass: false,
        message: () => `expected a redirect (302) but got ${response.status}`
      };
    }
    const location = response.headers.location;
    if (!location) {
      return {
        pass: false,
        message: () => 'response is missing a "location" header'
      };
    }
    const redirectPathname = new URL(location, 'http://127.0.0.1').pathname;
    if (redirectPathname !== pathname) {
      return {
        pass: false,
        message: () =>
          `expected redirect to "${pathname}" but got "${redirectPathname}"`
      };
    }
    return {
      pass: true,
      message: () => `expected not to redirect to "${pathname}"`
    };
  },

  toHaveCookie(response, name: string, options: { secure?: boolean } = {}) {
    const cookieHeader = response.headers['set-cookie'];
    if (!cookieHeader) {
      return {
        pass: false,
        message: () => 'expected response to have a "set-cookie" header'
      };
    }

    const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
    const cookie = cookies.find((c) => c.startsWith(`${name}=`));

    if (!cookie) {
      return {
        pass: false,
        message: () => `expected to find a cookie named "${name}"`
      };
    }

    if (options.secure !== undefined) {
      const hasSecureFlag = cookie.toLowerCase().includes('secure');
      if (hasSecureFlag !== options.secure) {
        return {
          pass: false,
          message: () =>
            `expected cookie "${name}" to have Secure=${options.secure}, but it was ${hasSecureFlag}`
        };
      }
    }

    return {
      pass: true,
      message: () =>
        `expected not to find cookie "${name}" with specified options`
    };
  }
});

// This makes the file a module.
export {};
