import { consumePendingInviteToken, storePendingInviteToken } from './invite-token';
import { assertTrustedRedirectUrl } from './trusted-navigation';

function createStorageMock(seed: Record<string, string> = {}): Storage {
  const store = new Map(Object.entries(seed));

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe('assertTrustedRedirectUrl', () => {
  it('allows Stripe checkout URLs over https', () => {
    expect(
      assertTrustedRedirectUrl(
        'https://checkout.stripe.com/c/pay/cs_test_123',
        'https://app.ourcommune.io',
      ),
    ).toBe('https://checkout.stripe.com/c/pay/cs_test_123');
  });

  it('allows same-origin relative redirects', () => {
    expect(assertTrustedRedirectUrl('/settings', 'https://app.ourcommune.io')).toBe(
      'https://app.ourcommune.io/settings',
    );
  });

  it('rejects non-https external redirects', () => {
    expect(() =>
      assertTrustedRedirectUrl('http://checkout.stripe.com/session/test', 'https://app.ourcommune.io'),
    ).toThrow('Billing service returned an untrusted redirect URL.');
  });

  it('rejects external redirects outside the allowlist', () => {
    expect(() =>
      assertTrustedRedirectUrl('https://evil.example/phish', 'https://app.ourcommune.io'),
    ).toThrow('Billing service returned an untrusted redirect URL.');
  });
});

describe('invite token storage', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: createStorageMock(),
    });
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: createStorageMock(),
    });
  });

  it('stores the invite token in session storage', () => {
    storePendingInviteToken('invite-token');

    expect(window.sessionStorage.getItem('commune_invite_token')).toBe('invite-token');
    expect(window.localStorage.getItem('commune_invite_token')).toBeNull();
  });

  it('consumes and clears the invite token from legacy local storage', () => {
    window.localStorage.setItem('commune_invite_token', 'legacy-token');

    expect(consumePendingInviteToken()).toBe('legacy-token');
    expect(window.sessionStorage.getItem('commune_invite_token')).toBeNull();
    expect(window.localStorage.getItem('commune_invite_token')).toBeNull();
  });
});
