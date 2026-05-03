import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AUTH_RATE_LIMIT_COOLDOWN_MS,
  getAuthRateLimitCooldownMs,
  isAuthRateLimitError,
} from './auth';

describe('auth rate limit helpers', () => {
  it('detects Supabase auth rate limit responses by status code', () => {
    const error = {
      status: 429,
      message: 'Request rate limit reached',
    };

    expect(isAuthRateLimitError(error)).toBe(true);
    expect(getAuthRateLimitCooldownMs(error)).toBe(DEFAULT_AUTH_RATE_LIMIT_COOLDOWN_MS);
  });

  it('detects Supabase auth rate limit responses by error code', () => {
    const error = {
      code: 'over_request_rate_limit',
      message: 'Request rate limit reached',
    };

    expect(isAuthRateLimitError(error)).toBe(true);
    expect(getAuthRateLimitCooldownMs(error)).toBe(DEFAULT_AUTH_RATE_LIMIT_COOLDOWN_MS);
  });

  it('returns null for non-rate-limit auth errors', () => {
    const error = {
      status: 400,
      code: 'invalid_credentials',
      message: 'Invalid login credentials',
    };

    expect(isAuthRateLimitError(error)).toBe(false);
    expect(getAuthRateLimitCooldownMs(error)).toBeNull();
  });
});
